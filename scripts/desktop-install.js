const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const { execSync } = require('./utils');
const { macOSdefaultBrowserSettings, defaultAppDirectory } = require('./desktop-constants');

const downloadFile = (url, destPath) => {
  execSync(`curl -L -f -o "${destPath}" "${url}"`);
};

const findAppBundle = (mountPoint, settings) => {
  const appBundle = path.join(mountPoint, `${settings.name}.app`);
  if (!fs.existsSync(appBundle)) {
    throw new Error(`Could not find app bundle in ${mountPoint}`);
  }
  return appBundle;
};

const installBrowser = async (browserKey) => {
  const settings = macOSdefaultBrowserSettings[browserKey];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  if (!settings.dmgUrl) {
    throw new Error(`Browser "${browserKey}" has no dmgUrl configured`);
  }

  const dmgPath = path.join(os.tmpdir(), `${browserKey}.dmg`);
  const mountPoint = path.join(os.tmpdir(), `${browserKey}_mount`);
  let mounted = false;

  await fsPromises.mkdir(mountPoint, { recursive: true });

  try {
    console.log(`Downloading ${browserKey} from ${settings.dmgUrl}`);
    downloadFile(settings.dmgUrl, dmgPath);

    execSync(`hdiutil attach "${dmgPath}" -nobrowse -mountpoint "${mountPoint}"`);
    mounted = true;

    const appBundle = findAppBundle(mountPoint, settings);
    const destApp = path.join(defaultAppDirectory, path.basename(appBundle));

    if (fs.existsSync(destApp)) {
      execSync(`rm -rf "${destApp}"`);
    }
    execSync(`cp -R "${appBundle}" "${defaultAppDirectory}/"`);
    console.log(`Installed ${path.basename(appBundle)} to ${defaultAppDirectory}`);
  } finally {
    if (mounted) {
      execSync(`hdiutil detach "${mountPoint}" -quiet`);
    }
    await fsPromises.unlink(dmgPath).catch(() => {});
  }
};

module.exports = { installBrowser };
