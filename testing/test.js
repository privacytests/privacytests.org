// # test.js: Runs privacy tests on browsers
//
// Define a set of browsers to test in a YAML file.
// Usage: `node index config/production.yaml`

// ## imports

const fs = require('fs');
const { execSync } = require('child_process');
const minimist = require('minimist');
const dateFormat = require('dateformat');
const YAML = require('yaml');
const os = require('os');
const { connect } = require("it-ws/client");

const render = require('./render');
const { Browser } = require("./browser.js");

const DEFAULT_TIMEOUT_MS = 60000;

// ## Utility functions

// Returns a deep copy of a JSON object.
const deepCopy = (x) => JSON.parse(JSON.stringify(x));

// Read config file in YAML or JSON.
const parseConfigFile = (configFile, repeat = 1) => {
  let configFileContents = fs.readFileSync(configFile, 'utf8');
  let rawConfigs = YAML.parse(configFileContents);
  return expandConfigList(rawConfigs, repeat);
};

// Takes a list of browser configs, and repeats or removes them as needed.
const expandConfigList = (configList, repeat = 1) => {
  let results = [];
  for (let config of configList) {
    if (!config.disable) {
      config2 = deepCopy(config);
      delete config2["repeat"];
      results = [].concat(results, Array((config.repeat ?? 1) * (repeat ?? 1)).fill(config2));
    }
  }
  return results;
};

// Returns a promise that sleeps for the given millseconds.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
const gitHash = () => execSync('git rev-parse HEAD', { cwd: __dirname}).toString().trim();

// ## Testing

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

const queryParameterTestUrl = (sessionId, parameters) => {
  let secret = Math.random().toString().slice(2);
  let baseURL = "https://arthuredelstein.net/browser-privacy/tests/query.html";
  let queryString = `?sessionId=${sessionId}&controlParam=controlValue`;
  for (let param of Object.keys(parameters)) {
    queryString += `&${param}=${secret}`;
  }
  return baseURL + queryString;
};

// Tests if a top-level page that can be upgraded to https is upgraded.
// The argument getOrNavigate should be "get" or "navigate".
const testHttpsUpgrade = async (driver, getOrNavigate) => {
  const descriptions = {
    "get" : "Checks to see if an insecure address pasted into the browser's address bar is upgraded to HTTPS whenever possible.",
    "navigate": "Checks to see if the user has clicked on a hyperlink to an insecure address, if the browser upgrades that address to HTTPS whenever possible.",
  };
  await driver[getOrNavigate]("http://upgradable.arthuredelstein.net/");
  let resultingUrl = await driver.getCurrentUrl();
  let upgraded = resultingUrl.startsWith("https");
  let passed = upgraded === true;
  return { passed, upgraded, description: descriptions[getOrNavigate] };
};

// See if the browser blocks visits to HTTP sites (aka HTTPS-Only Mode)
const testHttpsOnlyMode = async (driver) => {
  const description = "Checks to see if the browser stops loading an insecure website and warns the user before giving them the option to continue. Known as HTTPS-Only Mode in some browsers.";
  try {
    await driver.get("http://insecure.arthuredelstein.net/");
    return { passed: false, result: "allowed", description };
  } catch (e) {
    // Error page
    return { passed: true, result: "error page", description };
  }
};

// Run all of our https privacy tests.
const runHttpsTests = async (driver) => {
  let results = await loadAndGetResults(
    driver, 'https://arthuredelstein.net/browser-privacy/tests/https.html', {newTab: true});
  results["Upgradable address"] = await testHttpsUpgrade(driver, "get");
  results["Upgradable hyperlink"] = await testHttpsUpgrade(driver, "navigate");
  results["Insecure website"] = await testHttpsOnlyMode(driver);
  return results;
};

const nextValue = async(websocket, expectedSessionId) => {
  const message = await websocket.source.next();
  const { sessionId, data } = JSON.parse(message.value);
  if (sessionId !== expectedSessionId) {
    throw new Error("Unexpected sessionId");
  }
  return data;
};


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
    let passed = (testFailed || unsupported)
      ? undefined
      : (readSameFirstParty !== readDifferentFirstParty) ||
      (readSameFirstPartyFailedToFetch && readDifferentFirstPartyFailedToFetch);
    jointResult[test] = { write, read, unsupported, readSameFirstParty, readDifferentFirstParty, passed, testFailed, description };
  }
  return jointResult;
}

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
    const resultsWebSocket = connect("wss://results.privacytests.org/ws");
    const firstMessage = await resultsWebSocket.source.next();
    const { sessionId } = JSON.parse(firstMessage.value);
    
    browser.openUrl(`https://arthuredelstein.net/browser-privacy/tests/fingerprinting.html?sessionId=${sessionId}`);
    const fingerprinting = await nextValue(resultsWebSocket, sessionId);
    
    browser.openUrl(`https://arthuredelstein.net/browser-privacy/tests/misc.html?sessionId=${sessionId}`);
    const misc = await nextValue(resultsWebSocket, sessionId);
    
    browser.openUrl(`https://arthuredelstein.net/browser-privacy/tests/https.html?sessionId=${sessionId}`);
    const https = await nextValue(resultsWebSocket, sessionId);

    browser.openUrl(queryParameterTestUrl(sessionId, TRACKING_QUERY_PARAMETERS));
    const queryParametersFound = await nextValue(resultsWebSocket, sessionId);
    const query = {};
    for (let param of Object.keys(TRACKING_QUERY_PARAMETERS)) {
      query[param] = {
        value: queryParametersFound[param],
        passed: (queryParametersFound[param] === undefined),
        description: TRACKING_QUERY_PARAMETERS[param],
      };
    }

    let secret = Math.random().toString().slice(2);
    let iframe_root_same = "https://arthuredelstein.net/browser-privacy";
    let iframe_root_different = "https://arthuredelstein.github.io/privacytests.org";

    // Supercookies
    const stem = "supercookies";
    browser.openUrl(`${iframe_root_same}/tests/${stem}.html?mode=write&default=${secret}&sessionId=${sessionId}`);
    let writeResults = await nextValue(resultsWebSocket, sessionId);
    let readParams = "";
    for (let [test, data] of Object.entries(writeResults)) {
      if ((typeof data["result"]) === "string") {
        readParams += `&${test}=${encodeURIComponent(data["result"])}`;
      }
    }
    browser.openUrl(`${iframe_root_same}/tests/${stem}.html?mode=read&sessionId=${sessionId}${readParams}`);
    let readResultsSameFirstParty = await nextValue(resultsWebSocket, sessionId);
    browser.openUrl(`${iframe_root_different}/tests/${stem}.html?mode=read&sessionId=${sessionId}${readParams}`);
    let readResultsDifferentFirstParty = await nextValue(resultsWebSocket, sessionId);
    let supercookies = getJointResult(writeResults, readResultsSameFirstParty, readResultsDifferentFirstParty);

    // Navigation
    browser.openUrl(`${iframe_root_same}/tests/navigation.html?mode=write&default=${secret}&sessionId=${sessionId}`);
    let writeResults2 = await nextValue(resultsWebSocket, sessionId);
    let readResultsSameFirstParty2 = await nextValue(resultsWebSocket, sessionId);
    let readResultsDifferentFirstParty2 = await nextValue(resultsWebSocket, sessionId);
    let navigation = getJointResult(writeResults2, readResultsSameFirstParty2, readResultsDifferentFirstParty2);

   // let fingerprinting = await loadAndGetResults(
   //   browser, 'https://arthuredelstein.net/browser-privacy/tests/fingerprinting.html');
    //let https = await runHttpsTests(driver);
    //let misc = await runMiscTests(driver);
    //let supercookies = await runSupercookieTests(driver, true);
    //let navigation = await runNavigationTests(driver);
    //let query = await runQueryParameterTests(driver, TRACKING_QUERY_PARAMETERS);
    // Move ServiceWorker from supercookies to navigation :P
    //supercookies["ServiceWorker"] = navigation["ServiceWorker"];
    //delete navigation["ServiceWorker"];
    return { fingerprinting, misc, query, https, supercookies, navigation };
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
  let git = await gitHash();
  for (let config of configList) {
    try {
      let { browser, prefs, incognito, tor } = config;
      console.log("\ncreating driver:", config);
      let browserObject = new Browser(config);
      await browserObject.launch();
      let timeStarted = new Date().toISOString();
      let reportedVersion = browserObject.version;
      console.log(`${browser} version found: ${reportedVersion}`);
      let testResults = await runTests(browserObject);
      //      console.log({shouldQuit});
      //console.log(testResults);
      all_tests.push({ browser, reportedVersion,
                       testResults, timeStarted,
                       capabilities: {os: os.type(), os_version: os.version() },
                       incognito, tor });
      if (shouldQuit) {
        await browserObject.kill();
      }
    } catch (e) {
      console.log(e);
    }
  }
  let timeStopped = new Date().toISOString();
  return { all_tests, git, timeStarted, timeStopped };
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

// The main program
const main = async () => {
  // Read config file and flags from command line
//  logging.installConsoleHandler();
//  logging.getLogger().setLevel(logging.Level.ALL);
//  logging.getLogger("browser").setLevel(logging.Level.ALL);
  let { _ : [configFile], debug, only, list, repeat, aggregate } =
    minimist(process.argv.slice(2), opts = { default: { aggregate: true }});
  if (list) {
    let capabilityList = await fetchBrowserstackCapabilities();
    for (let capability of capabilityList) {
      console.log(capability);
    }
  } else {
    let configList = parseConfigFile(configFile, repeat);
    let filteredConfigList = configList.filter(
      d => only ? d.browser.startsWith(only) : true);
    console.log("List of browsers to run:", filteredConfigList);
    let dataFile = writeDataSync(await runTestsBatch(filteredConfigList,
                                                     { shouldQuit: !debug }));
    render.render({ dataFile, aggregate });
  }
};

main();
