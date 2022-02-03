const { default: WebDriver}  = require("webdriver");

const browserInfo = {
  brave: {
		name: "Brave",
    bundleId: "com.brave.ios.browser",
    urlBarClick: "url",
    urlBarKeys: "url",
		privateWindow: ["TabToolbar.tabsButton", "Private Mode", "TabTrayController.doneButton"],
		// Brave starts in normal window mode.
  },
  chrome: {
		name: "Chrome",
    bundleId: "com.google.chrome.ios",
		urlBarClick: "NTPHomeFakeOmniboxAccessibilityID",
		//urlBarClick2: "Toolbar",
		urlBarClick2: "Address and search bar",
		urlBarKeys: "Address",
		privateWindow: ["kToolbarStackButtonIdentifier", "TabGridIncognitoTabsPageButtonIdentifier", "TabGridDoneButtonIdentifier"],
		normalWindow: ["kToolbarStackButtonIdentifier", "TabGridRegularTabsPageButtonIdentifier", "TabGridDoneButtonIdentifier"]
  },
  duckduckgo: {
		name: "DuckDuckGo",
    bundleId: "com.duckduckgo.mobile.ios",
		urlBarClick: "searchEntry",
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
		urlBarClickClass: "XCUIElementTypeTextField", // Hoping this is the only one present
		urlBarKeys: "Onion Browser", // application element
		urlBarClear: "Clear text",
		postLaunchDelay: 10000,
		// No additional private mode
  },
  opera: {
		name: "Opera",
    bundleId: "com.opera.OperaTouch",
		urlBarClickClass: "XCUIElementTypeTextField", // Hoping this is the only one present
		urlBarKeys: "addressBar", // parent element
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
		startupClick: "Fix problems",
		urlBarClick: "Address bar",
		urlBarClick2: "Enter a search query or URL",
		urlBarClear: "Clear the input field",
		urlBarKeys: "Yandex", // Just send keys to the application and hope our focus is correct
  }
};

let versionsSeen = {};

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

const clickSeries = async (client, names) => {
	for (let name of names) {
		console.log(`clicking ${name}`)
		await clickElementWithName(client, name);
	}
}

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
		if (this.incognito) {
			if (this.privateWindow) {
				await clickSeries(this.client, this.privateWindow);
			}
		} else {
			if (this.normalWindow) {
				await clickSeries(this.client, this.normalWindow);
			}
		}
		await sleepMs(2000);
  }
  // Get the browser version.
  async version() {
		const browserSpec = `${this.browser}|${this.nightly}`;
		const maybeSeen = versionsSeen[browserSpec];
		if (maybeSeen) {
			return maybeSeen;
		}
		// We don't have the browser version yet. Go get it.
		await this.client.terminateApp("com.apple.Preferences");
		//await sleepMs(1000);
		await this.client.activateApp("com.apple.Preferences");
		//await sleepMs(500);
		await clickElementWithName(this.client, "General");
		//await sleepMs(500);
		await clickElementWithName(this.client, "iPhone Storage");
		await sleepMs(8000);
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
			await clickElementWithName(this.client,  `App:${this.name}`);
		}
		await sleepMs(1000);
		const infoElement = await findElementWithName(this.client, "Info");
		console.log(infoElement);
		const infoText = await this.client.getElementText(infoElement);
		// Remove the word "Version" from the info text if it's present.
		const versionText = infoText.replace("Version ", "").trim();
		await this.client.terminateApp("com.apple.Preferences");
		versionsSeen[browserSpec] = versionText;
		return versionText;
  }
  // Open the url in a new tab.
  async openUrl(url) {
		let urlBarToClick;
		if (this.urlBarClickClass) {
			urlBarToClick = await findElementWithClass(this.client, this.urlBarClickClass);
		} else {
			urlBarToClick = await findElementWithName(this.client, this.urlBarClick);
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
		}	
    await this.client.elementClick(urlBarToClick);
    await sleepMs(1000);
		if (this.urlBarClear) {
			await clickElementWithName(this.client, this.urlBarClear);
		}
    const urlBarToSendKeys = await findElementWithName(this.client, this.urlBarKeys);
    await this.client.elementSendKeys(urlBarToSendKeys, url);
		const goButton = await findElementWithName(this.client, "Go");
		await this.client.elementClick(goButton);
  }
  // Clean up and close the browser.
  async kill() {
		await this.client.terminateApp(this.bundleId);
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