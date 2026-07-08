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

const compareVersions = (a, b) => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

const resolveGitHubReleaseAssetUrl = (repo, assetPattern) => {
  const curlHeaders = [
    '-H "Accept: application/vnd.github+json"',
    '-H "User-Agent: privacytests.org-desktop-install"',
  ];
  if (process.env.GITHUB_TOKEN) {
    curlHeaders.push(`-H "Authorization: Bearer ${process.env.GITHUB_TOKEN}"`);
  }
  const release = JSON.parse(
    execSync(`curl -sL ${curlHeaders.join(' ')} "https://api.github.com/repos/${repo}/releases/latest"`, { encoding: 'utf8' })
  );
  if (!Array.isArray(release.assets)) {
    throw new Error(`GitHub API error for ${repo}: ${release.message ?? JSON.stringify(release)}`);
  }
  const pattern = new RegExp(assetPattern);
  const asset = release.assets.find((entry) => pattern.test(entry.name));
  if (!asset) {
    throw new Error(`No asset matching ${assetPattern} in ${repo} release ${release.tag_name}`);
  }
  return asset.browser_download_url;
};

const resolveDirectoryReleaseDmgUrl = ({ listUrl, dmgUrlTemplate }) => {
  const listing = execSync(`curl -sL "${listUrl}"`, { encoding: 'utf8' });
  const versionPattern = /href=["']?v?(\d+(?:\.\d+)+)\/?["' >]/gi;
  const versions = [...listing.matchAll(versionPattern)].map((match) => match[1]);
  if (versions.length === 0) {
    throw new Error(`No versions found at ${listUrl}`);
  }
  const version = versions.sort(compareVersions).at(-1);
  return dmgUrlTemplate.replaceAll('{version}', version);
};

const getDmgUrl = (settings) => {
  if (settings.directoryRelease) {
    return resolveDirectoryReleaseDmgUrl(settings.directoryRelease);
  }
  if (settings.githubRelease) {
    const { repo, assetPattern } = settings.githubRelease;
    return resolveGitHubReleaseAssetUrl(repo, assetPattern);
  }
  return settings.dmgUrl;
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
    const dmgUrl = getDmgUrl(settings);
    console.log(`Downloading ${browserKey} from ${dmgUrl}`);
    downloadFile(dmgUrl, dmgPath);
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

const installFromBrewCask = (browserKey, settings) => {
  const finalAppPath = path.join(defaultAppDirectory, `${settings.name}.app`);
  const brewAppName = settings.brewCaskInstalledName ?? settings.name;
  const brewAppPath = path.join(defaultAppDirectory, `${brewAppName}.app`);
  const needsRename = brewAppName !== settings.name;

  console.log(`Installing ${browserKey} via brew cask ${settings.brewCask}`);
  if (needsRename && fs.existsSync(finalAppPath)) {
    execSync(`rm -rf "${brewAppPath}"`);
    execSync(`mv "${finalAppPath}" "${brewAppPath}"`);
  }
  execSync(`brew install --cask ${settings.brewCask}`);
  if (!fs.existsSync(brewAppPath)) {
    throw new Error(`brew cask ${settings.brewCask} did not create ${brewAppPath}`);
  }
  if (needsRename) {
    if (fs.existsSync(finalAppPath)) {
      execSync(`rm -rf "${finalAppPath}"`);
    }
    execSync(`mv "${brewAppPath}" "${finalAppPath}"`);
  }
  execSync(`xattr -cr "${finalAppPath}"`);
  console.log(`Installed ${path.basename(finalAppPath)} to ${defaultAppDirectory}`);
};

const getAppPath = (settings) => path.join(defaultAppDirectory, `${settings.name}.app`);

const installBrowser = async (browserKey) => {
  const settings = macOSdefaultBrowserSettings[browserKey];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  if (settings.preinstalled) {
    const appPath = getAppPath(settings);
    if (!fs.existsSync(appPath)) {
      throw new Error(`Browser "${browserKey}" is not installed at ${appPath}`);
    }
    console.log(`${settings.name} is preinstalled at ${appPath}`);
    return;
  }
  if (settings.brewCask) {
    installFromBrewCask(browserKey, settings);
    return;
  }
  if (settings.pkgUrl) {
    await installFromPkg(browserKey, settings);
    return;
  }
  if (settings.dmgUrl || settings.githubRelease || settings.directoryRelease) {
    await installFromDmg(browserKey, settings);
    return;
  }
  throw new Error(`No install method configured for browser "${browserKey}"`);
};

const removeBrowser = (browserKey) => {
  const settings = macOSdefaultBrowserSettings[browserKey];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  if (settings.preinstalled) {
    throw new Error(`Cannot remove preinstalled browser "${browserKey}"`);
  }
  if (settings.brewCask) {
    const brewAppName = settings.brewCaskInstalledName ?? settings.name;
    const brewAppPath = path.join(defaultAppDirectory, `${brewAppName}.app`);
    const appPath = getAppPath(settings);
    if (brewAppName !== settings.name && fs.existsSync(appPath)) {
      execSync(`rm -rf "${brewAppPath}"`);
      execSync(`mv "${appPath}" "${brewAppPath}"`);
    }
    execSync(`brew uninstall --cask ${settings.brewCask}`);
    if (fs.existsSync(appPath)) {
      execSync(`rm -rf "${appPath}"`);
    }
    console.log(`Uninstalled brew cask ${settings.brewCask}`);
    return;
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
