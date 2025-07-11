const fs = require('fs');
const fsPromises = require('node:fs/promises');
const { join: joinDir } = require('path');
const { exec, execSync, execAsync, sleepMs } = require('./utils');
const systemNetworkSettings = require('./system-network-settings');
const { killProcessesWithPattern } = require('./utils');
const path = require('node:path');

/*
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --incognito "https://example.com"
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --tor "https://example.com"
/Applications/Firefox.app/Contents/MacOS/firefox --private-window "https://example.com"
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --incognito "example.com"
/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --inprivate "https://example.com"
/Applications/Opera.app/Contents/MacOS/Opera --private "https://example.com"
/Applications/Vivaldi.app/Contents/MacOS/Vivaldi --incognito "https://example.com"
open -a Safari "https://example.com"
*/

// macOS parts of the browser launch command
const macOSdefaultBrowserSettings = {
  brave: {
    name: 'Brave Browser',
    nightlyName: 'Brave Browser Nightly',
    privateFlag: 'incognito',
    torFlag: 'tor',
    torPostLaunchDelay: 10000,
    basedOn: 'chromium',
    update: ['Brave', 'About Brave'],
    updateNightly: ['Brave', 'About Brave']
  },
  chrome: {
    name: 'Google Chrome',
    nightlyName: 'Google Chrome Canary',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    update: ['Chrome', 'About Google Chrome'],
    updateNightly: ['Chrome Canary', 'About Google Chrome']
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    nightlyName: 'DuckDuckGo',
    useOpen: true
    //   incognitoCommand: "osascript safariPBM.applescript",
    //    basedOn: "safari",
  },
  edge: {
    name: 'Microsoft Edge',
    nightlyName: 'Microsoft Edge Canary',
    privateFlag: 'inprivate',
    basedOn: 'chromium',
    update: ['Microsoft Edge', 'About Microsoft Edge'],
    updateNightly: ['Microsoft Edge Canary', 'About Microsoft Edge']
  },
  firefox: {
    name: 'firefox',
    nightlyName: 'Firefox Nightly',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1', MOZ_CRASHREPORTER_DISABLE: '1' },
    update: ['Firefox', 'About Firefox'],
    postLaunchDelay: 1000,
    updateNightly: ['Firefox Nightly', 'About Nightly']
  },
  librewolf: {
    name: 'librewolf',
    displayName: 'LibreWolf',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    updateCommand: '/opt/homebrew/bin/brew upgrade librewolf --no-quarantine',
    postLaunchDelay: 2000
  },
  mullvad: {
    name: 'Mullvad Browser',
    binaryName: 'mullvadbrowser',
    basedOn: 'firefox',
    useOpen: true,
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    update: ['Mullvad Browser', 'About Mullvad Browser']
  },
  opera: {
    name: 'Opera',
    nightlyName: 'Opera Developer',
    privateFlag: 'private',
    basedOn: 'chromium',
    update: ['Opera', 'About Opera'],
    updateNightly: ['Opera Developer', 'About Opera']
    // preferences: [[["ui","warn_on_quitting_opera_with_multiple_tabs"], false]]
  },
  safari: {
    name: 'Safari',
    nightlyName: 'Safari Technology Preview',
    useOpen: true,
    basedOn: 'safari'
  },
  tor: {
    name: 'Tor Browser',
    nightlyName: 'Tor Browser Nightly',
    binaryName: 'firefox',
    basedOn: 'firefox',
    useOpen: true,
    postLaunchDelay: 10000,
    update: ['Tor Browser', 'About Tor Browser'],
    updateNightly: ['Tor Browser', 'About Tor Browser']
  },
  ungoogled: {
    name: 'Ungoogled Chromium',
    binaryName: 'Chromium',
    privateFlag: 'incognito',
    updateCommand: "mv '/Applications/Ungoogled Chromium.app' /Applications/Chromium.app ; /opt/homebrew/bin/brew upgrade eloston-chromium --no-quarantine && mv /Applications/Chromium.app '/Applications/Ungoogled Chromium.app'",
    basedOn: 'chromium'
  },
  vivaldi: {
    name: 'Vivaldi',
    nightlyName: 'Vivaldi Snapshot',
    privateFlag: 'incognito',
    //    postLaunchDelay: 10000,
    basedOn: 'chromium',
    // Assumes Vivaldi is on automatic updates:
    update: ['Vivaldi', 'About Vivaldi'],
    updateNightly: ['Vivaldi Snapshot', 'About Vivaldi']
  },
  waterfox: {
    name: 'waterfox',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    update: ['Waterfox', 'About Waterfox']
  },
  zen: {
    name: 'Zen',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    update: ['Zen', 'About Zen'],
    postLaunchDelay: 2000
  }
};

const defaultAppDirectory = '/Applications';
const defaultBinaryPath = 'Contents/MacOS';

const profileFlags = {
  chromium: '--no-first-run --no-default-browser-check --user-data-dir=',
  firefox: '-profile ',
  safari: undefined
};

const browserPath = ({ browser, nightly, appDir }) => {
  const browserValues = macOSdefaultBrowserSettings[browser];
  const binaryName = browserValues.binaryName ?? browserValues.name;
  const appName = nightly ? browserValues.nightlyName : browserValues.name;
  const appDirFinal = appDir ?? defaultAppDirectory;
  const fullBinaryPath = joinDir(appDirFinal, `${appName}.app`, defaultBinaryPath);
  const executablePath1 = joinDir(fullBinaryPath, binaryName);
  const executablePath2 = joinDir(fullBinaryPath, appName);
  return fs.existsSync(executablePath1) ? executablePath1 : executablePath2;
};

// global state
let proxyUsageState = false;
let preferredNetworkService;

// TODO: Make this a generic capability for any browser
const fixOperaPreferences = async (file) => {
  const raw = await fsPromises.readFile(file);
  const json = JSON.parse(raw);
  json.ui.warn_on_quitting_opera_with_multiple_tabs = false;
  await fsPromises.writeFile(file, JSON.stringify(json));
  console.log('fixed Opera preferences in', file);
};

// TODO: Make this a generic capability for any browser
const fixChromePreferences = async (file) => {
  const raw = await fsPromises.readFile(file);
  const json = JSON.parse(raw);
  if (json.privacy_sandbox === undefined) {
    json.privacy_sandbox = {};
  }
  if (json.privacy_sandbox.m1 === undefined) {
    json.privacy_sandbox.m1 = {};
  }
  json.privacy_sandbox.m1.row_notice_acknowledged = true;
  await fsPromises.writeFile(file, JSON.stringify(json));
  console.log('fixed Chrome preferences in', file);
};

const fixZenPreferences = async (file) => {
  let content = (await fsPromises.readFile(file)).toString();
  if (content.includes("zen.welcome-screen.seen")) {
    content = content.replace(
      'user_pref("zen.welcome-screen.seen", false)',
      'user_pref("zen.welcome-screen.seen", true)')
  } else {
    content += '\nuser_pref("zen.welcome-screen.seen", true);'
  }
  await fsPromises.writeFile(file, content)
};

const fixSafari = (incognito, nightly) => {
  const name = nightly ? "SafariTechnologyPreview" : "Safari"
  execSync(`defaults write com.apple.${name} AlwaysRestoreSessionAtLaunch -bool false`);
  execSync(`defaults write com.apple.${name} OpenPrivateWindowWhenNotRestoringSessionAtLaunch -bool ${incognito ? "true" : "false"}`);
};

// A Browser object represents a browser we run tests on.
class DesktopBrowser {
  constructor ({ browser, path, incognito, tor, nightly, appDir }) {
    Object.assign(this, { browser, incognito, tor, nightly });
    this._defaults = macOSdefaultBrowserSettings[browser];
    this._version = undefined;
    this._path = path ?? browserPath({ browser, nightly, appDir });
    this._appPath = this._path.split('.app')[0] + '.app';
    this._appName = nightly ? this._defaults.nightlyName : this._defaults.name;
    const profileCommand = profileFlags[this._defaults.basedOn];
    this._profilePath = profileCommand ? joinDir(__dirname, `profiles/${browser}${nightly ? '_nightly' : ''}_profile`) : undefined;
    if (this._defaults.useOpen) {
      this._command = `open -a "${this._appPath}"`;
    } else {
      const flags = `${incognito ? '--' + this._defaults.privateFlag : ''} ${tor ? '--' + this._defaults.torFlag : ''} ${this._profilePath ? `${profileCommand}"${this._profilePath}"` : ''}`;
      this._command = `"${this._path}" ${flags}`.trim();
    }
  }

  // Launch the browser.
  async launch (clean = true) {
    console.log(this._defaults);
    if (clean && this._profilePath) {
      // Delete old profiles if they exist.
      console.log(`Deleting any old ${this._profilePath}`);
      await fsPromises.rm(this._profilePath, { recursive: true, force: true, maxRetries: 3 });
    } else {
      if (this.browser === 'opera') {
        try {
          await fixOperaPreferences(path.join(this._profilePath, 'Default', 'Preferences'));
        } catch (e) {
          await fixOperaPreferences(path.join(this._profilePath, 'Preferences'));
        }
      }
      if (this.browser === 'chrome') {
        await fixChromePreferences(path.join(this._profilePath, 'Default', 'Preferences'));
      }
      if (this.browser === 'zen') {
        await fixZenPreferences(path.join(this._profilePath, "prefs.js"))
      }
    }
    if (this.browser === 'safari') {
      fixSafari(this.incognito, this.nightly);
    }
    this._process = exec(this._command, { env: this._defaults.env });
    await sleepMs(this.tor ? this._defaults.torPostLaunchDelay : (this._defaults.postLaunchDelay ?? 500));
  }

  // Get the browser version.
  async version () {
    if (!this._version) {
      this._version = execSync(`mdls -name kMDItemVersion -raw "${this._appPath}"`).toString();
    }
    if (this.browser === 'brave') {
      // Weird brave thing. When the version is 1.31.87, kMDItemVersion is 95.1.31.87,
      // where "95" refers to the Chromium major version.
      this._version = this._version.split('.').slice(1).join('.');
    }
    return this._version;
  }

  // Open the url in a new tab.
  async openUrl (url) {
    if (!this._process) {
      throw new Error('browser not launched');
    }
    exec(`${this._command} "${url}"`);
  }

  // Close the browser.
  async kill () {
    await execAsync(`osascript -e 'quit app "${this._path}"'`);
    await sleepMs(5000);
  }

  // Restart the browser with same profile.
  async restart (clean = false) {
    await this.kill();
    await this.launch(clean);
  }

  async setPref (prefName, prefValue) {
    console.log('setting pref: ', prefName, prefValue);
    const prefsPath = path.join(this._profilePath, 'prefs.js');
    const buf = await fsPromises.readFile(prefsPath);
    const rawString = buf.toString();
    const regex = new RegExp(`user_pref\\("${prefName}",\\s?".*?"\\)`, 'g');
    let finalString;
    const finalPrefLine = `user_pref("${prefName}", "${prefValue}")`;
    if (rawString.match(regex)) {
      finalString = rawString.replace(regex, finalPrefLine);
    } else {
      finalString = rawString + '\n' + finalPrefLine;
    }
    await fsPromises.writeFile(prefsPath, finalString);
  }

  // Update the browser to the latest version.
  async update () {
    // For most browsers, we use the "About" menu item to get the browser to check for udpates.
    const update = this.nightly ? this._defaults.updateNightly : this._defaults.update;
    const updateCommand = this._defaults.updateCommand;
    if (update) {
      console.log({ this_nightly: this._nightly, update });
      const [menuName, aboutItemName] = update;
      if (menuName) {
        await this.launch();
        exec(`osascript updateBrowser.applescript "${menuName}" "${aboutItemName}"`);
        // Wait 5 minutes for the update binary to download
        await sleepMs(300000);
        await this.kill();
      }
    } else if (updateCommand) {
      execSync(updateCommand);
    }
  }

  static async setGlobalProxyUsageEnabled (enabled, port = null) {
    if (enabled === proxyUsageState) {
      return;
    }
    proxyUsageState = enabled;
    preferredNetworkService ??= systemNetworkSettings.getPreferredNetworkService();
    const setting = { enabled };
    if (enabled) {
      Object.assign(setting, { domain: '127.0.0.1', port });
    }
    systemNetworkSettings.setProxies(preferredNetworkService,
      { web: setting, secureweb: setting });
    // Wait for proxy settings to propagate.
    await sleepMs(1000);
  }

  static async countActiveVpns () {
    try {
      const response = execSync('ifconfig -v | grep "type:VPN"').toString();
      const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      console.log(lines);
      return lines.length;
    } catch (e) {
      return 0;
    }
  }

  static getScreenResolution () {
    const response = execSync('system_profiler SPDisplaysDataType | grep "UI Looks like:"').toString();
    const [, width, height] = response.match(/(\d+)\sx\s(\d+)/)
    return { width: parseInt(width), height: parseInt(height)}
  }

  static hasTorWindows (browserName) {
    return !!macOSdefaultBrowserSettings[browserName].torFlag;
  }

  static killAll (browserNames) {
    const appNames = browserNames.map(name => macOSdefaultBrowserSettings[name].name);
    console.log(appNames);
    killProcessesWithPattern(appNames.join("|"));
  }
}

module.exports = { DesktopBrowser };
