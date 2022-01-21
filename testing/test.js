// # test.js: Runs privacy tests on browsers
//
// Usage: `node index config/production.yaml`

// ## imports

const fs = require('fs');
const { execSync } = require('child_process');
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
const { connect } = require("it-ws/client");

// ## Utility functions

// Returns a deep copy of a JSON object.
const deepCopy = (x) => JSON.parse(JSON.stringify(x));

// Returns a promise that sleeps for the given millseconds.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Wraps a promise. If the promise resolves before timeMs, then
// resolves to the promise's result. Otherwise rejects with a timeout error.
const deadlinePromise = async (name, promise, timeMs) => {
  let timeoutId;
  const timeoutPromise = new Promise((_r, rej) => {
    timeoutId = setTimeout(() => rej(`${name} timed out after ${timeMs/1000} s.`), timeMs);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timeoutId);
  return result;
};

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
const gitHash = () => execSync('git rev-parse HEAD', { cwd: __dirname}).toString().trim();

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
    fs.mkdirSync(userFontDir, {recursive: true});
  }
  const fontDestination = `${userFontDir}/Monoton-Regular.ttf`;
  if (!fs.existsSync(fontDestination)) {
    fs.copyFileSync(`${__dirname}/Monoton-Regular.ttf`, fontDestination);
  }
};

// ## Proxies

let originalProxyState = {};
const disableProxies = () => {
  const networkServices = proxy.getNetworkServices();
  for (let networkService of networkServices) {
    originalProxyState[networkService] = proxy.getProxies(networkService);
    proxy.setProxies(networkService, {"web":{enabled:false},
                                      "secureweb":{enabled:false}});
  }
};

const restoreProxies = () => {
  const networkServices = proxy.getNetworkServices();
  for (let networkService of networkServices) {
    proxy.setProxies(networkService, originalProxyState[networkService]);
  }
};

const enableLocalProxies = (port) => {
  const networkServices = proxy.getNetworkServices();
  for (const networkService of networkServices) {
    proxy.setProxies(networkService, {"web": { enabled: true, domain: "127.0.0.1", port },
                                      "secureweb": { enabled: true, domain: "127.0.0.1", port }});
  }
}

// ## Websocket utilities

// Set up websocket.
const createWebsocket = async () => {
  const websocket = await connect("wss://results.privacytests.org/ws");
  const firstMessage = await websocket.source.next();
  console.log("message received", (new Date()).toISOString());
  console.log(firstMessage);
  const { sessionId } = JSON.parse(firstMessage.value);
  websocket._sessionId = sessionId;
  websocket._keepAlivePingId = setInterval(() => websocket.socket.send('{"message":"ping"}'), 30000);
  return websocket;
}

// Get the next value from the websocket.
const nextValue = async (websocket) => {
  const message = await websocket.source.next();
  console.log({message});
  if (message.value === undefined) {
    throw new Error(`Unexpected message: ${JSON.stringify(message)}`);
  }
  const { sessionId, data } = JSON.parse(message.value);
  if (sessionId !== websocket._sessionId) {
    throw new Error("Unexpected sessionId");
  }
  return data;
};

// Close the websocket (stopping its keepalive ping)
const destroyWebSocket = (websocket) => {
  try {
    clearInterval(websocket._keepAlivePingId);
    websocket.destroy();
  } catch (e) {
    console.log(e);
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
const iframe_root_same = "https://arthuredelstein.net/test-pages";
const iframe_root_different = "https://test-pages.privacytests.org";
const insecure_root = "http://insecure.arthuredelstein.net";
const upgradable_root = "http://upgradable.arthuredelstein.net";
const live_root = "https://arthuredelstein.net/browser-privacy-live";

const ipAddressTest = async (results) => {
  const myIpAddress = await fetch_ipAddress();
  console.log("ipAddressTest", {results});
  let { description, ipAddress } = results["IP address leak"];
  console.log({myIpAddress, deviceIpAddress: ipAddress});
  return {
    "IP address leak": {
      description,
      passed: ipAddress !== myIpAddress
    }
  };
};

// Get the next value from the websocket assigned to a particular browser.
const nextBrowserValue = (browserObject) => nextValue(browserObject._websocket);

// Open a page at url, passing it the browser's assigned session id as a URL parameter.
const openSessionUrl = (browserObject, url) => browserObject.openUrl(
  addSearchParam(url, "sessionId", browserObject._websocket._sessionId));

// Open a page at url, and return the results once they are available.
const runPageTest = async(browserObject, url) => {
  await openSessionUrl(browserObject, url);
  return nextBrowserValue(browserObject);
};

// Run the main browser tests.
const runMainTests = async (browserObject) => {
  const signal = await runPageTest(browserObject, `${iframe_root_same}/supercookies.html?mode=write&thirdparty=same`);
  if (!signal.supercookie_write_finished) {
    throw new Error("failed to get signal that the supercookie write finished");
  }
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
  return nextBrowserValue(browserObject);
};

// Run the insecure connection test. Returns { insecureRsults, insecurePassed }.
const runInsecureTest = async (browserObject) => {
  await openSessionUrl(browserObject, `${insecure_root}/insecure.html`);
  let insecureResult, insecurePassed;
  try {
    insecureResult = await deadlinePromise("insecure test", nextBrowserValue(browserObject), 8000);
    insecurePassed = false;
  } catch (e) {
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

const runTrackingCookieTest = async (browserObject) => {
  if (!(browserObject instanceof DesktopBrowser)) {
    return undefined;
  }
  enableLocalProxies(9090);
  let results = await runPageTest(browserObject, `${iframe_root_different}/tracking_content.html`);
  disableLocalProxies(9090);
  return results;
};

// Run all of our privacy tests using selenium for a given driver. Returns
// a map of test types to test result maps. Such as
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... },
//   "misc" : { ... },
//   "https" : { ... },
//   "navigation" : { ... },
//   "supercookies" : { ... } }
const runTests = async (browserObject, trackingCookies) => {
  try {
    // Main tests
    const mainResults = await runMainTests(browserObject);
    await sleep(1000);
    // Supplementary tests
    const supplementaryResults = await runPageTest(browserObject, `${iframe_root_same}/supplementary.html`);
    // Top-level tests
    const topLevelResults = await runPageTest(browserObject, `${live_root}/toplevel`)
    const ipAddressLeak = await ipAddressTest(topLevelResults);
    // HTTPS tests
    const upgradableAddressResult = await runPageTest(browserObject, `${upgradable_root}/upgradable.html?source=address`);
    const { insecureResult, insecurePassed } = await runInsecureTest(browserObject);
    // HSTS supercookie test
    const hstsResult = await runHstsTest(browserObject, insecurePassed);
    // Now compile the results into a final format.
    const trackingCookieResult = trackingCookies ? await runTrackingCookieTest(browserObject) : undefined;
    let results = Object.assign({}, mainResults);
    Object.assign(results["misc"],
                  ipAddressLeak,
                  { "GPC enabled first-party": topLevelResults["GPC enabled first-party"]});
    Object.assign(results["https"], upgradableAddressResult, insecureResult);
    Object.assign(results["supercookies"], { "HSTS cache": hstsResult });
    // For now, only include system font detection results in desktop
    if (browserObject instanceof DesktopBrowser) {
      Object.assign(results["fingerprinting"],
                    {"System font detection": supplementaryResults["System font detection"]});
      if (trackingCookieResult) {
        Object.assign(results["tracking cookies"], trackingCookieResult); 
      }
    }
    return results;
  } catch (e) {
    console.log(e);
    return null;
  }
};

// Runs a batch of tests (multiple browsers).
// Returns results in a JSON object.
const runTestsBatch = async (browserList, { shouldQuit, android, iOS, trackingCookies } = { shouldQuit: true }) => {
  let all_tests = [];
  let timeStarted = new Date().toISOString();
  for (let config of browserList) {
    console.log("\nnext test:", config);
    const { browser, incognito, tor, nightly } = config;
    const timeStarted = new Date().toISOString();
    const browserObject = android ? new AndroidBrowser(config) : (iOS ? new iOSBrowser(config) : new DesktopBrowser(config));
    browserObject._websocket = await createWebsocket();
    try {
      await browserObject.launch();
      const testResults = await deadlinePromise(`${browser} tests`, runTests(browserObject, trackingCookies), 300000);
      all_tests.push({
        browser, incognito, tor, nightly,
        testResults, timeStarted,
        reportedVersion: await browserObject.version(),
        os: os.type(), os_version: os.version(),
      });
    } catch (e) {
      console.log(e);
    }
    if (shouldQuit) {
      await destroyWebSocket(browserObject._websocket);
      try {
        await browserObject.kill();
      } catch (e) {
        console.log(e);
      }
    }
  }
  const timeStopped = new Date().toISOString();
  let platform;
  if (android) {
    platform = "Android";
  } else if (iOS) {
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
  const dir = `out/results/${dateString}`;
  fs.mkdirSync(dir, { recursive: true });
  const filePath = `${dir}/${fileStub}.json`;
  fs.writeFileSync(filePath, JSON.stringify(data));
  console.log(`Wrote results to "${filePath}".`);
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
  const defaultConfig = {aggregate: true, repeat: 1, debug: false};
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

const updateAll = async (config) => {
  const browserList = configToBrowserList(config);
  await Promise.all(browserList.map(async browserSpec => {
    const browserObject = new DesktopBrowser(browserSpec);
    console.log(browserObject);
    await browserObject.update();
  }));
};

// ## Main program

// Reads in command-line arguments, config file, runs the required
// tests, writes them to a JSON data file, and then renders results to
// a human-readable web page.
const main = async () => {
  try {
    installTestFontIfNeeded();
    disableProxies();
    // Read config file and flags from command line
    const config = readConfig();
    console.log({config});
    if (config.update) {
      await updateAll(config);
    }
    const expandedBrowserList = configToExpandedBrowserList(config);
    console.log("List of browsers to run:", expandedBrowserList);
    const testResults = await runTestsBatch(expandedBrowserList,
					    { shouldQuit: !config.debug, android: config.android,
					      iOS: config.ios, trackingCookies: config.trackingCookies });
    let dataFile = writeDataSync(config.filename, testResults);
    restoreProxies();
    render.render({ dataFiles: [dataFile], aggregate: config.aggregate });
  } catch (e) {
    console.log(e);
  }
};

main();

