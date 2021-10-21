const { exec, execSync } = require('child_process');
const { connect } = require("it-ws/client");
const robot = require("robotjs");

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));


/*
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --incognito "https://example.com"
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --tor "https://example.com"
/Applications/Firefox.app/Contents/MacOS/firefox --private-window https://arthuredelstein.net
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --incognito "https://arthuredelstein.net"
/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --inprivate "https://example.com"
/Applications/Opera.app/Contents/MacOS/Opera --private "https://example.com"
/Applications/Vivaldi.app/Contents/MacOS/Vivaldi --incognito "https://arthuredelstein.net"
open -a Safari "https://example.com"
// Todo:: Investigate osascript for launching Safari/incognito mode instead
*/

// macOS parts of the browser launch command
const macOSdefaultBrowserSettings = {
  defaultValues: {
    appDirectory: "/Applications",
    binaryPath: "Contents/MacOS"
  },
  brave: {
    name: "Brave Browser",
    privateFlag: "incognito",
    torFlag: "tor",
  },
  chrome: {
    name: "Google Chrome",
    privateFlag: "incognito",
    doubleTapKill: true
  },
  firefox: {
    name: "firefox",
    privateFlag: "private-window"
  },
  edge: {
    name: "Microsoft Edge",
    privateFlag: "inprivate"
  },
  opera: {
    name: "Opera",
    privateFlag: "private",
  },
  safari: {
    name: "Safari",
    command: "open -a Safari",
    incognitoFunction: async () => {
      robot.keyTap("n", ["command","shift"]);
    },
    doubleTapKill: true
  },
  tor: {
    name: "Tor Browser",
    binaryName: "firefox",
    useAppToOpenUrls: true,
  },
  vivaldi: {
    name: "Vivaldi",
    privateFlag: "incognito"
  }
};

const browserPath = (browser) => {
  const { appDirectory, binaryPath } = macOSdefaultBrowserSettings.defaultValues;
  const browserValues = macOSdefaultBrowserSettings[browser];
  const binaryName = browserValues.binaryName ?? browserValues.name;
  return `${appDirectory}/${browserValues.name}.app/${binaryPath}/${binaryName}`;
};

const browserCommand = ({browser, path, incognito, tor}) => {
  const { privateFlag, torFlag } = macOSdefaultBrowserSettings[browser];
  const flags = `${incognito ? "--" + privateFlag : ""} ${tor ? "--" + torFlag : ""}`;
  return `"${path}" ${flags}`.trim();
};


const nextValue = async(websocket, expectedSessionId) => {
  const message = await websocket.source.next();
  if (message.value === undefined) {
    throw new Error(`Unexpected message: ${JSON.stringify(message)}`);
  }
  const { sessionId, data } = JSON.parse(message.value);
  if (sessionId !== expectedSessionId) {
    throw new Error("Unexpected sessionId");
  }
  return data;
};

// Accepts a url string and a key and val to add search parameter.
const addSearchParam = (url, key, val) => {
  let urlObject = new URL(url);
  urlObject.searchParams.set(key, val);
  return urlObject.href;
};

// A Browser object represents a browser we run tests on.
class Browser {
  constructor({browser, path, incognito, tor}) {
    Object.assign(this, {browser, incognito, tor});
    this._defaults = macOSdefaultBrowserSettings[browser];
    this._path = path ?? browserPath(browser);
    this._version = undefined;
    this._command = this._defaults.command ?? browserCommand({browser, path: this._path, incognito, tor});
    this._openTabs = 0;
    this._appPath = this._path.split(".app")[0] + ".app";
    this._sessionId = null;
    this._resultsWebSocket = null;
  }
  // Launch the browser.
  async launch() {
    this._process = exec(this._command);
    await sleepMs(5000);
    if (this.incognito && this._defaults.incognitoFunction) {
      await this._defaults.incognitoFunction();
    }
    this._resultsWebSocket = await connect("wss://results.privacytests.org/ws");
    const firstMessage = await this._resultsWebSocket.source.next();
    console.log(firstMessage);
    const { sessionId } = JSON.parse(firstMessage.value);
    this._sessionId = sessionId;
  }
  // Get the browser version.
  get version() {
    if (!this._version) {
      this._version = execSync(`mdls -name kMDItemVersion -raw "${this._appPath}"`).toString();
    }
    return this._version;
  }
  // Open the url in a new tab. 
  openUrl(url) {
    if (!this._defaults.useAppToOpenUrls) {
      exec(`${this._command} "${url}"`);
    } else {
      exec(`open -a "${this._appPath}" "${url}"`);
    }
    this._openTabs++;
  }
  async nextTestResult() {
    return await nextValue(this._resultsWebSocket, this._sessionId);
  }
  // Run a test where we open a tab at url and wait for 1 or more
  // results to come back.
  async runTest(url, resultCountExpected = 1) {
    const url2 = addSearchParam(url, "sessionId", this._sessionId);
    this.openUrl(url2);
    if (resultCountExpected === 1) {
      return this.nextTestResult();
    } else {
      let results = [];
      for (let i = 0; i<resultCountExpected; ++i) {
        results.push(await this.nextTestResult());
      }
      return results;
    }
  }
  // Clean up and close the browser.
  async kill() {
    for (let i = 0; i<this._openTabs; ++i) {
      robot.keyTap("w", "command");
      await sleepMs(100);
    }
    robot.keyTap("q", "command");
    if (this._defaults.doubleTapKill) {
      robot.keyTap("q", "command");
    }
  }
}

module.exports = { Browser };
