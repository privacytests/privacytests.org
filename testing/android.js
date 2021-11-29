const { default: WebDriver}  = require("webdriver");

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
    urlBarClick: "url_bar",
    urlBarClick2: "search_box_text",
    urlBarKeys: "url_bar"
  },
  duckduckgo: {
    packageName: "com.duckduckgo.mobile.android",
    urlBarClick: "omnibarTextInput",
    urlBarKeys: "omnibarTextInput"
  },
  edge: {
    packageName: "com.microsoft.emmx",
    urlBarClick: "url_bar",
    urlBarKeys: "url_bar"
  },
  firefox: {
    packageName: "org.mozilla.firefox",
    urlBarClick: "mozac_browser_toolbar_url_view",
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
    urlBarKeys: "location_bar_edit_text"
  },
  tor: {
    packageName: "org.torproject.torbrowser",
    startupClick: "tor_bootstrap_connect_button",
    urlBarClick: "toolbar",
    urlBarKeys: "mozac_browser_toolbar_edit_url_view"
  },
  uc: {
    packageName: "com.UCMobile.intl",
    urlBarClick: "TextView between content-desc='data saving' and content-desc='refresh' ",
    urlBarKeys: "//android.widget.LinearLayout[@content-desc=\"Search or Enter URL edit box\"]/android.widget.EditText"
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
    urlBarClick: "bro_sentry_bar_fake_text",
    urlBarKeys: "suggest_omnibox_query_edit"
  }
};

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const findElementWithId = async (client, packageName, id) => {
  const elementObject = await client.findElement("id", `${packageName}:id/${id}`);
  return elementObject.ELEMENT;
};

const demoBrowser = async (client, browserName, url) => {
  const { startupClick, packageName, urlBarClick, urlBarKeys } = browserInfo[browserName];
  await client.activateApp(packageName);
  await sleepMs(5000);
  if (startupClick) {
    const startupButton = await findElementWithId(client, packageName, startupClick);
    await client.elementClick(startupButton)
    await sleepMs(3000);
  }
  const urlBarToClick = await findElementWithId(client, packageName, urlBarClick);
  await client.elementClick(urlBarToClick);
  await sleepMs(1000);
  const urlBarToSendKeys = await findElementWithId(client, packageName, urlBarKeys);
  await client.elementSendKeys(urlBarToSendKeys, url + "\\n");
  await sleepMs(8000);
  await client.terminateApp(packageName);
};

const demoAllBrowsers = async (client, url) => {
  for (let browser of Object.keys(browserInfo)) {
    try {
      console.log(`running ${browser} demo`)
      await demoBrowser(client, browser, url);
    } catch (e) {
      console.log(e);
    }
  }
};

async function main() {
  console.log(WebDriver);
  const client = await WebDriver.newSession({
    port: 4723,
    hostname: "0.0.0.0",
    path: "/wd/hub",
    capabilities: { platformName: "Android"}
  });
  await demoBrowser(client, "edge", "https://edge.com");
//  await demoAllBrowsers(client, "https://arthuredelstein.net");
}
main();