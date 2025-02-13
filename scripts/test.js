// # test.js: Runs privacy tests on browsers
//
// Usage: `node index config/production.yaml`

// ## imports

/* eslint-disable camelcase */

const fs = require('fs');
const { execSync } = require('child_process');
const minimist = require('minimist');
const dateFormat = require('dateformat');
const os = require('os');
const process = require('process');
const render = require('./render');
const { DesktopBrowser } = os.platform() === 'darwin' ? require('./desktop.js') : require('./desktop-linux.js');
const { AndroidBrowser } = require('./android.js');
const { IOSBrowser } = require('./iOS.js');
const WebSocket = require('ws');
const cookieProxy = require('./cookie-proxy');
const { sleepMs, readYAMLFile } = require('./utils');
const path = require('node:path');
const { observeDomains, runDnsTests } = require('./dns-test.js');
const systemNetworkSettings = require('./system-network-settings');

// ## Constants

const mitmProxyPort = 9090;
const CLOUDFLARE_DNS = "1.1.1.1"

// ## Utility functions

const log = (...args) => {
  console.log(new Date().toISOString(), ...args);
};

// Wraps a promise. If the promise resolves before timeMs, then
// resolves to the promise's result. Otherwise rejects with a timeout error.
const deadlinePromise = async (name, promise, timeMs) => {
  let timeoutId;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${timeMs / 1000} s.`)), timeMs);
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
  const urlObject = new URL(url);
  urlObject.searchParams.set(key, val);
  return urlObject.href;
};

// Fetch results from a json API.
const fetchJSON = async (...fetchArgs) => {
  const response = await fetch(...fetchArgs);
  return response.json();
};

// Fetch server reflexive IP address
const fetchIpAddress = async () => {
  const wtfismyip = await fetchJSON('https://ipv4.wtfismyip.com/json');
  return wtfismyip.YourFuckingIPAddress;
};

// ## Prepare system

// Install Monoton as a system font so that we can see if
// it is leaked by browsers. NOTE: Only works in macOS currently.
const installTestFontIfNeeded = () => {
  const homedir = os.homedir();
  const userFontDir = {
    darwin: `${homedir}/Library/Fonts`,
    linux: `${homedir}/.local/share/fonts`,
    win32: `${homedir}/AppData/Local/Microsoft/Windows/Fonts`
  }[process.platform];
  if (!fs.existsSync(userFontDir)) {
    fs.mkdirSync(userFontDir, { recursive: true });
  }
  const fontDestination = `${userFontDir}/Monoton-Regular.ttf`;
  if (!fs.existsSync(fontDestination)) {
    fs.copyFileSync(path.join(__dirname, '../assets/fonts/Monoton-Regular.ttf'),
      fontDestination);
  }
};

// ## Websocket utilities

const eventPromise = async (eventSource, eventType, timeout) =>
  new Promise((resolve, reject) => {
    const listener = (e) => {
      resolve(e);
    };
    if (timeout !== undefined) {
      setTimeout(() => {
        eventSource.removeEventListener(listener);
        reject(new Error(`'${eventType}' event timed out after ${timeout} ms`));
      }, timeout);
    }
    eventSource.addEventListener(eventType, listener, { once: true });
  });

const nextMessage = async (websocket, timeout) => {
  const event = await eventPromise(websocket, 'message', timeout);
  return event.data;
};

const connect = async (address, protocols, options) => {
  const websocket = new WebSocket(address, protocols, options);
  await eventPromise(websocket, 'open');
  return websocket;
};

// Set up websocket.
const createWebsocket = async () => {
  const websocket = await connect('wss://results.privacytests.org/ws');
  const firstMessage = await nextMessage(websocket);
  log('message received', (new Date()).toISOString());
  log(firstMessage);
  const { sessionId } = JSON.parse(firstMessage);
  websocket._sessionId = sessionId;
  websocket._keepAlivePingId = setInterval(() => websocket.send('{"message":"ping"}'), 30000);
  return websocket;
};

// Get the next value from the websocket.
const nextValue = async (websocket, timeout) => {
  const message = await nextMessage(websocket, timeout);
  log({ message });
  const { sessionId, data } = JSON.parse(message);
  if (sessionId !== websocket._sessionId) {
    throw new Error('Unexpected sessionId');
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
};

// ## Testing

// We use two domains for supercookies and navigation tests.
// The "same" domain is the one that is used for simluated third-party tracker
// and one of the two first parties. The "different" domain is the other
// first party we use.
// We also have a insecure domain for purely insecure pages, and an upgradable
// root for a domain that can be upgraded to https.
// Finally we have a live root for additional tests that require non-static
// responses.
const kIframeRootSame = 'https://test-pages.privacytests2.org';
const kIframeRootDifferent = 'https://test-pages.privacytests.org';
const kIframeRootThird = 'https://test-pages.privacytests3.org';
const kInsecureRoot = 'http://insecure.privacytests3.org';
const kUpgradableRoot = 'http://upgradable.privacytests2.org';
const kLiveRoot = 'https://test-pages.privacytests2.org/live';
const kHstsRoot = 'https://hsts.privacytests2.org';

const ipAddressTest = async (results) => {
  const myIpAddress = await fetchIpAddress();
  log('ipAddressTest', { results });
  const { description, ipAddress } = results['IP address leak'];
  log({ myIpAddress, deviceIpAddress: ipAddress });
  return {
    'IP address leak': {
      description,
      passed: ipAddress !== myIpAddress
    }
  };
};

// Get the next value from the websocket assigned to a particular browser.
const nextBrowserValue = (browserSession, timeout) => nextValue(browserSession.websocket, timeout);

// Open a page at url, passing it the browser's assigned session id as a URL parameter.
const openSessionUrl = (browserSession, url) => browserSession.browser.openUrl(
  addSearchParam(url, 'sessionId', browserSession.websocket._sessionId));

// Open a page at url, and return the results once they are available.
const runPageTest = async (browserSession, url, timeout) => {
  const nextItemPromise = nextBrowserValue(browserSession, timeout);
  await openSessionUrl(browserSession, url);
  return await nextItemPromise;
};

// Run the main browser tests.
const runMainTests = async (browserSession, categories) => {
  const preferredNetworkService = systemNetworkSettings.getPreferredNetworkService();
  systemNetworkSettings.setDNS(preferredNetworkService, CLOUDFLARE_DNS);
  const signal = await runPageTest(browserSession, `${kIframeRootSame}/supercookies.html?mode=write&thirdparty=same`);
  if (!signal.supercookie_write_finished) {
    throw new Error('failed to get signal that the supercookie write finished');
  }
  const resultsPromise = nextBrowserValue(browserSession);
  // Open a new tab.
  await openSessionUrl(browserSession, `${kIframeRootSame}/supercookies.html?mode=read&thirdparty=same`);
  const results = await resultsPromise;
  // DuckDuckGo needs some personal validation
  if (browserSession.browser instanceof AndroidBrowser) {
    await browserSession.browser.highFiveIfNecessary();
  }
  // Return the main results.
  return results;
};

// Combine same-session results with cross-session results.
const analyzeSessionResults = (sameSessionResults, crossSessionResults) => {
  console.log({ crossSessionResults, sameSessionResults, test: 'session' });
  const results = {};
  for (const [name, sameSessionData] of Object.entries(sameSessionResults)) {
    results[name] = {};
    const crossSessionData = crossSessionResults[name];
    const unsupported = ((typeof sameSessionData.result) === 'string' &&
      sameSessionData.result.startsWith('Error:')) ||
      (name === 'Alt-Svc' && sameSessionData.result.startsWith('h2')) ||
      sameSessionData.result === undefined || sameSessionData.result === null;
    const passed = unsupported ? undefined : (crossSessionData.result !== sameSessionData.result);
    results[name] = {
      unsupported,
      passed,
      testFailed: false,
      write: sameSessionData.write,
      read: sameSessionData.read,
      description: sameSessionData.description,
      readSameSession: sameSessionData.result,
      readDifferentSession: crossSessionData.result
    };
  }
  return results;
};

// Run the cross-session state tests and return raw results.
const runSessionTestsRaw = async (browserSession) => {
  await runPageTest(browserSession, `${kIframeRootThird}/session.html?mode=write&label=3p`);
  await runPageTest(browserSession, `${kIframeRootThird}/session.html?mode=write&firstParty=true&label=1p`);
  const sameSessionResults_3p = await runPageTest(browserSession, `${kIframeRootThird}/session.html?mode=read&label=3p`);
  const sameSessionResults_1p = await runPageTest(browserSession, `${kIframeRootThird}/session.html?mode=read&firstParty=true&label=1p`);
  await sleepMs(5000);
  await browserSession.browser.restart();
  await sleepMs(1000);
  const crossSessionResults_3p = await runPageTest(browserSession, `${kIframeRootThird}/session.html?mode=read&label=3p`);
  const crossSessionResults_1p = await runPageTest(browserSession, `${kIframeRootThird}/session.html?mode=read&firstParty=true&label=1p`);
  await sleepMs(5000);
  return { sameSessionResults_3p, crossSessionResults_3p, sameSessionResults_1p, crossSessionResults_1p };
};

// Run the cross-session state tests and return analyzed results.
const runSessionTests = async (browserSession) => {
  const { sameSessionResults_3p, crossSessionResults_3p, sameSessionResults_1p, crossSessionResults_1p } = await runSessionTestsRaw(browserSession);
  const session_3p = analyzeSessionResults(sameSessionResults_3p, crossSessionResults_3p);
  const session_1p = analyzeSessionResults(sameSessionResults_1p, crossSessionResults_1p);
  return { session_3p, session_1p };
};

// Run the insecure connection test. Returns { insecureResults, insecurePassed }.
const runInsecureTest = async (browserSession) => {
  let insecureResult, insecurePassed;
  try {
    const timeout = (browserSession.browser instanceof DesktopBrowser) ? 8000 : 30000;
    const insecureResultPromise = nextBrowserValue(browserSession, timeout);
    await openSessionUrl(browserSession, `${kInsecureRoot}/insecure.html`);
    log('now trying');
    insecureResult = await insecureResultPromise;
    insecurePassed = false;
  } catch (e) {
    insecureResult = { 'Insecure website warning': { passed: true, result: 'Insecure website never loaded' } };
    insecurePassed = true;
  }
  return { insecureResult, insecurePassed };
};

// Run the HSTS cache supercookie test.
const runHstsTest = async (browserSession, insecurePassed) => {
  if (!insecurePassed) {
    const temp1 = await runPageTest(browserSession, `${kHstsRoot}/clear_hsts.html`);
    const temp2 = await runPageTest(browserSession, `${kHstsRoot}/set_hsts.html`);
    console.log({ temp1, temp2 });
    return await runPageTest(browserSession, `${kInsecureRoot}/test_hsts.html`);
  } else {
    return {
      write: null,
      read: null,
      readSameFirstParty: null,
      readDifferentFirstParty: 'HTTPS used by default; no HSTS cache issue expected',
      passed: true,
      testFailed: false,
      unsupported: null
    };
  }
};

// Run the HSTS cache supercookie test.
const runHsts2Test = async (browserSession, insecurePassed) => {
  if (!insecurePassed) {
    const temp1 = await runPageTest(browserSession, `${kHstsRoot}/clear_hsts2.html`);
    const temp2 = await runPageTest(browserSession, `${kHstsRoot}/set_hsts2.html`);
    console.log({ temp1, temp2 });
    return await runPageTest(browserSession, `${kInsecureRoot}/test_hsts2.html`);
  } else {
    return {
      write: null,
      read: null,
      readSameFirstParty: null,
      readDifferentFirstParty: 'HTTPS used by default; no HSTS cache issue expected',
      passed: true,
      testFailed: false,
      unsupported: null
    };
  }
};

const analyzeTrackingCookieTestResults = (leakyHosts) => {
  const trackers = JSON.parse(fs.readFileSync('../static/trackers.json'));
  const analyzedResults = {};
  for (const { name, url } of trackers) {
    const host = new URL(url).host;
    const cookieFound = leakyHosts ? leakyHosts.has(host) : false;
    const passed = !cookieFound;
    const description = `Tests whether the browser stops cookies from ${host} from tracking users across websites.`;
    analyzedResults[name] = { passed, url, description, cookieFound };
  }
  log(analyzedResults);
  return analyzedResults;
};

const runTrackingCookieTest = async (browserSession) => {
  await runPageTest(
    browserSession, `${kIframeRootSame}/tracking_content.html?manual=true&write_cookies=true`);
  await runPageTest(
    browserSession, `${kIframeRootDifferent}/tracking_content.html?manual=true&read_cookies=true`);
  const leakyHosts = cookieProxy.getLeakyHosts(browserSession.websocket._sessionId);
  return analyzeTrackingCookieTestResults(leakyHosts);
};

// Run the first stage of privacy tests. Returns
// a map of test types to test result maps. Such as
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... },
//   "misc" : { ... },
//   "https" : { ... },
//   "navigation" : { ... },
//   "supercookies" : { ... } }
const runTestsStage1 = async ({ browserSession, categories }) => {
  await DesktopBrowser.setGlobalProxyUsageEnabled(false);
  let results = {};

  // Start up browser with existing profile
  await browserSession.browser.launch(false);

  // Cross-session tests
  if (categories.includes('session')) {
    const sessionResults = await runSessionTests(browserSession);
    results = { ...results, ...sessionResults };
  }

  // Main tests
  if (categories.includes('main')) {
    const mainResults = await runMainTests(browserSession, categories);
    results = { ...results, ...mainResults };
    await sleepMs(1000);
  }
  // Supplementary tests
  if (browserSession.browser instanceof DesktopBrowser &&
    (categories.includes('supplementary'))) {
    const supplementaryResults = await runPageTest(browserSession, `${kIframeRootSame}/supplementary.html`);
    results.fingerprinting = {
      ...results.fingerprinting,
      ...{ 'System font detection': supplementaryResults['System font detection'] }
    };
  }
  // Misc
  if (categories.includes('misc')) {
    const topLevelResults = await runPageTest(browserSession, `${kLiveRoot}/toplevel.html`);
    const ipAddressLeak = await ipAddressTest(topLevelResults);
    results.misc = {
      ...results.misc,
      ...ipAddressLeak,
      ...{ 'GPC enabled first-party': topLevelResults['GPC enabled first-party'] }
    };
  }
  // HTTPS tests
  if (categories.includes('https')) {
    const upgradableAddressResult = await runPageTest(browserSession, `${kUpgradableRoot}/upgradable.html?source=address`);
    const { insecureResult, insecurePassed } = await runInsecureTest(browserSession);
    // HSTS supercookie tests
    const hstsResult = await runHstsTest(browserSession, insecurePassed);
    const hsts2Result = await runHsts2Test(browserSession, insecurePassed);
    results.https = {
      ...results.https,
      ...upgradableAddressResult,
      ...insecureResult
    };
    results.supercookies = {
      ...results.supercookies,
      ...{ 'HSTS cache': hstsResult, 'HSTS cache (fetch)': hsts2Result }
    };
  }

  // Kill the browser
  await browserSession.browser.kill();
  return results;
};

const runTestsStage2 = async ({ browserSession, categories }) => {
  await browserSession.browser.launch(false);
  const results = {};
  // Tracking cookies
  if (browserSession.browser instanceof DesktopBrowser &&
    (categories.includes('trackingCookies'))) {
    // Now compile the results into a final format.
    log('running trackingCookies');
    const trackingCookieResult = await runTrackingCookieTest(browserSession);
    Object.assign(results, { tracker_cookies: trackingCookieResult });
  }
  await browserSession.browser.kill();
  return results;
};

// Creates the browser object whether android, iOS, or desktop.
const createBrowserObject = (config) => {
  return config.android ? new AndroidBrowser(config) : (config.ios ? new IOSBrowser(config) : new DesktopBrowser(config));
};

// Call asyncFunction on items in array in parallel.
const asyncMapParallel = async (asyncFunction, array) => {
  return await Promise.allSettled(Array.prototype.map.call(array, asyncFunction));
};

// Call asyncFunction on items in array in series.
const asyncMapSeries = async (asyncFunction, array) => {
  const results = [];
  for (const item of array) {
    let result;
    try {
      const value = await asyncFunction(item);
      result = { value, status: 'fulfilled' };
    } catch (e) {
      result = { reason: e, status: 'rejected' };
    }
    results.push(result);
  }
  return results;
};

// Call asyncFunction on items in array in series or parallel.
const asyncMap = (parallel, asyncFunction, array) =>
  (parallel ? asyncMapParallel : asyncMapSeries)(asyncFunction, array);

const prepareBrowserSession = async (config, hurry) => {
  const browser = createBrowserObject(config);
  const websocket = await createWebsocket();
  if (!hurry && browser instanceof DesktopBrowser) {
    await browser.launch();
    // Give browser the chance to load any feature flags.
    await sleepMs(60000);
    await browser.kill();
  }
  return { browser, websocket };
};

/*
const runTelemetryTests = async (browserSessions) => {
  await DesktopBrowser.setGlobalProxyUsageEnabled(true, mitmProxyPort);
  console.log('hi');
  await DesktopBrowser.setGlobalProxyUsageEnabled(false);
};
*/

// Runs a batch of tests (multiple browsers).
// Returns results in a JSON object.
const runTestsBatch = async (
  browserLists, { debug, android, ios, categories, repeat, hurry, series } = { debug: false, repeat: 1, hurry: false, series: false }) => {
  const allTests = [];
  console.log(categories);
  const timeStarted = new Date().toISOString();
  cookieProxy.simulateTrackingCookies(mitmProxyPort, debug);
  if (categories.includes('dns') && !android && !ios) {
    // Make sure we can connect to the monitor-dns.js socket listener
    try {
      await observeDomains();
    } catch (e) {
      console.log('Unable to connect to port 9999. Is ./monitor-dns.js running?');
      process.exit(1);
    }
  }
  const failures = [];
  for (let iter = 0; iter < repeat; ++iter) {
    for (const browserList of browserLists) {
      const timeStarted = new Date().toISOString();
      let browserSessions;
      try {
        browserSessions = (await asyncMap(!series, (config) => prepareBrowserSession(config, hurry), browserList)).map(item => item.value);
        console.log({ browserSessions });
        const testResultsStage1 = await asyncMap(!series, (browserSession) => deadlinePromise(`${browserSession.browser.browser} tests`, runTestsStage1({ browserSession, categories }), 1000000), browserSessions);
        let testResultsStage2 = [];
        let testResultsStage3 = [];
        if (!android && !ios) {
          await DesktopBrowser.setGlobalProxyUsageEnabled(true, mitmProxyPort);
          testResultsStage2 = await asyncMap(!series, (browserSession) => deadlinePromise(`${browserSession.browser.browser} tests`, runTestsStage2({ browserSession, categories }), 100000), browserSessions);
          await DesktopBrowser.setGlobalProxyUsageEnabled(false);
          if (categories.includes('dns')) {
            testResultsStage3 = await runDnsTests(browserSessions);
          }
          // await runTelemetryTests(browserSessions);
        }
        for (let i = 0; i < browserList.length; ++i) {
          if (testResultsStage1[i].status === 'rejected' || (!android && !ios && testResultsStage2[i].status === 'rejected')) {
            failures.push([browserList[i], testResultsStage1[i], testResultsStage2[i]]);
            continue;
          }
          const testResults = Object.assign({}, testResultsStage1[i].value, testResultsStage2[i]?.value, testResultsStage3[i]);
          const { browser, incognito, tor, nightly } = browserList[i];
          allTests.push({
            browser,
            incognito,
            tor,
            nightly,
            testResults,
            timeStarted,
            reportedVersion: await browserSessions[i].browser.version(),
            os: os.type(),
            os_version: os.version()
          });
        }
      } catch (e) {
        log(e);
        await DesktopBrowser.setGlobalProxyUsageEnabled(false);
      }
      if (!debug) {
        for (const browserSession of browserSessions) {
          closeWebSocket(browserSession.websocket);
          try {
            console.log(`killing ${browserSession.browser.browser}`);
            await browserSession.browser.kill();
          } catch (e) {
            log(e);
          }
        }
      }
    }
  }
  log('FAILURES: ', failures);
  cookieProxy.stopMitmProxy();
  const timeStopped = new Date().toISOString();
  let platform;
  if (android) {
    platform = 'Android';
  } else if (ios) {
    platform = 'iOS';
  } else {
    platform = 'Desktop';
  }
  return { all_tests: allTests, git: gitHash(), timeStarted, timeStopped, platform };
};

// ## Writing results

// Takes our results in a JSON object and writes them to disk.
// The file name looks like `yyyymmdd__HHMMss.json`.
const writeDataSync = ({ path, filename, data }) => {
  let filePath;
  if (path !== undefined) {
    filePath = path;
  } else {
    const dateString = dateFormat(new Date(), 'yyyymmdd', true);
    const fileStub = filename ?? dateFormat(new Date(), 'HHMMss', true);
    const dir = `../results/${dateString}`;
    fs.mkdirSync(dir, { recursive: true });
    filePath = `${dir}/${fileStub}.json`;
  }
  fs.writeFileSync(filePath, JSON.stringify(data));
  log(`Wrote results to "${filePath}".`);
  return filePath;
};

// ## Config files

const readConfig = (commandLineData) => {
  const defaultConfig = { aggregate: true, repeat: 1, debug: false, update: false };
  const configFile = commandLineData._[0];
  delete commandLineData._;
  const commandLineBrowsers = commandLineData.browsers ?? commandLineData.browser;
  if (commandLineBrowsers) {
    commandLineData.browsers = commandLineBrowsers.split(',');
  }
  if (commandLineData.except) {
    commandLineData.except = commandLineData.except.split(',');
  }
  if (commandLineData.skip) {
    commandLineData.skip = commandLineData.skip.split(',');
  }
  if (commandLineData.categories) {
    commandLineData.categories = commandLineData.categories.split(',');
  }
  const yamlConfig = configFile ? readYAMLFile(configFile) : null;
  const config = Object.assign({}, defaultConfig, yamlConfig, commandLineData);
  if (!config.categories) {
    config.categories = [
      'session', 'main', 'supplementary', 'misc', 'https', 'trackingCookies', 'dns'
    ];
  }
  if (config.skip) {
    for (const skipCategory of config.skip) {
      config.categories = config.categories.filter(cat => cat !== skipCategory);
    }
  }
  return config;
};

const configToBrowserList = (config) => {
  const browserList = [];
  for (const browser of config.browsers) {
    if (!(config.except && config.except.includes(browser))) {
      browserList.push({
        browser,
        nightly: !!config.nightly,
        incognito: !!config.incognito,
        android: !!config.android,
        tor: !!config.tor,
        ios: !!config.ios,
        appDir: config['app-dir']
      });
    }
  }
  return browserList;
};

let cleanupRan = false;
let originalDnsIps;
const cleanup = async () => {
  if (cleanupRan) {
    return;
  }
  log('cleaning up');
  await DesktopBrowser.setGlobalProxyUsageEnabled(false);
  const preferredNetworkService = systemNetworkSettings.getPreferredNetworkService();
  systemNetworkSettings.setDNS(preferredNetworkService, originalDnsIps);
  cleanupRan = true;
};

// Output all versions of browsers in config to the console.
const showVersions = async (config) => {
  const browserList = configToBrowserList(config);
  const versionData = await Promise.all(browserList.map(async browserSpec => {
    const browserObject = createBrowserObject(browserSpec);
    const version = await browserObject.version();
    return { name: browserSpec.browser, version };
  }));
  const versionDataSorted = versionData.sort((a, b) => a.name < b.name ? -1 : 1);
  for (const { name, version } of versionDataSorted) {
    log(name, version);
  }
};

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

const killAll = (config) => {
  const browserList = configToBrowserList(config);
  DesktopBrowser.killAll(browserList.map(item => item.browser));
};

// ## Main program

// Reads in command-line arguments, config file, runs the required
// tests, writes them to a JSON data file, and then renders results to
// a human-readable web page.
const main = async () => {
  ['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'SIGTERM'].forEach((eventType) => {
    process.on(eventType, (code) => {
      log(eventType, code);
      cleanup(eventType);
      process.exit(eventType === 'uncaughtException' ? 1 : 0);
    });
  });
  try {
    installTestFontIfNeeded();
    await DesktopBrowser.setGlobalProxyUsageEnabled(false);
    const preferredNetworkService = systemNetworkSettings.getPreferredNetworkService();
    originalDnsIps = systemNetworkSettings.getDNS(preferredNetworkService);
    const activeVpnCount = await DesktopBrowser.countActiveVpns();
    if (activeVpnCount > 0) {
      console.log(`VPNs detected: ${activeVpnCount}. Please disable all VPNs.`);
      throw new Error('Active VPN detected.');
    }
    // Read config file and flags from command line
    const commandLineData = minimist(process.argv.slice(2));
    const config = readConfig(commandLineData);
    log({ config });
    if (config.update) {
      await updateAll(config);
      process.exit();
      // Program has ended.
    }
    if (config.kill) {
      killAll(config);
      process.exit();
    }
    if (config.versions || config.version) {
      await showVersions(config);
      return;
    }
    const expandedBrowserList = configToBrowserList(config);
    log('List of browsers to run:', expandedBrowserList);
    const browserLists = (config.android || config.ios) ? expandedBrowserList.map(x => [x]) : [expandedBrowserList];
    const testResults = await runTestsBatch(browserLists, config);
    const dataFile = writeDataSync({
      filename: config.filename,
      data: testResults,
      path: config.out
    });
    await render.render({ dataFiles: [dataFile], aggregate: config.aggregate });
    if (!config.debug) {
      process.exit();
    }
  } catch (e) {
    log(e);
  }
};

if (require.main === module) {
  main();
}
