const { default: WebDriver } = require('webdriver');
const _ = require('lodash');
const { execSync } = require('child_process');
const { sleepMs } = require('./utils');

const browserInfo = {
  baidu: {
    releasePackageName: 'com.baidu.searchbox',
    urlBarClick: 'baidu_searchbox',
    urlBarKeys: 'SearchTextInput'
  },
  brave: {
    releasePackageName: 'com.brave.browser',
    nightlyPackageName: 'com.brave.browser_nightly',
    urlBarClick: 'url_bar',
    urlBarKeys: 'url_bar'
  },
  bromite: {
    releasePackageName: 'org.bromite.bromite',
    urlBarClick: 'url_bar',
    urlBarKeys: 'url_bar'
  },
  chrome: {
    releasePackageName: 'com.android.chrome',
    nightlyPackageName: 'com.chrome.canary',
    urlBarClick: 'search_box_text',
    urlBarKeys: 'url_bar'
  },
  coccoc: {
    releasePackageName: 'com.coccoc.trinhduyet',
    urlBarClick: 'omnibox_container',
    urlBarKeys: 'url_bar'
  },
  duckduckgo: {
    displayName: 'DuckDuckGo',
    releasePackageName: 'com.duckduckgo.mobile.android',
    urlBarClick: 'omnibarTextInput',
    urlBarKeys: 'omnibarTextInput'
  },
  edge: {
    releasePackageName: 'com.microsoft.emmx',
    nightlyPackageName: 'com.microsoft.emmx.canary',
    urlBarClick: 'url_bar',
    urlBarClick2: 'search_box_text',
    urlBarKeys: 'url_bar',
    goButton: 'line_1'
  },
  firefox: {
    releasePackageName: 'org.mozilla.firefox',
    nightlyPackageName: 'org.mozilla.fenix',
    urlBarClick: 'mozac_browser_toolbar_url_view',
    urlBarClick2: 'toolbar_wrapper',
    urlBarKeys: 'mozac_browser_toolbar_edit_url_view'
  },
  focus: {
    releasePackageName: 'org.mozilla.focus',
    urlBarClick: 'mozac_browser_toolbar_url_view',
    urlBarKeys: 'mozac_browser_toolbar_edit_url_view'
  },
  mi: {
    releasePackageName: 'com.mi.globalbrowser',
    urlBarClick: 'search_hint',
    urlBarKeys: 'url'
  },
  mull: {
    releasePackageName: 'us.spotco.fennec_dos',
    urlBarClick: 'mozac_browser_toolbar_url_view',
    urlBarClick2: 'bottom_bar',
    urlBarKeys: 'mozac_browser_toolbar_edit_url_view'
  },
  opera: {
    releasePackageName: 'com.opera.browser',
    nightlyPackageName: 'com.opera.browser.beta',
    urlBarClick: 'url_field',
    urlBarKeys: 'url_field'
  },
  samsung: {
    releasePackageName: 'com.sec.android.app.sbrowser',
    nightlyPackageName: 'com.sec.android.app.sbrowser.beta',
    urlBarClick: 'location_bar_edit_text',
    urlBarKeys: 'location_bar_edit_text',
    contentElement: 'content_layout'
  },
  tor: {
    releasePackageName: 'org.torproject.torbrowser',
    nightlyPackageName: 'org.torproject.torbrowser_alpha',
    startupClick: 'tor_bootstrap_connect_button',
    urlBarClick: 'toolbar',
    urlBarKeys: 'mozac_browser_toolbar_edit_url_view'
  },
  uc: {
    releasePackageName: 'com.UCMobile.intl',
    urlBarClick: '//android.widget.ImageView[@content-desc="data saving"]/following-sibling::android.widget.TextView',
    urlBarClick2: '//android.widget.TextView[@content-desc="Search or Enter URL edit box"]',
    urlBarKeys: '//android.widget.LinearLayout[@content-desc="Search or Enter URL edit box"]/android.widget.EditText',
    urlBarClear: 'btn_clear_or_voice',
    contentElement: '//com.uc.webview.export.WebView'
  },
  vivaldi: {
    releasePackageName: 'com.vivaldi.browser',
    nightlyPackageName: 'com.vivaldi.browser.snapshot',
    urlBarClick: 'url_bar',
    urlBarKeys: 'url_bar'
  },
  whale: {
    releasePackageName: 'com.naver.whale',
    urlBarClick: 'url_bar',
    urlBarKeys: 'url_bar'
  },
  yandex: {
    releasePackageName: 'com.yandex.browser',
    nightlyPackageName: 'com.yandex.browser.alpha',
    urlBarClick: 'bro_omnibar_address_title_text',
    urlBarClick2: "//android.widget.Button[@text='search or site']",
    urlBarKeys: 'suggest_omnibox_query_edit',
    contentElement: 'renderView'
  }
};

const findElementWithId = async (client, packageName, id) => {
  const elementObject = await client.findElement('id', `${packageName}:id/${id}`);
  return elementObject.ELEMENT;
};

const findElementWithXPath = async (client, xpath) => {
  const elementObject = await client.findElement('xpath', xpath);
  return elementObject.ELEMENT;
};

const findElement = async (client, packageName, selector) => {
  if (selector.startsWith('/')) {
    return findElementWithXPath(client, selector);
  } else {
    return findElementWithId(client, packageName, selector);
  }
};

const findElementWithClass = async (client, className) => {
  const elementObject = await client.findElement('class name', className);
  return elementObject.ELEMENT;
};

const getAppVersion = _.memoize((packageName) => {
  const cmd = `/opt/homebrew/bin/adb shell dumpsys package ${packageName} | /usr/bin/grep versionName`;
  const raw = execSync(cmd).toString();
  return raw.match(/versionName=(\S+)/)[1];
});

const webdriverSession = _.memoize(() =>
  WebDriver.newSession({
    port: 4723,
    hostname: '0.0.0.0',
    path: '/wd/hub',
    capabilities: {
      platformName: 'Android',
      'appium:newCommandTimeout': 300,
      'appium:automationName': 'UiAutomator2',
      'appium:uiautomator2ServerInstallTimeout': 90000
    }
  }));

class AndroidBrowser {
  constructor ({ browser, incognito, tor, nightly }) {
    Object.assign(this, { browser, incognito, tor, nightly }, browserInfo[browser]);
    this.packageName = nightly ? this.nightlyPackageName : this.releasePackageName;
  }

  // Launch the browser.
  async launch () {
    this.client = await webdriverSession();
    // If app is already open, terminate it so we start with a clean slate.
    const state = await this.client.queryAppState(this.packageName);
    if (state >= 2) {
      this.client.terminateApp(this.packageName);
    }
    await this.client.activateApp(this.packageName);
    await sleepMs(5000);
    console.log('this.startupClick:', this.startupClick);
    if (this.startupClick) {
      const startupButton = await findElement(this.client, this.packageName, this.startupClick);
      if (startupButton) {
        await this.client.elementClick(startupButton);
        await sleepMs(20000);
      }
    }
  }

  // Get the browser version.
  async version () {
    return getAppVersion(this.packageName);
  }

  async openUrlOnce (url) {
    let urlBarToClick = await findElement(this.client, this.packageName, this.urlBarClick);
    if (urlBarToClick === undefined) {
      if (this.urlBarClick2) {
        urlBarToClick = await findElement(this.client, this.packageName, this.urlBarClick2);
      }
      if (urlBarToClick === undefined) {
        urlBarToClick = await findElement(this.client, this.packageName, this.urlBarKeys);
        //      await sleepMs(1000);
        //      urlBarToClick = await findElementWithId(this.client, this.packageName, this.urlBarClick);
      }
    }
    await this.client.elementClick(urlBarToClick);
    await sleepMs(1000);
    if (this.urlBarClear) {
      const clearButton = await findElement(this.client, this.packageName, this.urlBarClear);
      await this.client.elementClick(clearButton);
    }
    const urlBarToSendKeys = await findElement(this.client, this.packageName, this.urlBarKeys);
    if (this.goButton) {
      await this.client.elementSendKeys(urlBarToSendKeys, url);
      const goButton = await findElement(this.client, this.packageName, this.goButton);
      await this.client.elementClick(goButton);
    } else {
      await this.client.elementSendKeys(urlBarToSendKeys, url + '\\n');
    }
  }

  // Open the url in a new tab.
  async openUrl (url) {
    for (let i = 0; i < 2; ++i) {
      try {
        await this.openUrlOnce(url);
        // Success!
        return;
      } catch (e) {
        console.log(e);
        // Sleep a bit before we try again.
        await sleepMs(3000);
      }
    }
  }

  // Clean up and close the browser.
  async kill () {
    await this.client.terminateApp(this.packageName);
  }

  async clickContent () {
    let theWebView;
    if (this.contentElement) {
      theWebView = await findElement(this.client, this.packageName, this.contentElement);
    } else {
      // Most browsers use a WebView
      theWebView = await findElementWithClass(this.client, 'android.webkit.WebView');
    }
    await this.client.elementClick(theWebView);
  }
}

module.exports = { AndroidBrowser };

const demoBrowser = async (client, browserName, url) => {
  const { startupClick, packageName, urlBarClick, urlBarKeys } = browserInfo[browserName];
  await client.activateApp(packageName);
  await sleepMs(5000);
  if (startupClick) {
    const startupButton = await findElement(client, packageName, startupClick);
    await client.elementClick(startupButton);
    await sleepMs(3000);
  }
  const urlBarToClick = await findElement(client, packageName, urlBarClick);
  await client.elementClick(urlBarToClick);
  await sleepMs(1000);
  const urlBarToSendKeys = await findElement(client, packageName, urlBarKeys);
  await client.elementSendKeys(urlBarToSendKeys, url + '\\n');
  await sleepMs(8000);
  await client.terminateApp(packageName);
};

async function main () {
  const client = await WebDriver.newSession({
    port: 4723,
    hostname: '0.0.0.0',
    path: '/wd/hub',
    capabilities: { platformName: 'Android', newCommandTimeout: 300 }
  });
  await demoBrowser(client, 'edge', 'https://edge.com');
}

if (require.main === module) {
  main();
}
