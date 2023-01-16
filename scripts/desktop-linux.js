const child_process = require('node:child_process');
const fs = require('node:fs');
const { exec, execSync, killProcessAndDescendants } = require('./utils');
const { join } = require('node:path');

const linuxDefaultBrowserSettings = {
  brave: {
    command: "/usr/bin/brave-browser",
    name: "Brave Browser",
    nightlyName: "Brave Browser Nightly",
    privateFlag: "incognito",
    basedOn: "chromium",
    update: ["Brave", "About Brave"],
    updateNightly: ["Brave", "About Brave"],
  },
  chrome: {
    command: "/usr/bin/google-chrome",
    name: "Google Chrome",
    nightlyName: "Google Chrome Nightly",
    privateFlag: "incognito",
    basedOn: "chromium",
    update: ["Google Chrome", "About Google Chrome"],
    updateNightly: ["Google Chrome", "About Google Chrome"],
  },
  epiphany: {
    command: "/snap/bin/epiphany",
    name: "GNOME Web",
    privateFlag: "--incognito-mode",
    basedOn: "webkit",
  },
  firefox: {
    command: "/snap/bin/firefox",
    name: "firefox",
    nightlyName: "Firefox Nightly",
    privateFlag: "private-window",
    basedOn: "firefox",
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: "1" },
    update: ["Firefox", "About Firefox"],
    updateNightly: ["Firefox Nightly", "About Nightly"],
  }
};

const standardFlags = {
  "chromium": "--no-first-run --no-default-browser-check --user-data-dir=",
  "firefox": "--profile ",
  "webkit": "--profile "
};

let globalProxyUsageEnabled = false;
let globalProxyPort = null;

// Declares a class that represents a browser on Linux.
class DesktopBrowser {
  constructor({ browser, path, incognito, tor, nightly, appDir }) {
    this._defaults = linuxDefaultBrowserSettings[browser];
    this._flags = `${incognito ? "--" + this._defaults.privateFlag : ""} ${tor ? "--" + this._defaults.torFlag : ""} ` + standardFlags[this._defaults.basedOn];
    this._profilePath = join("profiles", browser);
    fs.mkdirSync(this._profilePath, { recursive: true });
    this._usingProxy = globalProxyUsageEnabled;
  }

  command () {
    let result = `${this._defaults.command} ${this._flags}${this._profilePath}`;
    if (globalProxyUsageEnabled) {
      result += ` --proxy-server="http://127.0.0.1:${globalProxyPort}"`;
    }
    return result;
  }

  async launch (clean = true) {
    this._process = exec(this.command());// , { env: this._defaults.env });
  }

  async version () {
    return execSync(`${this._defaults.command} --version`).toString().trim();
  }

  async openUrl (url) {
    if (this._usingProxy !== globalProxyUsageEnabled) {
      await this.restart();
      this._usingProxy = globalProxyUsageEnabled;
    }
    exec(`${this.command()} "${url}"`);
  }

  async kill () {
    killProcessAndDescendants(this._process.pid);
  }

  async restart () {
    await this.kill();
    await this.launch();
  }

  async update () {
    throw new Error("not implemented");
  }

  static async setGlobalProxyUsageEnabled (enabled, port = null) {
    globalProxyUsageEnabled = enabled;
    globalProxyPort = port;
  }
}

module.exports = { DesktopBrowser };
