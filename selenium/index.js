/* jshint esversion: 6 */

// ## imports

const homeDir = require('os').homedir();
const fs = require('fs');
const {Builder, By, Key, until} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const memoize = require('memoizee');
const fetch = require('node-fetch');
const dateFormat = require('dateformat');
const util = require('util');
const { spawn, exec } = require('child_process');
const execAsync = util.promisify(exec);
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
          .filter(c => c.browser !== "opera" && c.browser !== "ie" && c.os !== "ios");
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
          // Use two most recent browser versions or two representative devices
          selectedCapabilities = selectedCapabilities.concat(capabilities2.slice(-2));
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
//  let options = new firefox.Options()
//      .setPreference('privacy.firstparty.isolate', true);
  let builder = new Builder();
  if (capabilities.server) {
    builder = builder.usingServer(capabilities.server);
  }
  let driver = builder.withCapabilities(capabilities)
    .forBrowser(capabilities["browser"])
//    .setFirefoxOptions(options)
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
let loadAndGetResults = async (driver, url, timeout) => {
  let tab = await openNewTab(driver);
  await driver.switchTo().window(tab);
  console.log(`loading ${url}`);
  await driver.get(url);
  let body = await driver.findElement(By.tagName('body'));
  let testResultsString =
      await waitForAttribute(driver, body, "data-test-results", timeout);
  return testResultsString === "undefined" ? undefined : JSON.parse(testResultsString);
};

// Causes driver to connect to our supercookie tests. Returns
// a map of test names to test results.
let runSupercookieTests = async (driver) => {
  let secret = Math.random().toString().slice(2);
  let iframe_root_same = false ? "http://localhost:8080" : "https://arthuredelstein.net/browser-privacy";
  let iframe_root_different = false ? "http://localhost:8080" : "https://arthuredelstein.github.io/browser-privacy";
  let writeResults = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/supercookies.html?mode=write&default=${secret}`, 10000);
//  console.log("writeResults:", writeResults, typeof(writeResults));
  let readParams = "";
  for (let [test, data] of Object.entries(writeResults)) {
    if ((typeof data["result"]) === "string") {
      readParams += `&${test}=${encodeURIComponent(data["result"])}`;
    }
  }
//  console.log(readParams);
  let readResultsSameFirstParty = await loadAndGetResults(
    driver, `${iframe_root_same}/tests/supercookies.html?mode=read${readParams}`, 10000);
//  console.log("readResultsSameFirstParty:", readResultsSameFirstParty);
  let readResultsDifferentFirstParty = await loadAndGetResults(
    driver, `${iframe_root_different}/tests/supercookies.html?mode=read${readParams}`, 10000);
  for (let test in readResultsDifferentFirstParty) {
    let passed = (readResultsDifferentFirstParty[test].result !== readResultsSameFirstParty[test].result);
    readResultsDifferentFirstParty[test].passed = passed;
  }
//  console.log("readResultsDifferentFirstParty:", readResultsDifferentFirstParty);
  return readResultsDifferentFirstParty;
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
    let supercookies = await runSupercookieTests(driver);
    return { fingerprinting, tor, supercookies };
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
                                opera: localDriver,
                              }[driverType];
      if (!driverConstructor) {
        throw new Error(`unknown driver type ${driverType}`);
      }
      capabilities.browserName = capabilities.browser;
      console.log(capabilities);
      let driver = await driverConstructor(capabilities);
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
      console.log(e, browser, driverType, fullCapabilities, prefs);
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
  if (!(fs.existsSync("results"))) {
    fs.mkdirSync("results");
  }
  let filePath = `results/results_${dateStub}.json`;
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
      } else if (browser === "opera") {
        driverType = "chrome";
        capabilityList = [{"browser": "chrome"}];
      } else if (browser === "brave") {
        driverType = "chrome";
        // Doesn't work.
        capabilityList = [{browser: "brave",
                           chromeOptions: {  binary: path,
                                             args: ['no-sandbox'] },
                           server: 'http://localhost:9515'}];
      } else if (browser === "cliqz" ||
                 browser === "firefox" ||
                 browser === "tor browser") {
        driverType = "firefox";
        capabilityList = [{"browser": "firefox",
                           "moz:firefoxOptions": {}}];
        if (path) {
          capabilityList[0]["moz:firefoxOptions"]["binary"] = path;
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

let sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let prepare = async (configData) => {
  for (let { prestart } of configData) {
    if (prestart) {
      spawn(prestart.command, { cwd : prestart.dir });
      await sleep(prestart.waitSeconds * 1000);
    }
  }
}

let main = async () => {
  let configFile = process.argv[2];
  let configData = JSON.parse(fs.readFileSync(configFile));
  await prepare(configData);
  let expandedConfigData = await expandConfig(configData);
  writeDataSync(await runTestsBatch(expandedConfigData));
}

main();
