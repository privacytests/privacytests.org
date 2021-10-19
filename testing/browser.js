const { exec, execSync } = require('child_process');
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
    killFunction: () => {
      robot.keyTap("q", ["command"]);
    }
  },
  chrome: {
    name: "Google Chrome",
    privateFlag: "incognito"
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
    privateFlag: "private"
  },
  safari: {
    name: "Safari",
    command: "open -a Safari",
    incognitoFunction: async () => {
      robot.keyTap("w", ["command"]);
      robot.keyTap("n", ["command","shift"]);
    },
    killFunction: () => {
      robot.keyTap("q", ["command"]);
    }
  },
  tor: {
    name: "Tor Browser",
    binaryName: "firefox"
  },
  vivaldi: {
    name: "Vivaldi",
    privateFlag: "incognito"
  }
};

const browserPath = (browser) => {
  const { appDirectory, binaryPath } = macOSdefaultBrowserSettings.defaultValues;
  const browserValues = macOSdefaultBrowserSettings[browser];
  const name = browserValues.binaryName ?? browserValues.name;
  return `${appDirectory}/${name}.app/${binaryPath}/${name}`;
};

const browserCommand = ({browser, path, incognito, tor}) => {
  const { privateFlag, torFlag } = macOSdefaultBrowserSettings[browser];
  const flags = `${incognito ? "--" + privateFlag : ""} ${tor ? "--" + torFlag : ""}`;
  return `"${path}" ${flags}`.trim();
};

// A Browser object represents a browser we run tests on.
class Browser {
  constructor({browser, path, incognito, tor}) {
    Object.assign(this, {browser, incognito, tor});
    this._defaults = macOSdefaultBrowserSettings[browser];
    this._path = path ?? browserPath(browser);
    this._version = undefined;
    this._command = this._defaults.command ?? browserCommand({browser, path: this._path, incognito, tor});
  }
  // Launch the browser.
  async launch() {
    this._process = exec(this._command);
    await sleepMs(3000);
    if (this.incognito && this._defaults.incognitoFunction) {
      await this._defaults.incognitoFunction();
    }
  }
  // Get the browser version.
  get version() {
    if (!this._version) {
      const shortPath = this._path.split(".app")[0] + ".app";
      this._version = execSync(`mdls -name kMDItemVersion -raw "${shortPath}"`).toString();
    }
    return this._version;
  }
  // Open the url in a new tab. 
  openUrl(url) {
    exec(`${this._command} "${url}"`);
  }
  // Close the browser.
  kill() {
    if (this._defaults.killFunction) {
      this._defaults.killFunction();
    } else {
      this._process.kill();
    }
  }
}

module.exports = { Browser };
