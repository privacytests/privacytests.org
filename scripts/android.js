const WebDriver = require('webdriver');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
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
  cromite: {
    releasePackageName: 'org.cromite.cromite',
    urlBarClick: 'url_bar',
    urlBarKeys: 'url_bar'
  },
  duckduckgo: {
    displayName: 'DuckDuckGo',
    releasePackageName: 'com.duckduckgo.mobile.android',
    urlBarClick: 'omnibarTextInput',
    urlBarKeys: 'omnibarTextInput',
    highFiveButton: 'primaryCta'
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
    // Fresh install: Welcome → system default-browser dialog → in-app default promo.
    startupClicks: [
      '//android.view.View[@clickable="true" and .//android.widget.TextView[@text="Continue"]]',
      '//*[@resource-id="android:id/button2"]', // Cancel system "Set as default"
      '//android.view.View[@clickable="true" and .//android.widget.TextView[@text="Not now"]]'
    ],
    // Recent Firefox uses Compose toolbar (not mozac_browser_toolbar_*).
    // Click idle box → edit mode exposes ADDRESSBAR_SEARCH_BOX for typing.
    urlBarClick: '//*[@resource-id="ADDRESSBAR_URL_BOX"]',
    urlBarClick2: 'mozac_browser_toolbar_url_view',
    urlBarKeys: '//*[@resource-id="ADDRESSBAR_SEARCH_BOX"]'
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
    urlBarClick2: "//android.widget.TextView[@text='#search or site']",
    urlBarKeys: 'suggest_omnibox_query_edit',
    startupClick: 'bro_popup_cross_icon',
    contentElement: 'renderView'
  }
};

const KEY_ENTER = 66;

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

const versionNameFromDumpsys = (raw) =>
  String(raw).match(/versionName=(\S+)/)[1];

const getAppVersion = _.memoize((packageName) => {
  const cmd = `/opt/homebrew/bin/adb shell dumpsys package ${packageName} | /usr/bin/grep versionName`;
  return versionNameFromDumpsys(execSync(cmd).toString());
});

const browserstackCredentials = () => {
  const user = process.env.BROWSERSTACK_USERNAME;
  const key = process.env.BROWSERSTACK_ACCESS_KEY;
  if (!user || !key) {
    throw new Error(
      'BrowserStack requires BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY');
  }
  return { user, key };
};

const localAppiumSession = () =>
  WebDriver.newSession({
    port: 4723,
    hostname: '0.0.0.0',
    path: '/wd/hub',
    capabilities: {
      platformName: 'Android',
      'appium:newCommandTimeout': 600,
      'appium:automationName': 'UiAutomator2',
      'appium:uiautomator2ServerInstallTimeout': 90000
    }
  });

const browserstackAppFromEnv = () => {
  const app = process.env.BROWSERSTACK_APP;
  if (!app) {
    throw new Error(
      'BrowserStack App Automate requires BROWSERSTACK_APP (bs://... or custom_id) ' +
      'or BROWSERSTACK_APP_APK (local .apk/.aab/.zip path to upload).'
    );
  }
  return app;
};

const uploadBrowserstackApp = async ({ user, key, apkPath, customId }) => {
  const form = new FormData();
  form.append(
    'file',
    new Blob([fs.readFileSync(apkPath)]),
    path.basename(apkPath));
  if (customId) {
    form.append('custom_id', customId);
  }
  const auth = Buffer.from(`${user}:${key}`).toString('base64');
  const response = await fetch(
    'https://api-cloud.browserstack.com/app-automate/upload',
    {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      body: form
    });
  if (!response.ok) {
    throw new Error(
      `BrowserStack app upload failed (${response.status}): ${await response.text()}`);
  }
  const result = await response.json();
  console.log('Uploaded app to BrowserStack:', result);
  // Prefer custom_id when set; otherwise use the returned bs:// app_url.
  return customId || result.app_url;
};

const resolveBrowserstackApp = async ({ user, key }) => {
  const apkPath = process.env.BROWSERSTACK_APP_APK;
  if (apkPath) {
    if (!fs.existsSync(apkPath)) {
      throw new Error(`BROWSERSTACK_APP_APK not found: ${apkPath}`);
    }
    const customId = process.env.BROWSERSTACK_APP_CUSTOM_ID ||
      `privacytests-${path.basename(apkPath, path.extname(apkPath))}`;
    return uploadBrowserstackApp({ user, key, apkPath, customId });
  }
  return browserstackAppFromEnv();
};

// "17.0" and "17" should match; keep any other trailing segments as-is.
const normalizeOsVersion = (version) => {
  const parts = String(version).trim().split('.');
  while (parts.length > 1 && parts[parts.length - 1] === '0') {
    parts.pop();
  }
  return parts.join('.');
};

const fetchBrowserstackAndroidDevices = async ({ user, key }) => {
  const auth = Buffer.from(`${user}:${key}`).toString('base64');
  const response = await fetch(
    'https://api-cloud.browserstack.com/app-automate/devices.json',
    { headers: { Authorization: `Basic ${auth}` } });
  if (!response.ok) {
    throw new Error(
      `BrowserStack devices API failed (${response.status}): ${await response.text()}`);
  }
  const devices = await response.json();
  return devices.filter((d) => String(d.os).toLowerCase() === 'android');
};

const assertBrowserstackAndroidDeviceAvailable = async (
  { user, key, deviceName, osVersion }) => {
  const androidDevices = await fetchBrowserstackAndroidDevices({ user, key });
  const wantedOs = normalizeOsVersion(osVersion);
  const available = androidDevices.some((d) =>
    d.device === deviceName &&
    normalizeOsVersion(d.os_version) === wantedOs);
  if (available) {
    return;
  }
  const list = [...androidDevices]
    .map((d) => `${d.device} — Android ${d.os_version}`)
    .sort((a, b) => a.localeCompare(b))
    .join('\n');
  throw new Error(
    `BrowserStack device not available: "${deviceName}" / Android ${osVersion}\n` +
    `Available Android combinations:\n${list}`);
};

const browserstackAppiumSession = async () => {
  const { user, key } = browserstackCredentials();
  const deviceName = process.env.BROWSERSTACK_DEVICE_NAME || 'Google Pixel 9';
  const osVersion = process.env.BROWSERSTACK_OS_VERSION || '15.0';
  await assertBrowserstackAndroidDeviceAvailable(
    { user, key, deviceName, osVersion });
  const bstackOptions = {
    userName: user,
    accessKey: key,
    projectName: 'privacytests.org',
    buildName: process.env.BROWSERSTACK_BUILD_NAME || 'android',
    sessionName: process.env.BROWSERSTACK_SESSION_NAME || 'android-test',
    deviceName,
    osVersion,
    appiumVersion: process.env.BROWSERSTACK_APPIUM_VERSION || '2.0.1',
    // Required together so you can take over a live session from the dashboard.
    video: true,
    interactiveDebugging: true
  };
  const playUser = process.env.BROWSERSTACK_PLAY_USERNAME;
  const playPass = process.env.BROWSERSTACK_PLAY_PASSWORD;
  if (playUser && playPass) {
    bstackOptions.appStoreConfiguration = {
      username: playUser,
      password: playPass
    };
  }
  const app = await resolveBrowserstackApp({ user, key });
  return WebDriver.newSession({
    protocol: 'https',
    hostname: 'hub-cloud.browserstack.com',
    port: 443,
    path: '/wd/hub',
    user,
    key,
    capabilities: {
      platformName: 'Android',
      // Uploaded browser APK (or stub); browser under test is activated later.
      'appium:app': app,
      'appium:automationName': 'UiAutomator2',
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 600,
      'appium:noReset': true,
      'bstack:options': bstackOptions
    }
  });
};

// Memoize separately for local vs BrowserStack so the flag can be flipped safely.
const webdriverSession = _.memoize(
  (browserstack) => browserstack ? browserstackAppiumSession() : localAppiumSession(),
  (browserstack) => browserstack ? 'browserstack' : 'local'
);

class AndroidBrowser {
  constructor ({ browser, incognito, tor, nightly, browserstack }) {
    Object.assign(this, { browser, incognito, tor, nightly, browserstack }, browserInfo[browser]);
    this.packageName = nightly ? this.nightlyPackageName : this.releasePackageName;
  }

  // Launch the browser.
  async launch () {
    this.client = await webdriverSession(this.browserstack);
    // Terminating Chrome on BrowserStack App Automate can kill the session
    // (ChromeDriver/DevTools disconnect). Local Appium still needs a clean slate.
    if (!this.browserstack) {
      const state = await this.client.queryAppState(this.packageName);
      if (state >= 2) {
        await this.client.terminateApp(this.packageName);
      }
    }
    await this.client.activateApp(this.packageName);
    await sleepMs(8000);
    const startupSelectors = []
      .concat(this.startupClicks || [])
      .concat(this.startupClick || []);
    if (startupSelectors.length > 0) {
      // Multi-step onboarding / system dialogs (e.g. Firefox Continue, then Cancel default-browser).
      for (let i = 0; i < 8; ++i) {
        // Stop once the browser chrome is ready (avoids re-clicking after home).
        const ready = await findElement(
          this.client, this.packageName, this.urlBarClick);
        if (ready) {
          break;
        }
        let clicked = false;
        for (const selector of startupSelectors) {
          const startupButton = await findElement(
            this.client, this.packageName, selector);
          if (startupButton) {
            await this.client.elementClick(startupButton);
            clicked = true;
            await sleepMs(3000);
            break;
          }
        }
        if (!clicked) {
          break;
        }
      }
      await sleepMs(5000);
    }
  }

  // Get the browser version.
  async version () {
    if (!this.browserstack) {
      return getAppVersion(this.packageName);
    }
    const client = this.client || await webdriverSession(true);
    const raw = await client.executeScript(
      `browserstack_executor: {"action":"adbShell","arguments":{"command":"dumpsys package ${this.packageName}"}}`,
      []);
    return versionNameFromDumpsys(raw);
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
    await this.client.elementClear(urlBarToSendKeys);
    if (this.goButton) {
      await this.client.elementSendKeys(urlBarToSendKeys, url);
      const goButton = await findElement(this.client, this.packageName, this.goButton);
      await this.client.elementClick(goButton);
    } else {
      await this.client.elementSendKeys(urlBarToSendKeys, url);
      await this.client.appiumPressKeyCode(KEY_ENTER);
    }
  }

  // Open the url in a new tab.
  async openUrl (url) {
    const attempts = 2;
    let lastError;
    for (let i = 0; i < attempts; ++i) {
      try {
        await this.openUrlOnce(url);
        // Success!
        return;
      } catch (e) {
        lastError = e;
        console.log(e);
        if (i < attempts - 1) {
          await sleepMs(3000);
        }
      }
    }
    try {
      const source = await this.client.getPageSource();
      console.log('UI hierarchy after openUrl failure:\n', source);
    } catch (dumpError) {
      console.log('Failed to dump UI hierarchy:', dumpError);
    }
    throw lastError;
  }

  async highFiveIfNecessary () {
    if (!this.highFiveButton) {
      return;
    }
    try {
      const highFive = await findElement(this.client, this.packageName, this.highFiveButton);
      if (highFive !== undefined) {
        await this.client.elementClick(highFive);
      }
    } catch (e) {
      console.log("No high five button found");
    }
  }

  // Clean up and close the browser.
  async kill () {
    await this.client.terminateApp(this.packageName);
  }

  async restart() {
    await this.kill();
    await sleepMs(2000);
    await this.launch();
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
  await client.elementSendKeys(urlBarToSendKeys, url);
  await client.pressKeyCode(KEY_ENTER);
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
