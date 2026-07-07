const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const minimist = require('minimist');
const { execSync } = require('./utils');
const { macOSdefaultBrowserSettings, defaultAppDirectory } = require('./desktop-constants');

const downloadFile = (url, destPath) => {
  execSync(`curl -L -f -o "${destPath}" "${url}"`);
};

const verifyInstaller = (installerPath, expectedKind) => {
  const { size } = fs.statSync(installerPath);
  if (size < 1024 * 1024) {
    throw new Error(`Downloaded file is too small to be a ${expectedKind} (${size} bytes)`);
  }
  const fileType = execSync(`file -b "${installerPath}"`, { encoding: 'utf8' }).trim();
  if (/HTML|ASCII text|XML|JSON/i.test(fileType)) {
    throw new Error(`Downloaded file is not a ${expectedKind} (${fileType})`);
  }
};

const findAppBundle = (mountPoint, settings) => {
  const appBundle = path.join(mountPoint, `${settings.name}.app`);
  if (!fs.existsSync(appBundle)) {
    throw new Error(`Could not find app bundle in ${mountPoint}`);
  }
  return appBundle;
};

const installFromDmg = async (browserKey, settings) => {
  const dmgPath = path.join(os.tmpdir(), `${browserKey}.dmg`);
  const mountPoint = path.join(os.tmpdir(), `${browserKey}_mount`);
  let mounted = false;

  await fsPromises.mkdir(mountPoint, { recursive: true });

  try {
    console.log(`Downloading ${browserKey} from ${settings.dmgUrl}`);
    downloadFile(settings.dmgUrl, dmgPath);
    verifyInstaller(dmgPath, 'DMG');

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

const installFromPkg = async (browserKey, settings) => {
  const pkgPath = path.join(os.tmpdir(), `${browserKey}.pkg`);
  const destApp = path.join(defaultAppDirectory, `${settings.name}.app`);

  try {
    console.log(`Downloading ${browserKey} from ${settings.pkgUrl}`);
    downloadFile(settings.pkgUrl, pkgPath);
    verifyInstaller(pkgPath, 'PKG');

    if (fs.existsSync(destApp)) {
      execSync(`sudo rm -rf "${destApp}"`);
    }
    execSync(`sudo installer -pkg "${pkgPath}" -target /`);
    if (!fs.existsSync(destApp)) {
      throw new Error(`PKG install did not create ${destApp}`);
    }
    console.log(`Installed ${path.basename(destApp)} to ${defaultAppDirectory}`);
  } finally {
    await fsPromises.unlink(pkgPath).catch(() => {});
  }
};

const installBrowser = async (browserKey) => {
  const settings = macOSdefaultBrowserSettings[browserKey];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  if (settings.pkgUrl) {
    await installFromPkg(browserKey, settings);
    return;
  }
  if (settings.dmgUrl) {
    await installFromDmg(browserKey, settings);
    return;
  }
};

const removeBrowser = (browserKey) => {
  const settings = macOSdefaultBrowserSettings[browserKey];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  const appPath = path.join(defaultAppDirectory, `${settings.name}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Browser "${browserKey}" is not installed at ${appPath}`);
  }
  const rmCommand = settings.pkgUrl ? `sudo rm -rf "${appPath}"` : `rm -rf "${appPath}"`;
  execSync(rmCommand);
  console.log(`Removed ${path.basename(appPath)} from ${defaultAppDirectory}`);
};

const main = async () => {
  const { _, remove } = minimist(process.argv.slice(2), { boolean: ['remove'] });
  const browserKeys = _;
  if (browserKeys.length === 0) {
    console.error('Usage: node desktop-install [--remove] <browser> [browser...]');
    process.exit(1);
  }
  for (const browserKey of browserKeys) {
    if (remove) {
      removeBrowser(browserKey);
    } else {
      await installBrowser(browserKey);
    }
  }
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
