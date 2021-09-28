// # WebDriver utilities
// A wrapper around node Selenium WebDriver library that makes it simpler to
// launch and control browsers.

// ## imports

const homeDir = require('os').homedir();
const fs = require('fs');
const YAML = require('yaml');

const memoize = require('memoizee');
const fetch = require('node-fetch');

const {Builder, until} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const chrome = require('selenium-webdriver/chrome');
const edge = require('selenium-webdriver/edge');
const { installDriver: installEdgeDriver } = require('ms-chromium-edge-driver');

require('geckodriver');
require('chromedriver');

// ## Utility functions for browserstack

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
let fetchBrowserstackCapabilities = async ({user, key}) => {
  let results = (await fetch(`https://${user}:${key}@api.browserstack.com/automate/browsers.json`)).json();
//  console.log(await results);
  return results;
};

// Takes the long capability list from browserstack.com, and
// returns all such browsers that match.
const selectMatchingBrowsers = (allCapabilities, selectionMap) =>
  allCapabilities.filter((capability) => {
    let keep = true;
//    console.log("match", capability, selectionMap);
    for (let prop in selectionMap) {
      if (capability[prop] &&
          selectionMap[prop] &&
          capability[prop].toLowerCase() !== selectionMap[prop].toLowerCase()) {
        keep = false;
      }
//      console.log(prop, capability[prop], selectionMap[prop], keep);
      if (keep === false) break;
    }
    return keep;
  });

// Find the best browserstack capabilities that match the specified
// browser, browser_version, os, and os_version.
let getBestBrowserstackCapabilities =
    async ({ user, key, browser, browser_version, os, os_version }) => {
      let browserstackCapabilities = await fetchBrowserstackCapabilities({user, key});
      //    console.log(JSON.stringify([...new Set(browserstackCapabilities.map(x => x["browser"]))], null, "  "));
      if (browser_version === "latest") {
        browser_version = undefined;
        latest_browser_version = true;
      }
      let capabilitiesList = selectMatchingBrowsers(
        browserstackCapabilities, { browser, os, browser_version, os_version });
      if (latest_browser_version) {
        capabilitiesList = capabilitiesList.filter(x => !(x["browser_version"].includes("beta")));
        capabilitiesList.sort((a, b) => parseFloat(b["browser_version"]) - parseFloat(a["browser_version"]));
      }
      return capabilitiesList[0];
    };

// Takes the given Builder and sets it up for the specified
// browser, browser_version, os, and os_version on browserstack.
let setToBrowserstack =
    async (builder, { browser, browser_version, os, os_version }) => {
  let { user, key } = await browserstackCredentials();
  builder.usingServer(`http://${user}:${key}@hub-cloud.browserstack.com/wd/hub`);
  let capabilities = await getBestBrowserstackCapabilities(
    { user, key, browser, browser_version, os, os_version });
  builder.withCapabilities(capabilities);
};

// ## Builder options for specific browsers

// Sets Chrome options for the Builder.
let setChromeOptions = (builder, {edge, incognito, path, tor_mode}) => {
  let options = new chrome.Options();
  if (path) {
    options.setChromeBinaryPath(path);
  }
  options.addArguments("--remote-debugging-port=9222");
  if (incognito) {
    if (edge) {
      options.addArguments("-inprivate");
    } else {
      options.addArguments("incognito");
    }
  }
  if (tor_mode) {
    options.addArguments("tor");
  }
  return builder
    .setChromeOptions(options)
    .forBrowser("chrome");
};

// Set Firefox options for the Builder.
let setFirefoxOptions = (builder, {incognito, path, tor, prefs}) => {
  if (!path && tor) {
    throw new Error("Please specify a path for the Tor Browser firefox binary.");
  }
  let options = new firefox.Options();
  if (path) {
    options.setBinary(path);
  }
  if (incognito) {
    options.addArguments("-private");
  }
  if (tor) {
    options.setPreference("extensions.torlauncher.prompt_at_startup", false);
    options.setPreference("extensions.torlauncher.quickstart", true);
  }
  if (prefs) {
    for (let [pref, val] of Object.entries(prefs)) {
      options.setPreference(pref, val);
    }
  }
  return builder
    .setFirefoxOptions(options)
    .forBrowser("firefox");
};

// Set Safari options for the Builder.
let setSafariOptions = (builder, {incognito, path}) => {
  if (incognito) {
    throw new Error("I don't know how to set incognito mode for Safari.");
  }
  if (path) {
    throw new Error("I don't know how to set a path for Safari.");
  }
  return builder.forBrowser("safari");
};

// ## High-level webdriver utility functions

const chromiumBrowsers = [
  "chrome", "chromium", "android", "samsung", "opera", "brave",
  "edge", "microsoft-edge"
];

// Produces a selenium driver to run tests,
// using the given config object.
let createDriver = async ({browser, browser_version,
                           os, os_version,
                           service, incognito, path,
                           prefs, tor_mode}) => {
  let builder = new Builder();
  let browserstack = service === "browserstack";
    if (browserstack) {
    await setToBrowserstack(builder, { browser, browser_version, os, os_version });
  }
  if (chromiumBrowsers.includes(browser)) {
    setChromeOptions(builder, { edge: browser === "edge", incognito, path, tor_mode });
  } else if (browser === "firefox" || browser === "tor browser") {
    setFirefoxOptions(builder, { incognito, path, prefs, tor: browser === "tor browser" });
  } else if (browser === "safari") {
    setSafariOptions(builder, { incognito, path });
  } else {
    throw new Error("unknown browser");
  }
  return builder.build();
};

// Tell the selenium driver to look at a particular element's
// attribute and wait for it to have a value. Returns a promise.
let waitForAttribute = async (driver, elementCssSelector, attrName, timeout) => {
  let element = await driver.findElement({css:elementCssSelector});
  return driver.wait(async () => element.getAttribute(attrName), timeout);
};

// Tell the selenium driver to navigate to a new url. Make sure
// that the existing page has unloaded before promise resolves.
let navigate = async (driver, url) => {
  let htmlPage = await driver.findElement({css:"html"});
  await driver.executeScript(`document.body.innerHTML += "<a id='navigationLink' href='${url}'>click</a>"`);
  await driver.findElement({id:"navigationLink"}).click();
  await driver.wait(until.stalenessOf(htmlPage));
};

// Tell the selenium driver to open a new tab at https://example.com.
// Returns a promise containing a handle to the new tab window.
let openNewTab = async (driver) => {
  let tabsBefore = await driver.getAllWindowHandles();
  await driver.switchTo().window(tabsBefore[0]);
  await driver.get("https://example.com");
  await driver.executeScript(`
    document.body.addEventListener("click", () => window.open("https://example.com", "_blank"));
  `);
  await driver.findElement({css:"body"}).click();
  let tabsAfter = await driver.getAllWindowHandles();
  return tabsAfter.filter(x => !tabsBefore.includes(x))[0];
};

// Get the browser to quit.
let quit = async (driver) => {
  let windowHandles = await driver.getAllWindowHandles();
  for (let windowHandle of windowHandles) {
    try {
      await driver.switchTo().window(windowHandle);
      await driver.close();
    } catch (e) {
      console.log(e);
    }
  }
  try {
    await driver.quit();
  } catch (e) {
    console.log(e);
  }
};

// ## Reading and parsing config files

// Returns a deep copy of a JSON object.
const deepCopy = (x) => JSON.parse(JSON.stringify(x));

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

// Read config file in YAML or JSON.
const parseConfigFile = (configFile, repeat = 1) => {
  let configFileContents = fs.readFileSync(configFile, 'utf8');
  let rawConfigs = YAML.parse(configFileContents);
  return expandConfigList(rawConfigs, repeat);
};

module.exports = {
  createDriver, waitForAttribute, navigate, openNewTab, quit, parseConfigFile
};
