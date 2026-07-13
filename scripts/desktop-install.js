const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const minimist = require('minimist');
const { execSync, parseBrowserKey } = require('./utils');
const { macOSdefaultBrowserSettings, defaultAppDirectory } = require('./desktop-constants');

const downloadFile = (url, destPath) => {
  execSync(`curl -L -f -o "${destPath}" "${url}"`);
};

const compareVersions = (a, b) => {
  // Treat alpha markers as version separators so 16.0a8 -> 16.0.8.
  const partsA = a.replace(/a/gi, '.').split('.').map(Number);
  const partsB = b.replace(/a/gi, '.').split('.').map(Number);
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

const resolveDirectoryReleaseDmgUrl = ({ listUrl, dmgUrlTemplate, versionPattern }) => {
  const listing = execSync(`curl -sL "${listUrl}"`, { encoding: 'utf8' });
  const pattern = new RegExp(versionPattern ?? 'href=["\']?v?(\\d+(?:\\.\\d+)+)/?["\' >]', 'gi');
  const versions = [...listing.matchAll(pattern)].map((match) => match[1]);
  if (versions.length === 0) {
    throw new Error(`No versions found at ${listUrl}`);
  }
  const version = [...new Set(versions)].sort(compareVersions).at(-1);
  return dmgUrlTemplate.replaceAll('{version}', version);
};

const appDisplayName = (settings, nightly) =>
  nightly ? (settings.nightlyName ?? settings.name) : settings.name;

const resolveInstallSettings = (settings, nightly) => {
  if (!nightly) {
    return {
      appName: settings.name,
      brewCask: settings.brewCask,
      brewCaskInstalledName: settings.brewCaskInstalledName,
      preinstalled: settings.preinstalled,
      pkgUrl: settings.pkgUrl,
      dmgUrl: settings.dmgUrl,
      githubRelease: settings.githubRelease,
      directoryRelease: settings.directoryRelease,
    };
  }
  return {
    appName: settings.nightlyName ?? settings.name,
    brewCask: settings.nightlyBrewCask ?? settings.brewCask,
    brewCaskInstalledName: settings.nightlyBrewCaskInstalledName ?? settings.brewCaskInstalledName,
    preinstalled: settings.nightlyBrewCask ? false : settings.preinstalled,
    pkgUrl: settings.nightlyPkgUrl,
    dmgUrl: settings.nightlyDmgUrl,
    githubRelease: settings.nightlyGithubRelease,
    directoryRelease: settings.nightlyDirectoryRelease,
  };
};

const getDmgUrl = (installSettings) => {
  if (installSettings.directoryRelease) {
    return resolveDirectoryReleaseDmgUrl(installSettings.directoryRelease);
  }
  if (installSettings.githubRelease) {
    const { repo, assetPattern } = installSettings.githubRelease;
    return resolveGitHubReleaseAssetUrl(repo, assetPattern);
  }
  return installSettings.dmgUrl;
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

const findAppBundle = (mountPoint, preferredAppName) => {
  const preferred = path.join(mountPoint, `${preferredAppName}.app`);
  if (fs.existsSync(preferred)) {
    return preferred;
  }
  const apps = fs.readdirSync(mountPoint).filter((entry) => entry.endsWith('.app'));
  if (apps.length === 1) {
    return path.join(mountPoint, apps[0]);
  }
  if (apps.length === 0) {
    throw new Error(`Could not find app bundle in ${mountPoint}`);
  }
  throw new Error(
    `Could not find "${preferredAppName}.app" in ${mountPoint} (found: ${apps.join(', ')})`);
};

const installFromDmg = async (browserKey, installSettings) => {
  const dmgPath = path.join(os.tmpdir(), `${browserKey}.dmg`);
  const mountPoint = path.join(os.tmpdir(), `${browserKey}_mount`);
  let mounted = false;

  await fsPromises.mkdir(mountPoint, { recursive: true });

  try {
    const dmgUrl = getDmgUrl(installSettings);
    if (!dmgUrl) {
      throw new Error(`No DMG URL configured for "${browserKey}"`);
    }
    console.log(`Downloading ${browserKey} from ${dmgUrl}`);
    downloadFile(dmgUrl, dmgPath);
    verifyInstaller(dmgPath, 'DMG');

    execSync(`hdiutil attach "${dmgPath}" -nobrowse -mountpoint "${mountPoint}"`);
    mounted = true;

    const appBundle = findAppBundle(mountPoint, installSettings.appName);
    const destApp = path.join(defaultAppDirectory, `${installSettings.appName}.app`);

    if (fs.existsSync(destApp)) {
      execSync(`rm -rf "${destApp}"`);
    }
    execSync(`cp -R "${appBundle}" "${destApp}"`);
    console.log(`Installed ${path.basename(destApp)} to ${defaultAppDirectory}`);
  } finally {
    if (mounted) {
      execSync(`hdiutil detach "${mountPoint}" -quiet`);
    }
    await fsPromises.unlink(dmgPath).catch(() => {});
  }
};

const installFromPkg = async (browserKey, installSettings) => {
  const pkgPath = path.join(os.tmpdir(), `${browserKey}.pkg`);
  const destApp = path.join(defaultAppDirectory, `${installSettings.appName}.app`);

  try {
    console.log(`Downloading ${browserKey} from ${installSettings.pkgUrl}`);
    downloadFile(installSettings.pkgUrl, pkgPath);
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

const installFromBrewCask = (browserKey, installSettings) => {
  const finalAppPath = path.join(defaultAppDirectory, `${installSettings.appName}.app`);
  const brewAppName = installSettings.brewCaskInstalledName ?? installSettings.appName;
  const brewAppPath = path.join(defaultAppDirectory, `${brewAppName}.app`);
  const needsRename = brewAppName !== installSettings.appName;

  console.log(`Installing ${browserKey} via brew cask ${installSettings.brewCask}`);
  if (needsRename && fs.existsSync(finalAppPath)) {
    execSync(`rm -rf "${brewAppPath}"`);
    execSync(`mv "${finalAppPath}" "${brewAppPath}"`);
  }
  execSync(`brew install --cask ${installSettings.brewCask}`);
  if (!fs.existsSync(brewAppPath)) {
    throw new Error(`brew cask ${installSettings.brewCask} did not create ${brewAppPath}`);
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

const getAppPath = (settings, nightly) =>
  path.join(defaultAppDirectory, `${appDisplayName(settings, nightly)}.app`);

const installBrowser = async (browserKey) => {
  const { browser, nightly } = parseBrowserKey(browserKey);
  const settings = macOSdefaultBrowserSettings[browser];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  if (nightly && !settings.nightlyName && !settings.nightlyDmgUrl &&
      !settings.nightlyPkgUrl && !settings.nightlyBrewCask &&
      !settings.nightlyDirectoryRelease && !settings.nightlyGithubRelease) {
    throw new Error(`Browser "${browser}" has no nightly/early-release install configured`);
  }

  const installSettings = resolveInstallSettings(settings, nightly);

  if (installSettings.preinstalled) {
    const appPath = getAppPath(settings, nightly);
    if (!fs.existsSync(appPath)) {
      throw new Error(`Browser "${browserKey}" is not installed at ${appPath}`);
    }
    console.log(`${installSettings.appName} is preinstalled at ${appPath}`);
    return;
  }
  if (installSettings.brewCask) {
    installFromBrewCask(browserKey, installSettings);
    return;
  }
  if (installSettings.pkgUrl) {
    await installFromPkg(browserKey, installSettings);
    return;
  }
  if (installSettings.dmgUrl || installSettings.githubRelease || installSettings.directoryRelease) {
    await installFromDmg(browserKey, installSettings);
    return;
  }
  throw new Error(`No install method configured for browser "${browserKey}"`);
};

const removeBrowser = (browserKey) => {
  const { browser, nightly } = parseBrowserKey(browserKey);
  const settings = macOSdefaultBrowserSettings[browser];
  if (!settings) {
    throw new Error(`Unknown browser "${browserKey}"`);
  }
  const installSettings = resolveInstallSettings(settings, nightly);
  if (installSettings.preinstalled) {
    throw new Error(`Cannot remove preinstalled browser "${browserKey}"`);
  }
  if (installSettings.brewCask) {
    const brewAppName = installSettings.brewCaskInstalledName ?? installSettings.appName;
    const brewAppPath = path.join(defaultAppDirectory, `${brewAppName}.app`);
    const appPath = getAppPath(settings, nightly);
    if (brewAppName !== installSettings.appName && fs.existsSync(appPath)) {
      execSync(`rm -rf "${brewAppPath}"`);
      execSync(`mv "${appPath}" "${brewAppPath}"`);
    }
    execSync(`brew uninstall --cask ${installSettings.brewCask}`);
    if (fs.existsSync(appPath)) {
      execSync(`rm -rf "${appPath}"`);
    }
    console.log(`Uninstalled brew cask ${installSettings.brewCask}`);
    return;
  }
  const appPath = getAppPath(settings, nightly);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Browser "${browserKey}" is not installed at ${appPath}`);
  }
  const rmCommand = installSettings.pkgUrl ? `sudo rm -rf "${appPath}"` : `rm -rf "${appPath}"`;
  execSync(rmCommand);
  console.log(`Removed ${path.basename(appPath)} from ${defaultAppDirectory}`);
};

const main = async () => {
  const { _, remove } = minimist(process.argv.slice(2), { boolean: ['remove'] });
  const browserKeys = _;
  if (browserKeys.length === 0) {
    console.error('Usage: node desktop-install [--remove] <browser> [browser...]');
    console.error('Examples: node desktop-install firefox  |  node desktop-install firefox-nightly');
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
