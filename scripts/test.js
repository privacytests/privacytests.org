// # test.js: Runs privacy tests on browsers
//
// Usage: `node index config/production.yaml`

// ## imports

const fs = require('fs');
const { execSync, exec } = require('child_process');
const minimist = require('minimist');
const dateFormat = require('dateformat');
const YAML = require('yaml');
const os = require('os');
const process = require('process');
const fetch = require('node-fetch');
const render = require('./render');
const { DesktopBrowser } = require("./desktop.js");
const { AndroidBrowser } = require("./android.js");
const { iOSBrowser } = require("./iOS.js");
const proxy = require("./system-proxy");
const WebSocket = require('ws');
const cookieProxy = require('./cookie-proxy');

// ## Constants

const cookieProxyPort = 9090;

// ## Utility functions

const log = (...args) => {
  console.log(new Date().toISOString(), ...args);
}

// Returns a deep copy of a JSON object.
const deepCopy = (x) => JSON.parse(JSON.stringify(x));

// Returns a promise that sleeps for the given millseconds.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Wraps a promise. If the promise resolves before timeMs, then
// resolves to the promise's result. Otherwise rejects with a timeout error.
const deadlinePromise = async (name, promise, timeMs) => {
  let timeoutId;
  const timeoutPromise = new Promise((_r, rej) => {
    timeoutId = setTimeout(() => rej(`${name} timed out after ${timeMs / 1000} s.`), timeMs);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timeoutId);
  return result;
};

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
const gitHash = () => execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();

// Accepts a url string and a key and val to add search parameter.
const addSearchParam = (url, key, val) => {
  let urlObject = new URL(url);
  urlObject.searchParams.set(key, val);
  return urlObject.href;
};

// Fetch results from a json API.
const fetchJSON = async (...fetchArgs) => {
  let response = await fetch(...fetchArgs);
  return response.json();
};

// Fetch server reflexive IP address
const fetch_ipAddress = async () => {
  const wtfismyip = await fetchJSON("https://ipv4.wtfismyip.com/json");
  return wtfismyip["YourFuckingIPAddress"];
};

// ## Prepare system

// Install Monoton as a system font so that we can see if
// it is leaked by browsers. NOTE: Only works in macOS currently.
const installTestFontIfNeeded = () => {
  const homedir = os.homedir();
  const userFontDir = {
    "darwin": `${homedir}/Library/Fonts`,
    "linux": `${homedir}/.local/share/fonts`
  }[process.platform];
  if (!fs.existsSync(userFontDir)) {
    fs.mkdirSync(userFontDir, { recursive: true });
  }
  const fontDestination = `${userFontDir}/Monoton-Regular.ttf`;
  if (!fs.existsSync(fontDestination)) {
    fs.copyFileSync(`${__dirname}/../assets/fonts/Monoton-Regular.ttf`, fontDestination);
  }
};

let openProcesses = new Set();

const execute = (cmd, options) => {
  const process = exec(cmd, options);
  openProcesses.add(process);
  return process;
};

const killAllChildProcesses = () => {
  for (let process of openProcesses) {
    process.kill();
  }
}

// ## Proxies

let preferredNetworkService;

const disableProxies = async () => {
  preferredNetworkService ??= proxy.getPreferredNetworkService();
  proxy.setProxies(preferredNetworkService, {
    "web": { enabled: false },
    "secureweb": { enabled: false }
  });
  // Wait for proxy settings to propagate.
  await sleep(1000);
};

const enableProxies = async (port) => {
  preferredNetworkService ??= proxy.getPreferredNetworkService();
  proxy.setProxies(preferredNetworkService, {
    "web": { enabled: true, domain: "127.0.0.1", port },
    "secureweb": { enabled: true, domain: "127.0.0.1", port }
  });
  // Wait for proxy settings to propagate.
  await sleep(1000);
};

// ## Websocket utilities

const eventPromise = async (eventSource, eventType, timeout) =>
  new Promise((resolve, reject) => {
    const listener = (e) => {
      resolve(e);
    }
    if (timeout !== undefined) {
      setTimeout(() => {
        eventSource.removeEventListener(listener);
        reject(new Error(`'${eventType}' event timed out after ${timeout} ms`));
      }, timeout);
    }
    eventSource.addEventListener(eventType, listener, {once: true});
  });

const nextMessage = async (websocket, timeout) => {
  const event = await eventPromise(websocket, "message", timeout);
  return event.data;
};

const connect = async (address, protocols, options) => {
  const websocket = new WebSocket(address, protocols, options);
  await eventPromise(websocket, "open");
  return websocket;
};

// Set up websocket.
const createWebsocket = async () => {
  const websocket = await connect("wss://results.privacytests.org/ws");
  const firstMessage = await nextMessage(websocket);
  log("message received", (new Date()).toISOString());
  log(firstMessage);
  const { sessionId } = JSON.parse(firstMessage);
  websocket._sessionId = sessionId;
  websocket._keepAlivePingId = setInterval(() => websocket.send('{"message":"ping"}'), 30000);
  return websocket;
}

// Get the next value from the websocket.
const nextValue = async (websocket, timeout) => {
  const message = await nextMessage(websocket, timeout);
  log({ message });
  const { sessionId, data } = JSON.parse(message);
  if (sessionId !== websocket._sessionId) {
    throw new Error("Unexpected sessionId");
  }
  return data;
};

// Close the websocket (stopping its keepalive ping)
const closeWebSocket = (websocket) => {
  try {
    clearInterval(websocket._keepAlivePingId);
    websocket.terminate();
  } catch (e) {
    log(e);
  }
}

// ## Testing

// We use two domains for supercookies and navigation tests.
// The "same" domain is the one that is used for simluated third-party tracker
// and one of the two first parties. The "different" domain is the other
// first party we use.
// We also have a insecure domain for purely insecure pages, and an upgradable
// root for a domain that can be upgraded to https.
// Finally we have a live root for additional tests that require non-static
// responses.
const iframe_root_same = "https://test-pages.privacytests2.org";
const iframe_root_different = "https://test-pages.privacytests.org";
const insecure_root = "http://insecure.privacytests2.org";
const upgradable_root = "http://upgradable.privacytests2.org";
const live_root = "https://arthuredelstein.net/browser-privacy-live";

const ipAddressTest = async (results) => {
  const myIpAddress = await fetch_ipAddress();
  log("ipAddressTest", { results });
  let { description, ipAddress } = results["IP address leak"];
  log({ myIpAddress, deviceIpAddress: ipAddress });
  return {
    "IP address leak": {
      description,
      passed: ipAddress !== myIpAddress
    }
  };
};

// Get the next value from the websocket assigned to a particular browser.
const nextBrowserValue = (browserObject, timeout) => nextValue(browserObject._websocket, timeout);

// Open a page at url, passing it the browser's assigned session id as a URL parameter.
const openSessionUrl = (browserObject, url) => browserObject.openUrl(
  addSearchParam(url, "sessionId", browserObject._websocket._sessionId));

// Open a page at url, and return the results once they are available.
const runPageTest = async (browserObject, url, timeout) => {
  const nextItemPromise = nextBrowserValue(browserObject, timeout);
  await openSessionUrl(browserObject, url);
  return await nextItemPromise;
};

// Run the main browser tests.
const runMainTests = async (browserObject, categories) => {
  const signal = await runPageTest(browserObject, `${iframe_root_same}/supercookies.html?mode=write&thirdparty=same`);
  if (!signal.supercookie_write_finished) {
    throw new Error("failed to get signal that the supercookie write finished");
  }
  const resultsPromise = nextBrowserValue(browserObject);
  if (browserObject.browser === "onion") {
    // Onion browser seems to need more handholding
    await browserObject.clickContent();
    await openSessionUrl(browserObject, `${iframe_root_same}/supercookies.html?mode=read&thirdparty=same`);
  } else if (browserObject instanceof AndroidBrowser || browserObject instanceof iOSBrowser) {
    // In mobile, we click the viewport to open a new tab.
    await browserObject.clickContent();
  } else {
    // In desktop, we manually open a new tab.
    await openSessionUrl(browserObject, `${iframe_root_same}/supercookies.html?mode=read&thirdparty=same`);
  }
  // Return the main results.
  return resultsPromise;
};

// Run the insecure connection test. Returns { insecureRsults, insecurePassed }.
const runInsecureTest = async (browserObject) => {
  const timeout = browserObject instanceof iOSBrowser ? 30000 : 8000;
  const insecureResultPromise = nextBrowserValue(browserObject, timeout);
  await openSessionUrl(browserObject, `${insecure_root}/insecure.html`);
  let insecureResult, insecurePassed;
  try {
    insecureResult = await insecureResultPromise;
    insecurePassed = false;
  } catch (e) {
    console.log(e);
    insecureResult = { "Insecure website": { passed: true, result: "Insecure website never loaded" } };
    insecurePassed = true;
  }
  return { insecureResult, insecurePassed };
};

// Run the HSTS cache supercookie test.
const runHstsTest = async (browserObject, insecurePassed) => {
  if (!insecurePassed) {
    await runPageTest(browserObject, `${iframe_root_different}/clear_hsts.html`);
    await runPageTest(browserObject, `${iframe_root_different}/set_hsts.html`);
    return await runPageTest(browserObject, `${insecure_root}/test_hsts.html`);
  } else {
    return {
      write: null, read: null,
      readSameFirstParty: null, readDifferentFirstParty: "HTTPS used by default; no HSTS cache issue expected",
      passed: true, testFailed: false, unsupported: null
    }
  }
};

const analyzeTrackingCookieTestResults = (leakyHosts) => {
  const trackers = JSON.parse(fs.readFileSync("../static/trackers.json"));
  let analyzedResults = {};
  for (let { name, url } of trackers) {
    let host = new URL(url).host;
    const cookieFound = leakyHosts ? leakyHosts.has(host) : false;
    const passed = !cookieFound;
    const description = `Tests whether the browser stops cookies from ${host} from tracking users across websites.`;
    analyzedResults[name] = { passed, url, description, cookieFound };
  }
  log(analyzedResults);
  return analyzedResults;
}

const runTrackingCookieTest = async (browserObject) => {
  await runPageTest(
    browserObject, `${iframe_root_same}/tracking_content.html?manual=true&write_cookies=true`);
  await runPageTest(
    browserObject, `${iframe_root_different}/tracking_content.html?manual=true&read_cookies=true`);
  const leakyHosts = cookieProxy.getLeakyHosts(browserObject._websocket._sessionId);
  return analyzeTrackingCookieTestResults(leakyHosts);
};

// Run all of our privacy tests using selenium for a given driver. Returns
// a map of test types to test result maps. Such as
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... },
//   "misc" : { ... },
//   "https" : { ... },
//   "navigation" : { ... },
//   "supercookies" : { ... } }
const runTestsStage1 = async ({browserObject, categories}) => {
  await disableProxies();
  let results = {};
  log({ categories });
  // Main tests
  if (!categories || categories.includes("main")) {
    const mainResults = await runMainTests(browserObject, categories);
    Object.assign(results, mainResults);
    await sleep(1000);
  }
  // Supplementary tests
  if (!categories || categories.includes("supplementary")) {
    const supplementaryResults = await runPageTest(browserObject, `${iframe_root_same}/supplementary.html`);
    // For now, only include system font detection results in desktop
    if (browserObject instanceof DesktopBrowser) {
      Object.assign(results["fingerprinting"],
        { "System font detection": supplementaryResults["System font detection"] });
    }
  }
  // Misc
  if (!categories || categories.includes("misc")) {
    const topLevelResults = await runPageTest(browserObject, `${live_root}/toplevel`)
    const ipAddressLeak = await ipAddressTest(topLevelResults);
    Object.assign(results["misc"],
      ipAddressLeak,
      { "GPC enabled first-party": topLevelResults["GPC enabled first-party"] });
  }
  // HTTPS tests
  if (!categories || categories.includes("https")) {
    log (`running HTTPS tests for ${browserObject.browser}`);
    const upgradableAddressResult = await runPageTest(browserObject, `${upgradable_root}/upgradable.html?source=address`);
    const { insecureResult, insecurePassed } = await runInsecureTest(browserObject);
    // HSTS supercookie test
    const hstsResult = await runHstsTest(browserObject, insecurePassed);
    results["https"] = Object.assign({}, results["https"], upgradableAddressResult, insecureResult);
    if (!results["supercookies"]) {
      results["supercookies"] = {};
    }
    Object.assign(results["supercookies"], { "HSTS cache": hstsResult });
  }
  return results;
};

const runTestsStage2 = async ({browserObject, categories}) => {
  let results = {};
  // Tracking cookies
  if (browserObject instanceof DesktopBrowser &&
      (!categories || categories.includes("trackingCookies"))) {
    // Now compile the results into a final format.
    log("running trackingCookies");
    const trackingCookieResult = await runTrackingCookieTest(browserObject);
    Object.assign(results, { "tracker_cookies": trackingCookieResult });
  }
  return results;
};


// Creates the browser object whether android, iOS, or desktop.
const createBrowserObject = ({config, android, ios}) => {
  return android ? new AndroidBrowser(config) : (ios ? new iOSBrowser(config) : new DesktopBrowser(config));
}

// Call asyncFunction on items in array in parallel.
const asyncMapParallel = async (asyncFunction, array) => {
  return Promise.all(Array.prototype.map.call(array, asyncFunction));
};

// Call asyncFunction on items in array in series.
const asyncMapSeries = async (asyncFunction, array) => {
  let results = [];
  for (const item of array) {
    results.push(await asyncFunction(item));
  }
  return results;
};

// Call asyncFunction on items in array in series or parallel.
const asyncMap = (parallel, asyncFunction, array) =>
  (parallel ? asyncMapParallel : asyncMapSeries)(asyncFunction, array);

// Runs a batch of tests (multiple browsers).
// Returns results in a JSON object.
const runTestsBatch = async (browserList, { shouldQuit, android, ios, categories } = { shouldQuit: true }) => {
  let all_tests = [];
  let timeStarted = new Date().toISOString();
  cookieProxy.simulateTrackingCookies(cookieProxyPort);
  for (let config of browserList) {
    log("\nnext test:", config);
    const { browser, incognito, tor, nightly } = config;
    const timeStarted = new Date().toISOString();
    const browserObject = createBrowserObject({config, android, ios});
        browserObject._websocket = await createWebsocket();
    try {
      await browserObject.launch();
      const testResultsStage1 = await deadlinePromise(`${browser} tests`, runTestsStage1({browserObject, categories}), 600000);
      let testResultsStage2;
      if (browserObject instanceof DesktopBrowser) {
        await enableProxies(cookieProxyPort);
        testResultsStage2 = await deadlinePromise(`${browser} tests`, runTestsStage2({browserObject, categories}), 100000);
        await disableProxies(cookieProxyPort);
      }
      const testResults = Object.assign({}, testResultsStage1, testResultsStage2);
      all_tests.push({
        browser, incognito, tor, nightly,
        testResults, timeStarted,
        reportedVersion: await browserObject.version(),
        os: os.type(), os_version: os.version(),
      });
    } catch (e) {
      log(e);
    }
    if (shouldQuit) {
      await closeWebSocket(browserObject._websocket);
      try {
        await browserObject.kill();
      } catch (e) {
        log(e);
      }
    }
  }
  cookieProxy.stopTrackingCookieSimulation();
  const timeStopped = new Date().toISOString();
  let platform;
  if (android) {
    platform = "Android";
  } else if (ios) {
    platform = "iOS";
  } else {
    platform = "Desktop";
  }
  return { all_tests, git: gitHash(), timeStarted, timeStopped, platform };
};

// ## Writing results

// Takes our results in a JSON object and writes them to disk.
// The file name looks like `yyyymmdd__HHMMss.json`.
const writeDataSync = (filename, data) => {
  const dateString = dateFormat(new Date(), "yyyymmdd", true);
  const fileStub = filename ?? dateFormat(new Date(), "HHMMss", true);
  const dir = `../results/${dateString}`;
  fs.mkdirSync(dir, { recursive: true });
  const filePath = `${dir}/${fileStub}.json`;
  fs.writeFileSync(filePath, JSON.stringify(data));
  log(`Wrote results to "${filePath}".`);
  return filePath;
};

// ## Config files

// Takes a list of browser configs, and repeats or removes them as needed.
// Read a YAML file from disk.
const readYAMLFile = (file) => {
  const fileContents = fs.readFileSync(file, 'utf8');
  return YAML.parse(fileContents);
};

const readConfig = () => {
  const defaultConfig = { aggregate: true, repeat: 1, debug: false };
  let commandLineConfig = minimist(process.argv.slice(2));
  const configFile = commandLineConfig._[0];
  delete commandLineConfig._;
  let commandLineBrowsers = commandLineConfig.browsers ?? commandLineConfig.browser;
  if (commandLineBrowsers) {
    commandLineConfig.browsers = commandLineBrowsers.split(",");
  }
  const yamlConfig = configFile ? readYAMLFile(configFile) : null;
  return Object.assign({}, defaultConfig, yamlConfig, commandLineConfig);
};

const configToBrowserList = (config) => {
  let browserList = [];
  for (const browser of config.browsers) {
    browserList.push({
      browser,
      nightly: config.nightly ? true : false,
      incognito: config.incognito ? true : false,
      android: config.android ? true : false,
      ios: config.ios ? true : false,
    })
  }
  return browserList;
};

const expandBrowserList = (browserList, repeat = 1) => {
  let results = [];
  for (let browserSpec of browserList) {
    if (!browserSpec.disable) {
      const config2 = deepCopy(browserSpec);
      delete config2["repeat"];
      results = [].concat(results, Array((browserSpec.repeat ?? 1) * (repeat ?? 1)).fill(config2));
    }
  }
  return results;
};

const configToExpandedBrowserList = (config) => {
  const browserList = configToBrowserList(config);
  return expandBrowserList(browserList, config.repeat);
};

let cleanupRan = false;
const cleanup = async () => {
  if (cleanupRan) {
    return;
  }
  log("cleaning up");
  await disableProxies();
  killAllChildProcesses();
  cleanupRan = true;
};

// Output all versions of browsers in config to the console.
const showVersions = async (config) => {
  const browserList = configToBrowserList(config);
  const { android, ios } = config;
  log(config, android, ios);
  const versionData = await Promise.all(browserList.map(async browserSpec => {
    const browserObject = createBrowserObject({config: browserSpec, android, ios});
    const version = await browserObject.version();
    return { name: browserSpec.browser, version };
  }));
  const versionDataSorted = versionData.sort((a,b) => a.name < b.name ? -1 : 1);
  for (let { name, version } of versionDataSorted) {
    log(name, version);
  }
}

// Update all browsers listed in config.
const updateAll = async (config) => {
  const browserList = configToBrowserList(config);
  await Promise.all(browserList.map(async browserSpec => {
    const browserObject = new DesktopBrowser(browserSpec);
    log(browserObject);
    await browserObject.update();
  }));
  await showVersions(config);
};

// ## Main program

// Reads in command-line arguments, config file, runs the required
// tests, writes them to a JSON data file, and then renders results to
// a human-readable web page.
const main = async () => {
  [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach((eventType) => {
    process.on(eventType, (code) => {
      log(eventType, code);
      cleanup(eventType);
      process.exit(code);
    });
  });
  try {
    installTestFontIfNeeded();
    await disableProxies();
    // Read config file and flags from command line
    const config = readConfig();
    log({ config });
    if (config.update) {
      await updateAll(config);
      process.exit();
      return;
    }
    if (config.versions || config.version) {
      await showVersions(config);
      return;
    }
    const expandedBrowserList = configToExpandedBrowserList(config);
    log("List of browsers to run:", expandedBrowserList);
    const testResults = await runTestsBatch(expandedBrowserList,
      {
        shouldQuit: !config.debug, android: config.android,
        ios: config.ios,
        categories: config.categories
      });
    let dataFile = writeDataSync(config.filename, testResults);
    await render.render({ dataFiles: [dataFile], aggregate: config.aggregate });
    if (!config.debug) {
      process.exit();
    }
  } catch (e) {
    log(e);
  }
};

main();

