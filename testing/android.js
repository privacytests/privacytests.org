const { default: WebDriver}  = require("webdriver");
const _ = require('lodash');
const child_process = require('child_process');

const browserInfo = {
  baidu: {
    packageName: "com.baidu.searchbox",
    urlBarClick: "baidu_searchbox",
    urlBarKeys: "SearchTextInput"
  },
  brave: {
    packageName: "com.brave.browser",
    urlBarClick: "url_bar",
    urlBarKeys: "url_bar"
  },
  chrome: {
    packageName: "com.android.chrome",
    urlBarClick: "search_box_text",
    urlBarKeys: "url_bar"
  },
  coccoc: {
    packageName: "com.coccoc.trinhduyet",
    urlBarClick: "omnibox_container",
    urlBarKeys: "url_bar"
  },
  duckduckgo: {
    packageName: "com.duckduckgo.mobile.android",
    urlBarClick: "omnibarTextInput",
    urlBarKeys: "omnibarTextInput"
  },
  edge: {
    packageName: "com.microsoft.emmx",
    urlBarClick: "search_box_text",
    urlBarKeys: "url_bar"
  },
  firefox: {
    packageName: "org.mozilla.firefox",
    urlBarClick: "mozac_browser_toolbar_url_view",
    urlBarClick2: "toolbar_wrapper",
    urlBarKeys: "mozac_browser_toolbar_edit_url_view"
  },
  focus: {
    packageName: "org.mozilla.focus",
    urlBarClick: "mozac_browser_toolbar_edit_url_view",
    urlBarKeys: "mozac_browser_toolbar_edit_url_view"
  },
  mi: {
    packageName: "com.mi.globalbrowser",
    urlBarClick: "search_hint",
    urlBarKeys: "url"
  },
  opera: {
    packageName: "com.opera.browser",
    urlBarClick: "url_field",
    urlBarKeys: "url_field"
  },
  samsung: {
    packageName: "com.sec.android.app.sbrowser",
    urlBarClick: "location_bar_edit_text",
    urlBarKeys: "location_bar_edit_text",
    contentElement: "content_layout"
  },
  tor: {
    packageName: "org.torproject.torbrowser",
    startupClick: "tor_bootstrap_connect_button",
    urlBarClick: "toolbar",
    urlBarKeys: "mozac_browser_toolbar_edit_url_view"
  },
  uc: {
    packageName: "com.UCMobile.intl",
    urlBarClick: `//android.widget.ImageView[@content-desc="data saving"]/following-sibling::android.widget.TextView`,
    urlBarClick2: `//android.widget.TextView[@content-desc="Search or Enter URL edit box"]`,
    urlBarKeys: `//android.widget.LinearLayout[@content-desc="Search or Enter URL edit box"]/android.widget.EditText`,
    urlBarClear: "btn_clear_or_voice",
    contentElement: "//com.uc.webview.export.WebView"
  },
  vivaldi: {
    packageName: "com.vivaldi.browser",
    urlBarClick: "url_bar",
    urlBarKeys: "url_bar"
  },
  whale: {
    packageName: "com.naver.whale",
    urlBarClick: "url_bar",
    urlBarKeys: "url_bar"
  },
  yandex: {
    packageName: "com.yandex.browser",
    urlBarClick: "bro_omnibar_address_title_text",
    urlBarClick2: "bro_sentry_bar_fake_text",
    urlBarKeys: "suggest_omnibox_query_edit"
  }
};

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const findElementWithId = async (client, packageName, id) => {
  const elementObject = await client.findElement("id", `${packageName}:id/${id}`);
  return elementObject.ELEMENT;
};

const findElementWithXPath = async (client, xpath) => {
  const elementObject = await client.findElement("xpath", xpath);
  return elementObject.ELEMENT;
};

const findElement = async (client, packageName, selector) => {
  if (selector.startsWith("/")) {
    return findElementWithXPath(client, selector);
  } else {
    return findElementWithId(client, packageName, selector);
  }
}

const findElementWithClass = async (client, className) => {
  const elementObject = await client.findElement("class name", className);
  return elementObject.ELEMENT;
};

const demoBrowser = async (client, browserName, url) => {
  const { startupClick, packageName, urlBarClick, urlBarKeys } = browserInfo[browserName];
  await client.activateApp(packageName);
  await sleepMs(5000);
  if (startupClick) {
    const startupButton = await findElement(client, packageName, startupClick);
    await client.elementClick(startupButton)
    await sleepMs(3000);
  }
  const urlBarToClick = await findElement(client, packageName, urlBarClick);
  await client.elementClick(urlBarToClick);
  await sleepMs(1000);
  const urlBarToSendKeys = await findElement(client, packageName, urlBarKeys);
  await client.elementSendKeys(urlBarToSendKeys, url + "\\n");
  await sleepMs(8000);
  await client.terminateApp(packageName);
};

const webdriverSession = _.memoize(async () => {
  const client = await WebDriver.newSession({
    port: 4723,
    hostname: "0.0.0.0",
    path: "/wd/hub",
    capabilities: { platformName: "Android", "newCommandTimeout": 300 }
  });
  return client;
});

class AndroidBrowser {
  constructor({browser, incognito, tor, nightly}) {
    Object.assign(this, { browser, incognito, tor, nightly }, browserInfo[browser]);
  }
  // Launch the browser.
  async launch() {
    const client = await webdriverSession();
    this.client = client;
    await this.client.activateApp(this.packageName);
    await sleepMs(5000);
    console.log("this.startupClick:",this.startupClick);
    if (this.startupClick) {
      const startupButton = await findElement(client, this.packageName, this.startupClick);
      if (startupButton) {
        await this.client.elementClick(startupButton)
        await sleepMs(20000);
      }
    }
  }
  // Get the browser version.
  async version() {
    const cmd = `adb shell dumpsys package ${this.packageName} | grep versionName`;
    const raw = child_process.execSync(cmd).toString();
    return raw.match(/versionName=(\S+)/)[1];
  }
  // Open the url in a new tab.
  async openUrl(url) {
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
    await this.client.elementSendKeys(urlBarToSendKeys, url + "\\n");
  }
  // Clean up and close the browser.
  async kill() {
    await this.client.terminateApp(this.packageName);
  }
  async clickContent() {
    let theWebView;
    if (this.contentElement) {
      theWebView = await findElement(this.client, this.packageName, this.contentElement);
    } else { 
      // Most browsers use a WebView
      theWebView = await findElementWithClass(this.client, "android.webkit.WebView");
    }
    await this.client.elementClick(theWebView);
  }
}

module.exports = { AndroidBrowser };

async function main() {
  const client = await WebDriver.newSession({
    port: 4723,
    hostname: "0.0.0.0",
    path: "/wd/hub",
    capabilities: { platformName: "Android", "newCommandTimeout": 300}
  });
  await demoBrowser(client, "edge", "https://edge.com");
}

if (require.main === module) {
  main();
}