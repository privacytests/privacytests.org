const child_process = require('child_process');
const fs = require("fs");
const { join: joinDir } = require("path");

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const execSync = (command, options) => {
  console.log(command);
  return child_process.execSync(command, options);
};

const exec = (command, options) => {
  console.log(command);
  return child_process.exec(command, options);
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
*/

// macOS parts of the browser launch command
const macOSdefaultBrowserSettings = {
  defaultValues: {
    appDirectory: "/Applications",
    binaryPath: "Contents/MacOS"
  },
  brave: {
    name: "Brave Browser",
    nightlyName: "Brave Browser Nightly",
    privateFlag: "incognito",
    torFlag: "tor",
    dataDir: "BraveSoftware/Brave-Browser",
    nightlyDataDir: "BraveSoftware/Brave-Browser-Nightly"
  },
  chrome: {
    name: "Google Chrome",
    nightlyName: "Google Chrome Canary",
    privateFlag: "incognito",
    dataDir: "Google/Chrome",
    nightlyDataDir: "Google/Chrome Canary"
  },
  firefox: {
    name: "firefox",
    nightlyName: "Firefox Nightly",
    privateFlag: "private-window",
    dataDir: "Firefox/Profiles/",
    profile: "firefox_profile",
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: "1" }
  },
  librewolf: {
    name: "librewolf",
    privateFlag: "private-window",
    dataDir: "LibreWolf/Profiles/",
    profile: "librewolf_profile",
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: "1" }
  },
  edge: {
    name: "Microsoft Edge",
    nightlyName: "Microsoft Edge Canary",
    privateFlag: "inprivate",
    dataDir: "Microsoft Edge",
    nightlyDataDir: "Microsoft Edge Canary"
  },
  opera: {
    name: "Opera",
    nightlyName: "Opera Developer",
    privateFlag: "private",
    dataDir: "com.operasoftware.Opera",
    nightlyDataDir: "com.operasoftware.OperaDeveloper"
  },
  safari: {
    name: "Safari",
    nightlyName: "Safari Technology Preview",
    useOpen: true,
    incognitoCommand: "osascript safariPBM.applescript",
    postLaunchDelay: 6000
  },
  tor: {
    name: "Tor Browser",
    nightlyName: "Tor Browser Nightly",
    binaryName: "firefox",
    useOpen: true,
    dataDir: "TorBrowser-Data",
    preLaunchDelay: 10000,
    postLaunchDelay: 10000
  },
  ungoogled: {
    name: "Ungoogled Chromium",
    binaryName: "Chromium",
    privateFlag: "incognito",
    dataDir: "Google/Chrome",
  },
  vivaldi: {
    name: "Vivaldi",
    nightlyName: "Vivaldi Snapshot",
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
  const appName = nightly ? browserValues.nightlyName : browserValues.name;
  const fullBinaryPath = `${appDirectory}/${appName}.app/${binaryPath}`;
  const executablePath1 = `${fullBinaryPath}/${binaryName}`;
  const executablePath2 = `${fullBinaryPath}/${appName}`;
  if (fs.existsSync(executablePath1)) {
    return executablePath1;
  } else {
    return executablePath2;
  }
};

const browserCommand = ({browser, pathToBrowser, incognito, tor, appPath, profilePath }) => {
  const { privateFlag, torFlag, useOpen } = macOSdefaultBrowserSettings[browser];
  if (useOpen) {
    return `open -a "${appPath}"`;
  } else {
    const flags = `${incognito ? "--" + privateFlag : ""} ${tor ? "--" + torFlag : ""} ${profilePath ? `-profile "${profilePath}"` : ""}`;
    return `"${pathToBrowser}" ${flags}`.trim();
  }
};

// A Browser object represents a browser we run tests on.
class DesktopBrowser {
  constructor({browser, path, incognito, tor, nightly}) {
    Object.assign(this, {browser, incognito, tor, nightly});
    this._defaults = macOSdefaultBrowserSettings[browser];
    this._path = path ?? browserPath({browser, nightly});
    this._profilePath = this._defaults.profile ? joinDir(__dirname, this._defaults.profile) : undefined;
    this._version = undefined;
    this._appPath = this._path.split(".app")[0] + ".app";
    this._command = browserCommand({
      browser, incognito, tor,
      pathToBrowser: this._path, appPath: this._appPath, profilePath: this._profilePath
    });
    this._keepAlivePingId = null;
    this._appName = nightly ? this._defaults.nightlyName : this._defaults.name;
  }
  // Launch the browser.
  async launch() {
    await sleepMs(this._defaults.preLaunchDelay ?? 0);
    console.log(this._defaults);
    if (this._profilePath) {
      // Delete old profiles if they exist.
      console.log(`Deleting any old ${this._profilePath}`);
      fs.rmSync(this._profilePath, { recursive: true, force: true });
    }
    this._process = exec(this._command, { env: this._defaults.env });
    await sleepMs(this._defaults.postLaunchDelay ?? 0);
    await sleepMs(5000);
    if (this.incognito && this._defaults.incognitoCommand) {
        exec(`${this._defaults.incognitoCommand} "${this._appName}"`);
        await sleepMs(5000);
    }
  }
  // Get the browser version.
  async version() {
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
  async openUrl(url) {
    exec(`${this._command} "${url}"`);
  }
  // Clean up and close the browser.
  async kill() {
    try {
      await sleepMs(1000);
      execSync(`osascript closeAllWindows.applescript "${this._appName}"`);
      await sleepMs(1000);
    } catch (e) {
      console.log(e);
    }
    try {
      clearInterval(this._keepAlivePingId);
      execSync(`osascript -e 'quit app "${this._appName}"'`);
      await sleepMs(5000);
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = { DesktopBrowser };
