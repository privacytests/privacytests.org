// # index.js: Runs tests on browsers defined in a YAML config file.
// Usage: node index production.yaml

// ## imports

const fs = require('fs');
const { exec } = require('child_process');
const execAsync = require('util').promisify(exec);
const minimist = require('minimist');
const dateFormat = require('dateformat');
const YAML = require('yaml');

const { createDriver, navigate, openNewTab, waitForAttribute, quit } = require('./webdriver_utils.js');
const render = require('./render');

const DEFAULT_TIMEOUT_MS = 30000;

// ## Utility functions

// Returns a promise that sleeps for the given millseconds.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Returns a deep copy of a JSON object.
const deepCopy = (x) => JSON.parse(JSON.stringify(x));

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
let gitHash = async () => {
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
let loadAndGetResults = async (driver, url, newTab = false, timeout = DEFAULT_TIMEOUT_MS) => {
  if (newTab) {
    let tab = await openNewTab(driver);
    await driver.switchTo().window(tab);
  }
  console.log(`loading ${url}`);
  await navigate(driver, url);
  let testResultsString =
      await waitForAttribute(driver, "body", "data-test-results", timeout);
  return testResultsString === "undefined" ? undefined : JSON.parse(testResultsString);
};

// Causes driver to connect to our supercookie tests. Returns
// a map of test names to test results.
let runSupercookieTests = async (driver, newTabs) => {
  let stem = newTabs ? "supercookies" : "navigation";
  let secret = Math.random().toString().slice(2);
  let iframe_root_same = false ? "http://localhost:8080" : "https://arthuredelstein.net/browser-privacy";
  let iframe_root_different = false ? "http://localhost:8080" : "https://arthuredelstein.github.io/browser-privacy";
  let writeResults = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/${stem}.html?mode=write&default=${secret}`, true);
//  console.log("writeResults:", writeResults, typeof(writeResults));
  let readParams = "";
  for (let [test, data] of Object.entries(writeResults)) {
    if ((typeof data["result"]) === "string") {
      readParams += `&${test}=${encodeURIComponent(data["result"])}`;
    }
  }
  //  console.log(readParams);
//  await sleep(5000);
  let readResultsSameFirstParty = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/${stem}.html?mode=read${readParams}`, newTabs);
  //  console.log("readResultsSameFirstParty:", readResultsSameFirstParty);
  //await sleep(5000);
  let readResultsDifferentFirstParty = await loadAndGetResults(
    driver, `${iframe_root_different}/tests/${stem}.html?mode=read${readParams}`, newTabs);
  let jointResult = {};
  for (let test in readResultsDifferentFirstParty) {
    let { write, read, result: readDifferentFirstParty } = readResultsDifferentFirstParty[test];
    let { result: readSameFirstParty } = readResultsSameFirstParty[test];
    let readSameFirstPartyFailedToFetch = readSameFirstParty ? readSameFirstParty.startsWith("Error: Failed to fetch") : false;
    let readDifferentFirstPartyFailedToFetch = readDifferentFirstParty ? readDifferentFirstParty.startsWith("Error: Failed to fetch") : false;
    let testFailed = !readSameFirstParty || (readSameFirstParty.startsWith("Error:") && !readSameFirstPartyFailedToFetch);
let passed = testFailed ? undefined : ((readSameFirstParty !== readDifferentFirstParty) ||
                                       (readSameFirstPartyFailedToFetch && readDifferentFirstPartyFailedToFetch));
    jointResult[test] = { write, read, readSameFirstParty, readDifferentFirstParty, passed, testFailed };
  }
//  console.log("readResultsDifferentFirstParty:", readResultsDifferentFirstParty);
  return jointResult;
};

// Tests if a top-level page that can be upgraded to https is upgraded.
// The argument getOrNavigate should be "get" or "navigate".
let testUpgrade = async (driver, getOrNavigate) => {
  await driver[getOrNavigate]("http://upgradable.arthuredelstein.net/");
  let resultingUrl = await driver.getCurrentUrl();
  let upgraded = resultingUrl.startsWith("https");
  let passed = upgraded === true;
  return { passed, upgraded };
}

// See if the browser blocks visits to HTTP sites (aka HTTPS-Only Mode)
let testHttpsOnlyMode = async (driver) => {
  try {
    await driver.get("http://insecure.arthuredelstein.net/");
    return { passed: false, result: "allowed" };
  } catch (e) {
    // Error page
    return { passed: true, result: "error page" };
  }
};

// Run all of our network privacy tests.
let runNetworkTests = async (driver) => {
  let results = await loadAndGetResults(
    driver, 'https://arthuredelstein.net/browser-privacy/tests/network.html');
  results["Upgradable address"] = await testUpgrade(driver, "get");
  results["Upgradable link"] = await testUpgrade(driver, "navigate");
  results["Insecure website"] = await testHttpsOnlyMode(driver);
  return results;
};


// Run all of our privacy tests using selenium. Returns
// a map of test types to test result maps. Such as:
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... }
//   "network" : { ... }
//   "supercookies" : { ... } }
let runTests = async (driver) => {
  try {
    let fingerprinting = await loadAndGetResults(
      driver, 'https://arthuredelstein.net/browser-privacy/tests/fingerprinting.html');
    let network = await runNetworkTests(driver);
    let supercookies = await runSupercookieTests(driver, true);
    let navigation = await runSupercookieTests(driver, false);
    // Move ServiceWorker from supercookies to navigation :P
    supercookies["ServiceWorker"] = navigation["ServiceWorker"];
    delete navigation["ServiceWorker"];
    return { fingerprinting, network, supercookies, navigation };
  } catch (e) {
    console.log(e);
    return null;
  }
};

// Runs a batch of tests (multiple browsers) for a given driver.
// Returns results in a JSON object.
let runTestsBatch = async (configList, {shouldQuit} = {shouldQuit:true}) => {
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
      let testResults = await runTests(driver);
//      console.log({shouldQuit});
      all_tests.push({ browser, capabilities: fullCapabilities, testResults, timeStarted,
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
let writeDataSync = (data) => {
  let dateStub = dateFormat(new Date(), "yyyymmdd_HHMMss", true);
  let filePath = `out/results/${dateStub}.json`;
  fs.mkdirSync("out/results", { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
  console.log(`Wrote results to "${filePath}".`);
};

// Takes a list of browser configs, and repeats or removes them as needed.
let expandConfigList = async (configList, repeat) => {
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

// Read config file in YAML or JSON.
let parseConfigFile = (configFile) => {
  let configFileContents = fs.readFileSync(configFile, 'utf8');
  return YAML.parse(configFileContents);
};

// The main program
let main = async () => {
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
    let configList = parseConfigFile(configFile);
    let expandedConfigList = await expandConfigList(configList, repeat);
    let filteredExpandedConfigList = expandedConfigList.filter(
      d => only ? d.browser.startsWith(only) : true);
    console.log("List of browsers to run:", filteredExpandedConfigList);
    writeDataSync(await runTestsBatch(filteredExpandedConfigList,
                                      { shouldQuit: !stayOpen }));
    render.main();
  }
};

main();
