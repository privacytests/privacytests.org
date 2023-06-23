const fs = require('node:fs');
const { exec, execSync, killProcessAndDescendants } = require('./utils');
const { join } = require('node:path');
const os = require('node:os');
const path = require('node:path');
const child_process = require('node:child_process');

const linuxDefaultBrowserSettings = {
  brave: {
    command: '/usr/bin/brave-browser',
    name: 'Brave Browser',
    nightlyName: 'Brave Browser Nightly',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    update: ['Brave', 'About Brave'],
    updateNightly: ['Brave', 'About Brave']
  },
  chrome: {
    command: '/usr/bin/google-chrome',
    name: 'Google Chrome',
    nightlyName: 'Google Chrome Nightly',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    update: ['Google Chrome', 'About Google Chrome'],
    updateNightly: ['Google Chrome', 'About Google Chrome']
  },
  epiphany: {
    command: '/snap/bin/epiphany',
    name: 'GNOME Web',
    privateFlag: '--incognito-mode',
    basedOn: 'webkit'
  },
  firefox: {
    command: '/snap/bin/firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    name: 'firefox',
    nightlyName: 'Firefox Nightly',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    update: ['Firefox', 'About Firefox'],
    updateNightly: ['Firefox Nightly', 'About Nightly']
  }
};

const windowsDefaultBrowserSettings = {
  brave: {
    command: 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    name: 'Brave Browser',
    nightlyName: 'Brave Browser Nightly',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    update: ['Brave', 'About Brave'],
    updateNightly: ['Brave', 'About Brave']
  }
}

const platform = os.platform();

const standardFlags = {
  chromium: {
    profile: '--user-data-dir=',
    other: [
      '--no-first-run',
      '--no-default-browser-check',
    ],
  },
  firefox: { profile: '--profile '},
  webkit: { profile: '--profile '},
};

let globalProxyUsageEnabled = false;
let globalProxyPort = null;

// Declares a class that represents a browser on Linux.
class DesktopBrowser {
  constructor ({ browser, path, incognito, tor, nightly, appDir }) {
    this._defaults = platform === "win32" ?
      windowsDefaultBrowserSettings[browser] :
      linuxDefaultBrowserSettings[browser];
    this._flags = standardFlags[this._defaults.basedOn];
    this._profilePath = join(process.cwd(), 'profiles', browser);
    fs.mkdirSync(this._profilePath, { recursive: true });
    this._usingProxy = globalProxyUsageEnabled;
    this._pids = new Set();
    this._browser = browser;
    this._incognito = incognito;
    this._tor = tor;
  }

  command () {
    const binary = path.normalize(this._defaults.command);
    const flags = [];
    flags.push(this._flags.profile + this._profilePath);
    for (const flag of this._flags.other) {
      flags.push(flag);
    }
    if (this._incognito) {
      flags.push("--" + this._defaults.privacyFlags);
    }
    if (this._tor) {
      flags.push("--" + this._defaults.torFlag);
    }
    if (globalProxyUsageEnabled && this._defaults.basedOn === 'chromium') {
      flags.push(`--proxy-server="http://127.0.0.1:${globalProxyPort}"`);
    }
    return { binary, flags };
  }

  env () {
    let result = { ...process.env, ...this._defaults.env };
    if (globalProxyUsageEnabled && this._defaults.basedOn === 'firefox') {
      result = { ...result, ...process.env };
    }
    return result;
  }

  async launch (clean = true) {
    const { binary, flags } = this.command();
    const process = child_process.execFile(binary, flags, { env: this.env() });
    this._pids.add(process.pid);
  }

  async version () {
    const { binary } = this.command();
    let versionString = child_process.execFileSync(binary, ["--version"]).toString()
      .replace(/^[^\d]+/, '').trim();
    if (this._browser === 'brave') {
      versionString = versionString.replace(/^\d+\./, '');
    }
    return versionString;
  }

  async openUrl (url) {
    if (this._usingProxy !== globalProxyUsageEnabled) {
      await this.restart();
      this._usingProxy = globalProxyUsageEnabled;
    }
    const { binary, flags } = this.command();
    const extendedFlags = [...flags, url];
    const process = child_process.execFile(binary, extendedFlags, { env: this.env() });
    this._pids.add(process.pid);
  }

  async kill () {
    for (const pid of this._pids) {
      killProcessAndDescendants(pid);
    }
    this._pids.clear();
  }

  async restart () {
    await this.kill();
    await this.launch();
  }

  async update () {
    throw new Error('not implemented');
  }

  static async setGlobalProxyUsageEnabled (enabled, port = null) {
    globalProxyUsageEnabled = enabled;
    globalProxyPort = port;
  }
}

module.exports = { DesktopBrowser };
