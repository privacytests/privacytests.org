/* jshint esversion: 6 */

// ## imports

const homeDir = require('os').homedir();
const fs = require('fs');
const {Builder, By, Key, until} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const chrome = require('selenium-webdriver/chrome');
const edge = require('selenium-webdriver/edge');
const memoize = require('memoizee');
const fetch = require('node-fetch');
const dateFormat = require('dateformat');
const util = require('util');
const { spawn, exec } = require('child_process');
const execAsync = util.promisify(exec);
const { installDriver } = require('ms-chromium-edge-driver');
const minimist = require('minimist');
const render = require('./render');

require('geckodriver');
require('chromedriver');

// ## Selenium setup

// Read a file called .browserstack.json. The file should contain a JSON
// object that looks like:
// `
// {
//   "user": "my_username",
//   "key": "my_api_key"
// }
// `
let browserstackCredentials = memoize(
  () => JSON.parse(fs.readFileSync(homeDir + "/" + ".browserstack.json")),
  { promise: true });

// Returns a browserstack capabilities object. Required
// for producing a browserstack driver.
let fetchBrowserstackCapabilities = async () => {
  let { user, key } = await browserstackCredentials();
  let results = (await fetch(`https://${user}:${key}@api.browserstack.com/automate/browsers.json`)).json();
//  console.log(await results);
  return results;
};

// Takes a long capability list from browserstack.com, and
// returns a selection of these. We choose the most recent browsers
// and OS versions.
const selectRecentBrowserstackBrowsers = (allCapabilities) => {
  let OSs = new Set();
  let browsers = new Set();
  // Get names of all operating systems and browsers
  for (let { os, browser } of allCapabilities) {
    OSs.add(os);
    browsers.add(browser);
  }
  let selectedCapabilities = [];
  for (let os of OSs) {
    for (let browser of browsers) {
      let capabilities = allCapabilities
          .filter(c => c.os === os && c.browser === browser)
          .filter(c => c.browser !== "opera" && c.browser !== "ie");
      // Find recent versions of operating system
      let os_versions_set = new Set();
      for (let { os_version } of capabilities) {
        os_versions_set.add(os_version);
      }
      let os_versions = [... os_versions_set];
      let mobile = os === "android" || os === "ios";
      // Use most recent os versions.
      let recent_os_versions = (mobile ? os_versions.sort() : os_versions).slice(-1);
      if (recent_os_versions.length > 0) {
        for (let os_version of recent_os_versions) {
          let capabilities2 = capabilities.filter(c => c.os_version === os_version);
          // Use most recent browser version or representative device
          selectedCapabilities = selectedCapabilities.concat(capabilities2.slice(-1));
        }
      }
    }
  }
  console.log(selectedCapabilities);
  return selectedCapabilities;
};

// Produces a selenium driver to run tests on browserstack.com,
// with the given capabilities object.
let browserstackDriver = async (capabilities) => {
  let { user, key } = await browserstackCredentials();
  capabilitiesWithCred = Object.assign(
    {},
    capabilities,
    { "browserstack.user": user,
      "browserstack.key": key });
  let driver = new Builder()
      .usingServer('http://hub-cloud.browserstack.com/wd/hub')
      .withCapabilities(capabilitiesWithCred)
      .build();
  return driver;
};

// Produces a selenium driver to run tests on a local browser,
// using the given capabilities object.
let localDriver = async (capabilities) => {
  let chromeOptions = new chrome.Options();
  if (capabilities.chromeOptions && capabilities.chromeOptions.binary) {
    chromeOptions.setChromeBinaryPath(capabilities.chromeOptions.binary);
  }
  let edgeOptions = new edge.Options();
  const edgePaths = await installDriver();
  edgeOptions.setEdgeChromium(true);
  if (capabilities.path) {
    edgeOptions.setBinaryPath(capabilities.path);
  }
  let builder = new Builder();
  if (capabilities.server) {
    builder = builder.usingServer(capabilities.server);
  }
  let driver = builder.withCapabilities(capabilities)
    .forBrowser(capabilities["browser"])
  //    .setFirefoxOptions(options)
      .setChromeOptions(chromeOptions)
      .setEdgeOptions(edgeOptions)
      .setEdgeService(new edge.ServiceBuilder(edgePaths.driverPath))
      .build();
//  console.log("driver made:", driver);
  return driver;
};

// ## Testing

// Tell the selenium driver to look at a particular elements's
// attribute and wait for it to have a value. Returns a promise.
let waitForAttribute = (driver, element, attrName, timeout) =>
    driver.wait(async () => element.getAttribute(attrName), timeout);

let openNewTab = async (driver) => {
  let tabsBefore = await driver.getAllWindowHandles();
  await driver.switchTo().window(tabsBefore[0]);
  await driver.get("https://example.com");
  await driver.executeScript(`
    document.body.addEventListener("click", () => window.open("", "_blank"));
  `);
  await driver.findElement(By.tagName('body')).click();
  let tabsAfter = await driver.getAllWindowHandles();
  return tabsAfter.filter(x => !tabsBefore.includes(x))[0];
};

// Tell the selenium driver to visit a url, wait for the attribute
// "data-test-results" to have a value, and resolve that value
// in a promise. Rejects if timeout elapses first.
let loadAndGetResults = async (driver, url, timeout, newTab) => {
  if (newTab) {
    let tab = await openNewTab(driver);
    await driver.switchTo().window(tab);
  }
  console.log(`loading ${url}`);
  await driver.get(url);
  let body = await driver.findElement(By.tagName('body'));
  let testResultsString =
      await waitForAttribute(driver, body, "data-test-results", timeout);
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
    driver, `${iframe_root_same}/tests/${stem}.html?mode=write&default=${secret}`, 10000, true);
//  console.log("writeResults:", writeResults, typeof(writeResults));
  let readParams = "";
  for (let [test, data] of Object.entries(writeResults)) {
    if ((typeof data["result"]) === "string") {
      readParams += `&${test}=${encodeURIComponent(data["result"])}`;
    }
  }
//  console.log(readParams);
  let readResultsSameFirstParty = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/${stem}.html?mode=read${readParams}`, 10000, newTabs);
//  console.log("readResultsSameFirstParty:", readResultsSameFirstParty);
  let readResultsDifferentFirstParty = await loadAndGetResults(
    driver, `${iframe_root_different}/tests/${stem}.html?mode=read${readParams}`, 10000, newTabs);
  let jointResult = {};
  for (let test in readResultsDifferentFirstParty) {
    let { write, read, result: readDifferentFirstParty } = readResultsDifferentFirstParty[test];
    let { result: readSameFirstParty } = readResultsSameFirstParty[test];
    let passed = (readSameFirstParty !== readDifferentFirstParty);
    let testFailed = !readSameFirstParty || readSameFirstParty.startsWith("Error:");
    jointResult[test] = { write, read, readSameFirstParty, readDifferentFirstParty, passed, testFailed };
  }
//  console.log("readResultsDifferentFirstParty:", readResultsDifferentFirstParty);
  return jointResult;
};

// Run all of our privacy tests using selenium. Returns
// a map of test types to test result maps. Such as:
// `
// { "fingerprinting" : { "window.screen.width" : { /* results */ }, ... }
//   "tor" : { ... }
//   "supercookies" : { ... } }
let runTests = async function (driver) {
  try {
    let fingerprinting = await loadAndGetResults(
      driver, 'https://arthuredelstein.github.io/browser-privacy/tests/fingerprinting.html', 10000);
    let tor = await loadAndGetResults(
      driver, 'https://arthuredelstein.github.io/browser-privacy/tests/tor.html', 10000);
    let supercookies = await runSupercookieTests(driver, true);
    let navigation = await runSupercookieTests(driver, false);
    return { fingerprinting, tor,
             supercookies: Object.assign({}, supercookies, navigation)};
  } catch (e) {
    console.log(e);
    return null;
  }
};

// Reads the current git commit hash for this program in a string. Used
// when reporting results, to make them easier to reproduce.
let gitHash = async function () {
  const { stdout, stderr } = await execAsync('git rev-parse HEAD');
  if (stderr) {
    throw new Error(stderr);
  } else {
    return stdout.trim();
  }
};

// Runs a batch of tests (multiple browsers) for a given driver.
// Returns results in a JSON object.
let runTestsBatch = async function (configData, {shouldQuit} = {shouldQuit:true}) {
  let all_tests = [];
  let timeStarted = new Date().toISOString();
  let git = await gitHash();
  for (let { browser, driverType, capabilities, prefs } of configData) {
    try {
      let driverConstructor = { browserstack: browserstackDriver,
                                firefox: localDriver,
                                chrome: localDriver,
                                electron: localDriver,
                                safari: localDriver,
                                opera: localDriver,
                                MicrosoftEdge: localDriver,
                              }[driverType];
      if (!driverConstructor) {
        throw new Error(`unknown driver type ${driverType}`);
      }
      capabilities.browserName = capabilities.browser;
      console.log(capabilities);
      let driver = await driverConstructor(capabilities);
      console.log(driver);
      let fullCapabilitiesMap = (await driver.getCapabilities())["map_"];
      let fullCapabilities = Object.fromEntries(fullCapabilitiesMap.entries());
      console.log(fullCapabilities);
      let timeStarted = new Date().toISOString();
      let testResults = await runTests(driver);
      if (shouldQuit) {
        await driver.quit();
      }
      all_tests.push({ browser, driverType, capabilities: fullCapabilities, testResults, timeStarted, prefs });
    } catch (e) {
      console.log(e, browser, driverType, capabilities, prefs);
    }
  }
  let timeStopped = new Date().toISOString();
  return { all_tests, git, timeStarted, timeStopped };
};

// ## Writing results

// Takes our results in a JSON object and writes them to disk.
// The file name looks like `results_yyyymmdd__HHMMss.json`.
let writeDataSync = function (data) {
  let dateStub = dateFormat(new Date(), "yyyymmdd_HHMMss", true);
  let filePath = `out/results_${dateStub}.json`;
  fs.writeFileSync(filePath, JSON.stringify(data));
  console.log(`Wrote results to "${filePath}".`);
};

// Reads the command line, sets up requested selenium driver(s),
// runs our browser privacy tests, and writes the result to disk.
let setup_tests = async function () {
  let driverType = process.argv[2];
};

let expandConfig = async (configData) => {
  let results = [];
  let driverType;
  let capabilityList;
  for (let { browser, service, path, disable, prefs } of configData) {
    if (!disable) {
      if (browser === "chromium" || browser === "chrome") {
        driverType = "chrome";
        capabilityList = [{"browser": "chrome"}];
      } else if (browser === "safari") {
        driverType = "safari";
        capabilityList = [{"browser": "safari"}];
      } else if (browser === "edge") {
        driverType = "MicrosoftEdge";
        capabilityList = [{"browser": "MicrosoftEdge"}];
      } else if (browser === "opera") {
        driverType = "chrome";
        capabilityList = [{
          browser: "chrome",
          chromeOptions: {  binary: path,
                            args: ['no-sandbox'] }
        }];
      } else if (browser === "brave") {
        driverType = "chrome";
        capabilityList = [{
          browser: "chrome",
          chromeOptions: {  binary: path,
                            args: ['no-sandbox'] }
        }];
      } else if (browser === "cliqz" ||
                 browser === "firefox" ||
                 browser === "tor browser") {
        driverType = "firefox";
        capabilityList = [{"browser": "firefox",
                           "moz:firefoxOptions": {}}];
        if (path) {
          capabilityList[0]["moz:firefoxOptions"]["binary"] = path;
        }
        if (browser === "tor browser") {
          if (!prefs) {
            prefs = {};
          }
          prefs["extensions.torlauncher.prompt_at_startup"] = false;
        }
        if (prefs) {
          capabilityList[0]["moz:firefoxOptions"]["prefs"] = prefs;
        }
      } else if (service === "browserstack") {
        driverType = "browserstack";
        capabilityList = selectRecentBrowserstackBrowsers(
          await fetchBrowserstackCapabilities());
      } else {
        throw new Error(`Unknown browser or service '${browser || service}'.`);
      }
      for (let capabilities of capabilityList) {
        results.push({ browser, driverType, service, path, capabilities, prefs });
      }
    }
  }
  return results;
}

// Returns a promise that sleeps for the given millseconds.
let sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// The main program
let main = async () => {
  // Read config file and flags from command line
  let { _ : [configFile], stayOpen } = minimist(process.argv.slice(2));
  let configData = JSON.parse(fs.readFileSync(configFile));
  let expandedConfigData = await expandConfig(configData);
  writeDataSync(await runTestsBatch(expandedConfigData,
                                    { shouldQuit: !stayOpen }));
  render.main();
}

main();
