const WebDriver = require('webdriver');
const _ = require('lodash');
const { execSync } = require('child_process');
const plist = require('plist');
const { sleepMs } = require('./utils');

const browserInfo = {
  brave: {
    name: 'Brave',
    bundleId: 'com.brave.ios.browser',
    startupClick: 'No',
    urlBarClick: 'Search or enter address',
    urlBarClick2: 'url',
    urlBarKeys: 'Search or enter address',
    urlBarKeys2: 'url',
    privateWindow: ['TabToolbar.tabsButton', 'Private Mode', 'TabTrayController.doneButton']
    // Brave starts in normal window mode.
  },
  chrome: {
    name: 'Chrome',
    bundleId: 'com.google.chrome.ios',
    urlBarClick: 'NTPHomeFakeOmniboxAccessibilityID',
    urlBarClick2: 'Address and search bar',
    urlBarKeys: 'Address',
    privateWindow: ['kToolbarStackButtonIdentifier', 'TabGridIncognitoTabsPageButtonIdentifier', 'TabGridDoneButtonIdentifier'],
    normalWindow: ['kToolbarStackButtonIdentifier', 'TabGridRegularTabsPageButtonIdentifier', 'TabGridDoneButtonIdentifier']
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    displayName: 'DuckDuckGo',
    bundleId: 'com.duckduckgo.mobile.ios',
    postLaunchDelay: 4000,
    startupClick: 'Let’s Do It!',
    urlBarClick: 'searchEntry',
    urlBarKeys: 'searchEntry'
  },
  edge: {
    name: 'Edge',
    bundleId: 'com.microsoft.msedge',
    urlBarClick: 'Search and address bar',
    urlBarClick2: 'NTPHomeFakeOmniboxAccessibilityID',
    urlBarKeys: 'Address'
  },
  firefox: {
    name: 'Firefox',
    bundleId: 'org.mozilla.ios.Firefox',
    urlBarClick: 'AddressToolbar.address',
    urlBarKeys: 'AddressToolbar.address'
  },
  focus: {
    name: 'Firefox Focus',
    bundleId: 'org.mozilla.ios.Focus',
    urlBarClick: 'URLBar.urlText',
    urlBarKeys: 'URLBar.urlText'
    // urlBarClear: "icon clear",
  },
  onion: {
    name: 'Onion Browser',
    bundleId: 'com.miketigas.OnionBrowser',
    urlBarClickXpath: '//XCUIElementTypeTextField', // Hoping this is the only one present
    urlBarKeys: 'Onion Browser', // application element
    urlBarClear: 'Clear text',
    postLaunchDelay: 10000
    // No additional private mode
  },
  opera: {
    name: 'Opera',
    bundleId: 'com.opera.OperaTouch',
    urlBarClick: 'addressBar',
    urlBarKeys: 'addressBar',
    urlBarClear: 'clearText'
  },
  safari: {
    name: 'Safari',
    bundleId: 'com.apple.mobilesafari',
    urlBarClick: 'TabBarItemTitle',
    // iOS 26 capsule UI sometimes replaces TabBarItemTitle with Reader Available.
    urlBarClickXpath: "//XCUIElementTypeOther[starts-with(@name,'CapsuleNavigationBar')]",
    urlBarKeys: 'URL'
  },
  vivaldi: {
    name: 'Vivaldi',
    bundleId: 'com.vivaldi.browser',
    urlBarClick: 'Address and search bar',
    urlBarKeys: 'Address',
    urlBarClear: 'Clear Text'
  },
  yandex: {
    name: 'Yandex',
    bundleId: 'ru.yandex.mobile.search',
    postLaunchDelay: 2000,
    // startupClick: "Решить проблемы",
    // startupClick: 'Fix problems',
    startupClick: 'Close',
    urlBarClick: 'sentryFakeOmniboxButton',
    urlBarClick2: 'Address bar',
    //urlBarClear: 'Clear the input field',
    // Focused field is an unnamed XCUIElementTypeTextView after omnibox open.
    urlBarKeysXpath: '//XCUIElementTypeTextView'
  }
};

const getPlatformVersion = _.memoize(() =>
  execSync('/opt/homebrew/bin/ideviceinfo --key ProductVersion')
    .toString().trim());

const getAppVersions = _.memoize(() => {
  const appVersions = {};
  const plistRaw = execSync('/opt/homebrew/bin/ideviceinstaller  -l -o xml').toString();
  const plistJson = plist.parse(plistRaw);
  for (const plistItem of plistJson) {
    appVersions[plistItem.CFBundleIdentifier] = plistItem.CFBundleShortVersionString;
  }
  // Safari version number is the same as the iOS version:
  appVersions['com.apple.mobilesafari'] = getPlatformVersion();
  return appVersions;
});

const webdriverSession = _.memoize(() =>
  WebDriver.newSession({
    port: 4723,
    hostname: '0.0.0.0',
    path: '/wd/hub',
    capabilities: {
      'appium:bundleId': 'com.apple.mobilesafari',
      platformName: 'iOS',
      'appium:udid': 'auto',
      'appium:xcodeOrgId': 'MGQ2CFRT2X',
      'appium:xcodeSigningId': 'Apple Development',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone SE',
      'appium:wdaLaunchTimeout': 60000,
      'appium:wdaConnectionTimeout': 60000,
      'appium:updatedWDABundleId': 'org.privacytests.WebDriverAgentRunner',
      'appium:platformVersion': getPlatformVersion(),
      'appium:showXcodeLog': true
    }
  }));

const findElementWithName = async (client, name) => {
  const elementObject = await client.findElement('name', name);
  return elementObject.ELEMENT;
};

const clickElementWithName = async (client, name) => {
  const element = await findElementWithName(client, name);
  if (!element) {
    throw new Error(`no element with name ${name} found`);
  }
  return await client.elementClick(element);
};

const findElementWithXPath = async (client, xpath) => {
  const elementObject = await client.findElement('xpath', xpath);
  return elementObject.ELEMENT;
};

class IOSBrowser {
  constructor ({ browser, incognito, tor, nightly }) {
    Object.assign(this, { browser, incognito, tor, nightly }, browserInfo[browser]);
  }

  // Launch the browser.
  async launch () {
    this.client = await webdriverSession();
    const state = await this.client.queryAppState(this.bundleId);
    if (state >= 2) {
      await this.client.terminateApp(this.bundleId);
    }
    await this.client.activateApp(this.bundleId);
    if (this.postLaunchDelay) {
      await sleepMs(this.postLaunchDelay);
    }
    if (this.startupClick) {
      try {
        await clickElementWithName(this.client, this.startupClick);
      } catch (e) {
        console.log(e);
      }
    }
    /*
      if (this.incognito) {
      if (this.privateWindow) {
      await clickSeries(this.client, this.privateWindow);
      }
      } else {
      if (this.normalWindow) {
      await clickSeries(this.client, this.normalWindow);
      }
      }
    */
    await sleepMs(2000);
  }

  // Get the browser version.
  async version () {
    const versions = getAppVersions();
    return versions[this.bundleId];
  }

  // Open the url in a new tab.
  async openUrl (url) {
    try {
      let urlBarToClick;
      if (this.urlBarClick) {
        urlBarToClick = await findElementWithName(this.client, this.urlBarClick);
        if (urlBarToClick === undefined) {
          if (this.urlBarClick2) {
            urlBarToClick = await findElementWithName(this.client, this.urlBarClick2);
          }
          if (urlBarToClick === undefined) {
            urlBarToClick = await findElementWithName(this.client, this.urlBarKeys);
          }
        }
      }
      if (urlBarToClick === undefined && this.urlBarClickXpath) {
        urlBarToClick = await findElementWithXPath(this.client, this.urlBarClickXpath);
      }
      await this.client.elementClick(urlBarToClick);
      await sleepMs(1000);
      if (this.urlBarClear) {
        try {
          await clickElementWithName(this.client, this.urlBarClear);
        } catch (e) {
          console.log(e);
        }
      }
      let urlBarToSendKeys;
      if (this.urlBarKeys) {
        urlBarToSendKeys = await findElementWithName(this.client, this.urlBarKeys);
        if (urlBarToSendKeys === undefined && this.urlBarKeys2) {
          urlBarToSendKeys = await findElementWithName(this.client, this.urlBarKeys2);
        }
      }
      if (urlBarToSendKeys === undefined && this.urlBarKeysXpath) {
        urlBarToSendKeys = await findElementWithXPath(this.client, this.urlBarKeysXpath);
      }
      if (!urlBarToSendKeys) {
        throw new Error(`no url-bar text field found for ${this.browser}`);
      }
      await this.client.elementSendKeys(urlBarToSendKeys, url);
      await this.client.elementSendKeys(urlBarToSendKeys, '\r');
    } catch (e) {
      try {
        console.log('UI hierarchy after openUrl failure:\n', await this.client.getPageSource());
      } catch (dumpError) {
        console.log('Failed to dump UI hierarchy:', dumpError);
      }
      throw e;
    }
  }

  // Clean up and close the browser.
  async kill () {
    await this.client.terminateApp(this.bundleId);
  }

  async restart() {
    await this.kill();
    await sleepMs(2000);
    await this.launch();
  }

  async clickContent () {
    const theWebView = await findElementWithXPath(this.client, '//XCUIElementTypeWebView');
    await this.client.elementClick(theWebView);
  }
}

module.exports = { IOSBrowser };

async function main () {
  const browser = new IOSBrowser({ browser: process.argv[2] });
  console.log(await browser.version());
}

if (require.main === module) {
  main();
}
