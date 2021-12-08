const { default: WebDriver}  = require("webdriver");

const browserInfo = {
  brave: {
		name: "Brave",
    bundleId: "com.brave.ios.browser",
    urlBarClick: "url",
    urlBarKeys: "url"
  },
  chrome: {
		name: "Chrome",
    bundleId: "com.google.chrome.ios",
		urlBarClick: "Search or type URL",
		urlBarKeys: "Search or type URL",
  },
  duckduckgo: {
		name: "DuckDuckGo",
    bundleId: "com.duckduckgo.mobile.ios",
		urlBarClick: "searchEntry",
		urlBarClear: "Clear Text",
		urlBarKeys: "searchEntry",
  },
  edge: {
		name: "Edge",
    bundleId: "com.microsoft.msedge",
		urlBarClick: "Search and address bar",
		urlBarClick2: "NTPHomeFakeOmniboxAccessibilityID",
		urlBarKeys: "Address"
  },
  firefox: {
		name: "Firefox",
    bundleId: "org.mozilla.ios.Firefox",
    urlBarClick: "url",
    urlBarKeys: "address"
  },
  focus: {
		name: "Firefox Focus",
    bundleId: "org.mozilla.ios.Focus",
		urlBarClick: "URLBar.urlText",
		urlBarKeys: "URLBar.urlText",
  },
  onion: {
		name: "Onion Browser",
    bundleId: "com.miketigas.OnionBrowser",
		urlBarClickElement: "XCUIElementTypeTextField",
		urlBarKeysElement: "XCUIElementTypeTextField",
  },
  opera: {
		name: "Opera",
    bundleId: "com.opera.OperaTouch",
		urlBarClickElement: "XCUIElementTypeTextField", // Search or enter an address
		urlBarKeysElement: "XCUIElementTypeTextField", // Search or enter an address
  },
  safari: {
		name: "Safari",
    bundleId: "com.apple.mobilesafari",
    urlBarClick: "TabBarItemTitle",
    urlBarKeys: "URL"
  },
  yandex: {
		name: "Yandex",
    bundleId: "ru.yandex.mobile.search",
		urlBarClick: "Enter a search query or URL",
		urlBarKeysSibling: "Clear the input field",
		// //XCUIElementTypeApplication[@name="Yandex"]/XCUIElementTypeWindow[1]/XCUIElementTypeOther/XCUIElementTypeOther/XCUIElementTypeOther/XCUIElementTypeOther[2]/XCUIElementTypeOther[4]/XCUIElementTypeOther/XCUIElementTypeTextView
  }
};

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const findElementWithName = async (client, name) => {
  const elementObject = await client.findElement("name", name);
  return elementObject.ELEMENT;
};

const clickElementWithName = async (client, name) => {
	const element = await findElementWithName(client, name);
	return await client.elementClick(element);
};

const findElementWithClass = async (client, className) => {
  const elementObject = await client.findElement("class name", className);
  return elementObject.ELEMENT;
};

class iOSBrowser {
  constructor({browser, incognito, tor, nightly}) {
    Object.assign(this, { browser, incognito, tor, nightly }, browserInfo[browser]);
  }
  // Launch the browser.
  async launch() {
		const client = await WebDriver.newSession({
			port: 4723,
			hostname: "0.0.0.0",
			path: "/wd/hub",
			capabilities: {
				"appium:bundleId": this.bundleId,
				"platformName": "iOS",
				"appium:udid": "auto",
				"appium:xcodeOrgId": "MGQ2CFRT2X",
				"appium:xcodeSigningId": "iPhone Developer",
				"appium:automationName": "XCUITest",
				"appium:deviceName": "iPhone 7",
				"appium:wdaLaunchTimeout": 30000,
				"appium:wdaConnectionTimeout": 30000,
			//	"appium:platformVersion": "15.1"
			}
		});
    this.client = client;
  }
  // Get the browser version.
  async version() {
		await this.client.terminateApp("com.apple.Preferences");
		//await sleepMs(1000);
		await this.client.activateApp("com.apple.Preferences");
		//await sleepMs(500);
		await clickElementWithName(this.client, "General");
		//await sleepMs(500);
		await clickElementWithName(this.client, "iPhone Storage");
		await sleepMs(4000);
		if (this.browser === "safari") {
			const elements = await this.client.findElements("name", "Title");
			console.log(elements);
			for (let element of elements.reverse()) {
				const label = await this.client.getElementAttribute(element.ELEMENT, "label");
				console.log(label);
				if (label && label.startsWith("iOS")) {
				  await this.client.elementClick(element.ELEMENT);
					break;
				}
			}
		} else {
			await clickElementWithName(this.client,  `App:${appName}`);
		}
		await sleepMs(1000);
		const infoElement = await findElementWithName(this.client, "Info");
		console.log(infoElement);
		const infoText = await this.client.getElementText(infoElement);
		// Remove the word "Version" from the info text if it's present.
		const versionText = infoText.replace("Version ", "").trim();
		await this.client.terminateApp("com.apple.Preferences");
		return versionText;
  }
  // Open the url in a new tab.
  async openUrl(url) {
    let urlBarToClick = await findElementWithName(this.client, this.urlBarClick);
    if (urlBarToClick === undefined) {
      if (this.urlBarClick2) {
        urlBarToClick = await findElementWithName(this.client, this.urlBarClick2);
      }
      if (urlBarToClick === undefined) {
        urlBarToClick = await findElementWithName(this.client, this.urlBarKeys);
//      await sleepMs(1000);
//      urlBarToClick = await findElementWithId(this.client, this.packageName, this.urlBarClick);
      }
    }
    await this.client.elementClick(urlBarToClick);
    await sleepMs(1000);
    const urlBarToSendKeys = await findElementWithName(this.client, this.urlBarKeys);
    await this.client.elementSendKeys(urlBarToSendKeys, url);
		const goButton = await findElementWithName(this.client, "Go");
		await this.client.elementClick(goButton);
  }
  // Clean up and close the browser.
  async kill() {
		await this.client.deleteSession();
  }
  async clickContent() {
    let theWebView = await findElementWithClass(this.client, "XCUIElementTypeWebView");
    await this.client.elementClick(theWebView);
  }
}

module.exports = { iOSBrowser };

async function main() {
	const browser = new iOSBrowser({browser:"safari"});
	await browser.launch();
	console.log(await browser.version());

//	await browser.openUrl("https://youtube.com");
}

if (require.main === module) {
  main();
}