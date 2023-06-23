const fs = require('node:fs');
const { exec, execSync, killProcessAndDescendants } = require('./utils');
const { join } = require('node:path');
const os = require('node:os');
const path = require('node:path');

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
  chromium: '--no-first-run --no-default-browser-check --user-data-dir=',
  firefox: '--profile ',
  webkit: '--profile '
};

let globalProxyUsageEnabled = false;
let globalProxyPort = null;

// Declares a class that represents a browser on Linux.
class DesktopBrowser {
  constructor ({ browser, path, incognito, tor, nightly, appDir }) {
    this._defaults = platform === "win32" ?
      windowsDefaultBrowserSettings[browser] :
      linuxDefaultBrowserSettings[browser];
    this._flags = `${incognito ? '--' + this._defaults.privateFlag : ''} ${tor ? '--' + this._defaults.torFlag : ''} ` + standardFlags[this._defaults.basedOn];
    this._profilePath = join(process.cwd(), 'profiles', browser);
    fs.mkdirSync(this._profilePath, { recursive: true });
    this._usingProxy = globalProxyUsageEnabled;
    this._processes = new Set();
    this._browser = browser;
  }

  command () {
    let result = `"${path.normalize(this._defaults.command)}" ${this._flags}${this._profilePath}`;
    if (globalProxyUsageEnabled && this._defaults.basedOn === 'chromium') {
      result += ` --proxy-server="http://127.0.0.1:${globalProxyPort}"`;
    }
    return result;
  }

  env () {
    let result = { ...process.env, ...this._defaults.env };
    if (globalProxyUsageEnabled && this._defaults.basedOn === 'firefox') {
      result = { ...result, ...process.env };
    }
    return result;
  }

  async launch (clean = true) {
    const process = exec(this.command(), { env: this.env() });
    this._processes.add(process);
  }

  async version () {
    let versionString = execSync(`"${path.normalize(this._defaults.command)}" --version`).toString()
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
    const process = exec(`${this.command()} "${url}"`, { env: this.env() });
    this._processes.add(process);
  }

  async kill () {
    for (const process of this._processes) {
      killProcessAndDescendants(process.pid);
    }
    this._processes.clear();
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
