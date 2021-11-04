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
const { Browser } = require("./browser.js");

// ## Utility functions

// Returns a deep copy of a JSON object.
const deepCopy = (x) => JSON.parse(JSON.stringify(x));

// Returns a promise that sleeps for the given millseconds.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
const gitHash = () => execSync('git rev-parse HEAD', { cwd: __dirname}).toString().trim();

// Fetch results from a json API.
const fetchJSON = async (...fetchArgs) => {
  let response = await fetch(...fetchArgs);
  return response.json();
};

// Fetch server reflexive IP address
const fetch_ipAddress = async () => {
  const wtfismyip = await fetchJSON("https://wtfismyip.com/json");
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

// ## Testing

// We use two domains for supercookies and navigation tests.
// The "same" domain is the one that is used for simluated third-party tracker
// and one of the two first parties. The "different" domain is the other
// first party we use.
const iframe_root_same = "https://arthuredelstein.net/test-pages";
const iframe_root_different = "https://test-pages.privacytests.org";

// Borrowed from https://github.com/brave/brave-core/blob/50df76971db6a6023b3db9aead0827606162dc9c/browser/net/brave_site_hacks_network_delegate_helper.cc#L29
// and https://github.com/jparise/chrome-utm-stripper:
const TRACKING_QUERY_PARAMETERS =
  {
    // https://github.com/brave/brave-browser/issues/4239
    "fbclid": "Facebook Click Identifier",
    "gclid": "Google Click Identifier",
    "msclkid": "Microsoft Click ID",
    "mc_eid": "Mailchimp Email ID (email recipient's address)",
    // https://github.com/brave/brave-browser/issues/9879
    "dclid": "DoubleClick Click ID (Google)",
    // https://github.com/brave/brave-browser/issues/13644
    "oly_anon_id": "Omeda marketing 'anonymous' customer id",
    "oly_enc_id": "Omeda marketing 'known' customer id",
    // https://github.com/brave/brave-browser/issues/11579
    "_openstat": "Yandex tracking parameter",
    // https://github.com/brave/brave-browser/issues/11817
    "vero_conv": "Vero tracking parameter",
    "vero_id": "Vero tracking parameter",
    // https://github.com/brave/brave-browser/issues/13647
    "wickedid": "Wicked Reports e-commerce tracking",
    // https://github.com/brave/brave-browser/issues/11578
    "yclid": "Yandex Click ID",
    // https://github.com/brave/brave-browser/issues/8975
    "__s": "Drip.com email address tracking parameter",
    // https://github.com/brave/brave-browser/issues/17451
    "rb_clickid": "Unknown high-entropy tracking parameter",
    // https://github.com/brave/brave-browser/issues/17452
    "s_cid": "Adobe Site Catalyst tracking parameter",
    // https://github.com/brave/brave-browser/issues/17507
    "ml_subscriber": "MailerLite email tracking",
    "ml_subscriber_hash": "MailerLite email tracking",
    // https://github.com/brave/brave-browser/issues/9019
    "_hsenc": "HubSpot tracking parameter",
    "__hssc": "HubSpot tracking parameter",
    "__hstc": "HubSpot tracking parameter",
    "__hsfp": "HubSpot tracking parameter",
    "hsCtaTracking": "HubSpot tracking parameter",
    // https://github.com/jparise/chrome-utm-stripper
    "mkt_tok": "Adobe Marketo tracking parameter",
    "igshid": "Instagram tracking parameter",
  };

// Takes the results of supercookie or navigation tests
const getJointResult = (writeResults, readResultsSameFirstParty, readResultsDifferentFirstParty) => {
  let jointResult = {};
  for (let test in readResultsDifferentFirstParty) {
    let { write, read, description, result: readDifferentFirstParty } = readResultsDifferentFirstParty[test];
    let { result: readSameFirstParty } = readResultsSameFirstParty[test];
    let { result: writeResult } = writeResults[test];
    let unsupported = (writeResult === "Error: Unsupported");
    let readSameFirstPartyFailedToFetch = readSameFirstParty ? readSameFirstParty.startsWith("Error: Failed to fetch") : false;
    let readDifferentFirstPartyFailedToFetch = readDifferentFirstParty ? readDifferentFirstParty.startsWith("Error: Failed to fetch") : false;
    unsupported = unsupported || (readSameFirstParty ? readSameFirstParty.startsWith("Error: No requests received") : false);
    unsupported = unsupported || (readSameFirstParty ? readSameFirstParty.startsWith("Error: image load failed") : false);
    let testFailed = !unsupported && (!readSameFirstParty || (readSameFirstParty.startsWith("Error:") && !readSameFirstPartyFailedToFetch));
    let passed = (testFailed || unsupported) ?
      undefined :
      (readSameFirstParty !== readDifferentFirstParty) ||
      (readSameFirstPartyFailedToFetch && readDifferentFirstPartyFailedToFetch);
    jointResult[test] = { write, read, unsupported, readSameFirstParty, readDifferentFirstParty, passed, testFailed, description };
  }
  return jointResult;
};

// Supercookie tests. Returns { "test1": { results1 }, "test2": ... }
const runSupercookieTests = async (browser) => {
  const secret = Math.random().toString().slice(2);
  const writeResults = await browser.runTest(`${iframe_root_same}/supercookies.html?mode=write&default=${secret}`);
  let readParams = "";
  for (let [test, data] of Object.entries(writeResults)) {
    if ((typeof data["result"]) === "string") {
      readParams += `&${test}=${encodeURIComponent(data["result"])}`;
    }
  }
  const readResultsSameFirstParty = await browser.runTest(`${iframe_root_same}/supercookies.html?mode=read${readParams}`);
  const readResultsDifferentFirstParty = await browser.runTest(`${iframe_root_different}/supercookies.html?mode=read${readParams}`);
  const supercookies = getJointResult(writeResults, readResultsSameFirstParty, readResultsDifferentFirstParty);
  return supercookies;
};

// Navigation tests. Returns { "test1": { results1 }, "test2": ... }
const runNavigationTests = async (browser) => {
  const secret = Math.random().toString().slice(2);
  const [writeResults2, readResultsSameFirstParty2, readResultsDifferentFirstParty2] = await browser.runTest(`${iframe_root_same}/navigation.html?mode=write&default=${secret}`, 3);
  const navigation = getJointResult(writeResults2, readResultsSameFirstParty2, readResultsDifferentFirstParty2);
  return navigation;
};

// Fingerprinting tests. Returns { "test1": { results1 }, "test2": ... }
const runFingerprintingTests = async (browser) => {
  return await browser.runTest(`${iframe_root_same}/fingerprinting.html`);
};

// Misc tests. Returns { "test1": { results1 }, "test2": ... }
const runMiscTests = async (browser) => {
  const ipAddress = await fetch_ipAddress();
  console.log({ ipAddress });
  const misc = await browser.runTest(`${iframe_root_same}/misc.html`);
  // Complete the IP address leak test. Do websites see the same IP address that
  // this script does?
  const misc_ipAddressLeak = misc["IP address leak"];
  let browser_ipAddress = misc_ipAddressLeak["ipAddress"];
  // Don't record the actual IP address (for privacy)
  delete misc_ipAddressLeak["ipAddress"];
  misc_ipAddressLeak["IP addressed masked"] = ipAddress !== browser_ipAddress;
  misc_ipAddressLeak["passed"] = misc_ipAddressLeak["IP addressed masked"];
  return misc;
};

// Generate the test URL for our tracking query parameter tests.
// Takes each of the parameters in the form { k1: v1, ... } and
// return a string URL with query string.
const queryParameterTestUrl = (parameters) => {
  let secret = Math.random().toString().slice(2);
  let baseURL = "https://arthuredelstein.net/test-pages/query.html";
  let queryString = `?controlParam=controlValue`;
  for (let param of Object.keys(parameters)) {
    queryString += `&${param}=${secret}`;
  }
  return baseURL + queryString;
};

// Tracking query parameter tests. Returns { "test1": { results1 }, "test2": ... }
const runQueryTests = async (browser) => {
  const queryParametersRaw = await browser.runTest(queryParameterTestUrl(TRACKING_QUERY_PARAMETERS));
  let queryParameters = {};
  for (let param of Object.keys(TRACKING_QUERY_PARAMETERS)) {
      queryParameters[param] = {
      value: queryParametersRaw[param],
      passed: (queryParametersRaw[param] === undefined),
      description: TRACKING_QUERY_PARAMETERS[param],
    };
  }
  return queryParameters;
};

// HTTPS tests. Returns { "test1": { results1 }, "test2": ... }
const runHttpsTests = async (browser) => {
  const https1 = await browser.runTest(`${iframe_root_same}/https.html`);
  const [https2, https3] = await browser.runTest(
    `http://upgradable.arthuredelstein.net/upgradable.html?source=address`, 2);
  const https4Promise = browser.runTest(`http://insecure.arthuredelstein.net/insecure.html`);
  const result = await Promise.race([sleep(10000), https4Promise]);
  const https4 = result === undefined ?
    { "Insecure website": { passed: true, result: "Insecure website never loaded" } } :
    await https4Promise;
  const https = Object.assign({}, https1, https2, https3, https4); // Merge results
  return https;
};

// Move a test from a source map to a destination map. (Mutates both maps.)
const moveTestBetweenCategories = (testName, src, dest) => {
  dest[testName] = src[testName];
  delete src[testName];
};

// Run all of our privacy tests using selenium for a given driver. Returns
// a map of test types to test result maps. Such as
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... },
//   "misc" : { ... },
//   "https" : { ... },
//   "navigation" : { ... },
//   "supercookies" : { ... } }
const runTests = async (browser) => {
  try {
    const supercookies = await runSupercookieTests(browser);
    const navigation = await runNavigationTests(browser);
    const fingerprinting = await runFingerprintingTests(browser);
    const misc = await runMiscTests(browser);
    const query = await runQueryTests(browser);
    const https = await runHttpsTests(browser); // Merge results
    // Move tests around to better categories:
    moveTestBetweenCategories("ServiceWorker", navigation, supercookies);
    moveTestBetweenCategories("Stream isolation", supercookies, misc);
    return { supercookies, navigation, fingerprinting, misc, query, https };
  } catch (e) {
    console.log(e);
    return null;
  }
};

// Runs a batch of tests (multiple browsers).
// Returns results in a JSON object.
const runTestsBatch = async (configList, {shouldQuit} = {shouldQuit:true}) => {
  let all_tests = [];
  let timeStarted = new Date().toISOString();
  for (let config of configList) {
    try {
      console.log("\nnext test:", config);
      const { browser, incognito, tor, nightly } = config;
      const timeStarted = new Date().toISOString();
      const browserObject = new Browser(config);
      await browserObject.launch();
      const testResults = await runTests(browserObject);
      all_tests.push({
        browser, incognito, tor, nightly,
        testResults, timeStarted,
        reportedVersion: browserObject.version,
        os: os.type(), os_version: os.version(),
      });
      if (shouldQuit) {
        await browserObject.kill();
      }
    } catch (e) {
      console.log(e);
    }
  }
  const timeStopped = new Date().toISOString();
  return { all_tests, git: gitHash(), timeStarted, timeStopped };
};

// ## Writing results

// Takes our results in a JSON object and writes them to disk.
// The file name looks like `yyyymmdd__HHMMss.json`.
const writeDataSync = (data) => {
  let dateStub = dateFormat(new Date(), "yyyymmdd_HHMMss", true);
  let filePath = `out/results/${dateStub}.json`;
  fs.mkdirSync("out/results", { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
  console.log(`Wrote results to "${filePath}".`);
  return filePath;
};

// ## Config files

// Takes a list of browser configs, and repeats or removes them as needed.
const expandConfigList = (configList, repeat = 1) => {
  let results = [];
  for (let config of configList) {
    if (!config.disable) {
      const config2 = deepCopy(config);
      delete config2["repeat"];
      results = [].concat(results, Array((config.repeat ?? 1) * (repeat ?? 1)).fill(config2));
    }
  }
  return results;
};

// Read config file in YAML or JSON.
const parseConfigFile = (configFile, repeat = 1) => {
  let configFileContents = fs.readFileSync(configFile, 'utf8');
  let rawConfigs = YAML.parse(configFileContents);
  return expandConfigList(rawConfigs, repeat);
};

// ## Main program

// Reads in command-line arguments, config file, runs the required
// tests, writes them to a JSON data file, and then renders results to
// a human-readable web page.
const main = async () => {
  installTestFontIfNeeded();
  // Read config file and flags from command line
  let { _ : [configFile], debug, only, repeat, aggregate, nightly } =
    minimist(process.argv.slice(2), opts = { default: { aggregate: true }});
  let configList = parseConfigFile(configFile, repeat);
  let filteredConfigList = configList
      .filter(d => only ? d.browser.startsWith(only) : true)
      .map(d => Object.assign({}, d, {nightly}));
  console.log("List of browsers to run:", filteredConfigList);
  let dataFile = writeDataSync(await runTestsBatch(filteredConfigList,
                                                     { shouldQuit: !debug }));
  render.render({ dataFile, aggregate });
};

main();
