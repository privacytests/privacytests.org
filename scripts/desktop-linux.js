const child_process = require('child_process');
const { exec, execSync, killProcessAndDescendants } = require('./utils');

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

const profileFlags = {
  "chromium": "--no-first-run --no-default-browser-check --user-data-dir=",
  "firefox": "-profile ",
  "safari": undefined,
};


// Declares a class that represents a browser on Linux.
class DesktopBrowserLinux {
  constructor({ browser, path, incognito, tor, nightly, appDir }) {
    this._defaults = linuxDefaultBrowserSettings[browser];
    const flags = profileFlags[this._defaults.basedOn];
    this._command = `${this._defaults.command} ${flags}./brave-profile`;
  }

  async launch(clean = true) {
    this._process = child_process.exec(this._command, { env: this._defaults.env });
  }

  async version() {
    return execSync(`${this._defaults.command} --version`).toString();
  }

  async openUrl(url) {
    exec(`${this._command} "${url}"`);
  }

  async kill() {
    killProcessAndDescendants(this._process.pid);
  }

  async restart() {
    await this.kill();
    await this.launch();
  }

  async update() {
    throw new Error("not implemented");
  }
}

module.exports = { DesktopBrowserLinux };
