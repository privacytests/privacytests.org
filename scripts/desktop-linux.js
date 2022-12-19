const child_process = require('child_process');

_
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

const exec = (command, options) => {
  console.log(command);
  return child_process.exec(command, options);
};

const execSync = (command, options) => {
  console.log(command);
  return child_process.exec(command, options).toString();
};

const childProcesses = (pid) => {
  try {
    const list = child_process.execSync(`pgrep -P ${pid}`).toString();
    return list.split(/\s+/).filter(s => s.length > 0);
  } catch (e) {
    return [];
  }
}

const descendantProcesses = (pid) => {
  const children = childProcesses(pid);
  descendants = children.map(descendantProcesses).flat();
  return [pid, ...descendants];
};

const killProcesses = (pids) => {
  pids.map(pid => process.kill(pid, process.SIGTERM));
};

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
    killProcesses(descendantProcesses(this._process.pid));
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
