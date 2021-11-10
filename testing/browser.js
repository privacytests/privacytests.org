const child_process = require('child_process');
const { connect } = require("it-ws/client");
const robot = require("robotjs");
const { existsSync } = require("fs");
const path = require("path");

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const execSync = command => {
  console.log(command);
  return child_process.execSync(command);
};

const exec = command => {
  console.log(command);
  return child_process.exec(command);
};

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
    nightly: "Brave Browser Nightly",
    privateFlag: "incognito",
    torFlag: "tor",
    dataDir: "BraveSoftware/Brave-Browser",
    nightlyDataDir: "BraveSoftware/Brave-Browser-Nightly"
  },
  chrome: {
    name: "Google Chrome",
    nightly: "Google Chrome Canary",
    privateFlag: "incognito",
    dataDir: "Google/Chrome",
    nightlyDataDir: "Google/Chrome Canary"
  },
  firefox: {
    name: "firefox",
    nightly: "Firefox Nightly",
    privateFlag: "private-window",
    dataDir: "Firefox/Profiles/",
  },
  edge: {
    name: "Microsoft Edge",
    nightly: "Microsoft Edge Canary",
    privateFlag: "inprivate",
    dataDir: "Microsoft Edge",
    nightlyDataDir: "Microsoft Edge Canary"
  },
  opera: {
    name: "Opera",
    nightly: "Opera Developer",
    privateFlag: "private",
    dataDir: "com.operasoftware.Opera",
    nightlyDataDir: "com.operasoftware.OperaDeveloper"
  },
  safari: {
    name: "Safari",
    nightly: "Safari Technology Preview",
    useOpen: true,
    incognitoCommand: "osascript safariPBM.applescript",
    postLaunchDelay: 6000
  },
  tor: {
    name: "Tor Browser",
    nightly: "Tor Browser Nightly",
    binaryName: "firefox",
    useOpen: true,
    dataDir: "TorBrowser-Data",
    preLaunchDelay: 10000,
    postLaunchDelay: 10000
  },
  vivaldi: {
    name: "Vivaldi",
    nightly: "Vivaldi Snapshot",
    privateFlag: "incognito",
    dataDir: "Vivaldi",
    nightlyDataDir: "Vivaldi Snapshot",
    preLaunchDelay: 10000,
    postLaunchDelay: 10000
  }
};

const browserPath = ({browser, nightly}) => {
  const { appDirectory, binaryPath } = macOSdefaultBrowserSettings.defaultValues;
  const browserValues = macOSdefaultBrowserSettings[browser];
  const binaryName = browserValues.binaryName ?? browserValues.name;
  const appName = nightly ? browserValues.nightly : browserValues.name;
  const fullBinaryPath = `${appDirectory}/${appName}.app/${binaryPath}`;
  const executablePath1 = `${fullBinaryPath}/${binaryName}`;
  const executablePath2 = `${fullBinaryPath}/${appName}`;
  if (existsSync(executablePath1)) {
    return executablePath1;
  } else {
    return executablePath2;
  }
};

const browserCommand = ({browser, path, incognito, tor, appPath}) => {
  const { privateFlag, torFlag, useOpen } = macOSdefaultBrowserSettings[browser];
  if (useOpen) {
    return `open -a "${appPath}"`;
  } else {
    const flags = `${incognito ? "--" + privateFlag : ""} ${tor ? "--" + torFlag : ""}`;
    return `"${path}" ${flags}`.trim();
  }
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
  constructor({browser, path, incognito, tor, nightly}) {
    Object.assign(this, {browser, incognito, tor, nightly});
    this._defaults = macOSdefaultBrowserSettings[browser];
    this._path = path ?? browserPath({browser, nightly});
    this._version = undefined;
    this._appPath = this._path.split(".app")[0] + ".app";
    this._command = browserCommand({browser, path: this._path, incognito, tor, appPath: this._appPath});
    this._openTabs = 0;
    this._sessionId = null;
    this._resultsWebSocket = null;
    this._keepAlivePingId = null;
  }
  // Launch the browser.
  async launch() {
    await sleepMs(this._defaults.preLaunchDelay ?? 0);
    this._process = exec(this._command);
    await sleepMs(this._defaults.postLaunchDelay ?? 0);
    await sleepMs(5000);
    if (this.incognito && this._defaults.incognitoCommand) {
      const { name, nightly  } = this._defaults;
      const appName = this.nightly ? nightly : name;
//      execSync(`${this._defaults.incognitoCommand} "${appName}"`);
    }
    this._resultsWebSocket = await connect("wss://results.privacytests.org/ws");
    const firstMessage = await this._resultsWebSocket.source.next();
    this._keepAlivePingId = setInterval(() => this._resultsWebSocket.socket.send("ping"), 30000);
    console.log("message received", (new Date()).toISOString());
    console.log(firstMessage);
    const { sessionId } = JSON.parse(firstMessage.value);
    this._sessionId = sessionId;
  }
  // Get the browser version.
  get version() {
    if (!this._version) {
      this._version = execSync(`mdls -name kMDItemVersion -raw "${this._appPath}"`).toString();
    }
    if (this.browser === "brave") {
      // Weird brave thing. When the version is 1.31.87, kMDItemVersion is 95.1.31.87,
      // where "95" refers to the Chromium major version.
      this._version = this._version.split('.').slice(1).join('.');
    }
    return this._version;
  }
  // Open the url in a new tab.
  openUrl(url) {
    exec(`${this._command} "${url}"`);
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
    try {
      this._resultsWebSocket.destroy();
    } catch (e) {
      console.log(e);
    }
    try {
      for (let i = 0; i<this._openTabs; ++i) {
        robot.keyTap("w", "command");
      }
      // Wait for the tabs to close
      await sleepMs(500 * this._openTabs);
    } catch (e) {
      console.log(e);
    }
    try {
      clearInterval(this._keepAlivePingId);
      execSync(`killall "${path.basename(this._path)}"`);
      await sleepMs(5000);
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = { Browser };
