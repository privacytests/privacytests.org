// # index.js: Runs privacy tests on browsers
//
// Define a set of browsers to test in a YAML file.
// Usage: `node index config/production.yaml`

// ## imports

const fs = require('fs');
const { exec } = require('child_process');
const execAsync = require('util').promisify(exec);
const minimist = require('minimist');
const dateFormat = require('dateformat');

const { createDriver, navigate, openNewTab,
        waitForAttribute, quit, parseConfigFile } = require('./webdriver_utils.js');
const render = require('./render');
const { Origin } = require('selenium-webdriver');
const { result } = require('lodash');

const DEFAULT_TIMEOUT_MS = 60000;

// ## Utility functions

// Returns a promise that sleeps for the given millseconds.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
const gitHash = async () => {
  const { stdout, stderr } = await execAsync(
    'git rev-parse HEAD', { cwd: __dirname});
  if (stderr) {
    throw new Error(stderr);
  } else {
    return stdout.trim();
  }
};

// ## Testing

// Tell the selenium driver to visit a url, wait for the attribute
// "data-test-results" to have a value, and resolve that value
// in a promise. Rejects if timeout elapses first.
const loadAndGetResults = async (driver, url, { newTab, timeout, click } = {}) => {
  if (newTab) {
    let tab = await openNewTab(driver);
    await driver.switchTo().window(tab);
  }
  console.log(`loading ${url}`);
  await navigate(driver, url);
  await sleep(1000);
  if (false) { // (click) {
    let actions = driver.actions();
    let body = await driver.findElement({css:"body"});
    await driver.executeScript(`document.body.innerHTML += "<a id='clickLink'>click</a>"`);
    await driver.findElement({id:"clickLink"}).click();
    //await actions.move({origin: body, x: click.x, y:click.y}).click();
    console.log("clicked", click);
  }
  let testResultsString =
      await waitForAttribute(driver, "body", "data-test-results", timeout ?? DEFAULT_TIMEOUT_MS);
  return testResultsString === "undefined" ? undefined : JSON.parse(testResultsString);
};

// Causes driver to connect to our supercookie tests. Returns
// a map of test names to test results.
const runSupercookieTests = async (driver, newTab) => {
  let stem = newTab ? "supercookies" : "navigation";
  let secret = Math.random().toString().slice(2);
  let iframe_root_same = false ? "http://localhost:8080" : "https://arthuredelstein.net/browser-privacy";
  let iframe_root_different = false ? "http://localhost:8080" : "https://arthuredelstein.github.io/privacytests.org";
  let writeResults = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/${stem}.html?mode=write&default=${secret}`, {newTab: true});
  let readParams = "";
  for (let [test, data] of Object.entries(writeResults)) {
    if ((typeof data["result"]) === "string") {
      readParams += `&${test}=${encodeURIComponent(data["result"])}`;
    }
  }
//  console.log({writeResults});
  //  console.log(readParams);
//  await sleep(5000);
  let readResultsSameFirstParty = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/${stem}.html?mode=read${readParams}`, { newTab });
  //  console.log("readResultsSameFirstParty:", readResultsSameFirstParty);
  //await sleep(5000);
  let readResultsDifferentFirstParty = await loadAndGetResults(
    driver, `${iframe_root_different}/tests/${stem}.html?mode=read${readParams}`, { newTab });
  let jointResult = {};
  for (let test in readResultsDifferentFirstParty) {
    let { write, read, result: readDifferentFirstParty } = readResultsDifferentFirstParty[test];
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
    jointResult[test] = { write, read, unsupported, readSameFirstParty, readDifferentFirstParty, passed, testFailed };
  }
//  console.log("readResultsDifferentFirstParty:", readResultsDifferentFirstParty);
  return jointResult;
};

// Borrowed from https://github.com/brave/brave-core/blob/50df76971db6a6023b3db9aead0827606162dc9c/browser/net/brave_site_hacks_network_delegate_helper.cc#L29
// and https://github.com/jparise/chrome-utm-stripper:
const TRACKING_QUERY_PARAMETERS =
  [
    // https://github.com/brave/brave-browser/issues/4239
    "fbclid", "gclid", "msclkid", "mc_eid",
    // https://github.com/brave/brave-browser/issues/9879
    "dclid",
    // https://github.com/brave/brave-browser/issues/13644
    "oly_anon_id", "oly_enc_id",
    // https://github.com/brave/brave-browser/issues/11579
    "_openstat",
    // https://github.com/brave/brave-browser/issues/11817
    "vero_conv", "vero_id",
    // https://github.com/brave/brave-browser/issues/13647
    "wickedid",
    // https://github.com/brave/brave-browser/issues/11578
    "yclid",
    // https://github.com/brave/brave-browser/issues/8975
    "__s",
    // https://github.com/brave/brave-browser/issues/17451
    "rb_clickid",
    // https://github.com/brave/brave-browser/issues/17452
    "s_cid",
    // https://github.com/brave/brave-browser/issues/17507
    "ml_subscriber", "ml_subscriber_hash",
    // https://github.com/brave/brave-browser/issues/9019
    "_hsenc", "__hssc", "__hstc", "__hsfp", "hsCtaTracking",
    // https://github.com/jparise/chrome-utm-stripper
    "mkt_tok", "igshid"
  ];

const runQueryParameterTests = async (driver, paramNames) => {
  let secret = Math.random().toString().slice(2);
  let baseURL = "https://arthuredelstein.net/browser-privacy-params/";
  let queryString = "?controlParam=controlValue";
  for (let param of paramNames) {
    queryString += `&${param}=${secret}`;
  }
  let reported = await loadAndGetResults(driver, baseURL + queryString);
  let result = {};
  for (let param of paramNames) {
    result[param] = {
      value: reported[param],
      passed: (reported[param] === undefined)
    };
  }
  return result;
};

const runNavigationTests = async (driver) => {
  return runSupercookieTests(driver, false);
};

// Tests if a top-level page that can be upgraded to https is upgraded.
// The argument getOrNavigate should be "get" or "navigate".
const testHttpsUpgrade = async (driver, getOrNavigate) => {
  await driver[getOrNavigate]("http://upgradable.arthuredelstein.net/");
  let resultingUrl = await driver.getCurrentUrl();
  let upgraded = resultingUrl.startsWith("https");
  let passed = upgraded === true;
  return { passed, upgraded };
};

// See if the browser blocks visits to HTTP sites (aka HTTPS-Only Mode)
const testHttpsOnlyMode = async (driver) => {
  try {
    await driver.get("http://insecure.arthuredelstein.net/");
    return { passed: false, result: "allowed" };
  } catch (e) {
    // Error page
    return { passed: true, result: "error page" };
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

// Run all of our miscellaneous privacy tests.
const runMiscTests = async (driver) => {
  return await loadAndGetResults(
    driver, 'https://arthuredelstein.net/browser-privacy/tests/misc.html', {newTab: true});
};

const versionPaths = {
  "firefox": {
    url: "about:support",
    cssPath: "#version-box"
  },
  "tor": {
    url: "about:tor",
    cssPath: "#torbrowser-version",
    regex: "\\s[0-9,\\.]+"
  },
  "brave": {
    url: "brave://version",
    cssPath: "#version span",
    regex: "^[0-9,\\.]+"
  },
  "edge": {
    url: "edge://version",
    cssPath: "#version span",
    regex: "^[0-9,\\.]+"
  },
  "chrome": {
    url: "chrome://version",
    cssPath: "#version span",
    regex: "^[0-9,\\.]+"
  },
  "opera": {
    url: "https://example.com",
    expression: () => navigator.userAgent.match("OPR\/([0-9,\\.]+)")[1]
  }
};

const readVersion = async (driver, browser) => {
  let { url, cssPath, regex, expression } = versionPaths[browser];
  await driver.get(url);
  let result;
  if (cssPath) {
    let element = driver.findElement({css: cssPath});
    let content = await element.getText();
    result = regex ? content.match(regex)[0] : content;
  } else {
    result = await driver.executeScript(expression);
  }
  return result.trim();
};

// Run all of our privacy tests using selenium. Returns
// a map of test types to test result maps. Such as
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... },
//   "misc" : { ... },
//   "https" : { ... },
//   "navigation" : { ... },
//   "supercookies" : { ... } }
const runTests = async (driver) => {
  try {
    let fingerprinting = await loadAndGetResults(
      driver, 'https://arthuredelstein.net/browser-privacy/tests/fingerprinting.html', { newTab: true, click: {x: 10, y: 10}});
    let https = await runHttpsTests(driver);
    let misc = await runMiscTests(driver);
    let supercookies = await runSupercookieTests(driver, true);
    let navigation = await runNavigationTests(driver);
    let query = await runQueryParameterTests(driver, TRACKING_QUERY_PARAMETERS);
    // Move ServiceWorker from supercookies to navigation :P
    supercookies["ServiceWorker"] = navigation["ServiceWorker"];
    delete navigation["ServiceWorker"];
    return { fingerprinting, misc, https, supercookies, navigation, query };
  } catch (e) {
    console.log(e);
    return null;
  }
};

// Runs a batch of tests (multiple browsers) for a given driver.
// Returns results in a JSON object.
const runTestsBatch = async (configList, {shouldQuit} = {shouldQuit:true}) => {
  let all_tests = [];
  let timeStarted = new Date().toISOString();
  let git = await gitHash();
  for (let config of configList) {
    try {
      let { browser, prefs, incognito, tor_mode } = config;
      console.log("\ncreating driver:", config);
      let driver = await createDriver(config);
//      console.log("driver", driver);
      let fullCapabilitiesMap = (await driver.getCapabilities())["map_"];
      let fullCapabilities = Object.fromEntries(fullCapabilitiesMap.entries());
//      console.log('fullCapabilities', fullCapabilities);
      let timeStarted = new Date().toISOString();
      let reportedVersion = await readVersion(driver, browser);
      console.log("${browser} version found:", reportedVersion);
      let testResults = await runTests(driver);
//      console.log({shouldQuit});
      all_tests.push({ browser, reportedVersion, capabilities: fullCapabilities,
                       testResults, timeStarted,
                       prefs, incognito, tor_mode });
      if (shouldQuit) {
        await quit(driver);
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
  let { _ : [configFile], stayOpen, only, list, repeat } = minimist(process.argv.slice(2));
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
                                                     { shouldQuit: !stayOpen }));
    render.render({ dataFile });
  }
};

main();
