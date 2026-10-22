const macOSdefaultBrowserSettings = {
  brave: {
    name: 'Brave Browser',
    nightlyName: 'Brave Browser Nightly',
    usePkill: true,
    privateFlag: 'incognito',
    torFlag: 'tor',
    torPostLaunchDelay: 10000,
    basedOn: 'chromium',
    dmgUrl: 'https://laptop-updates.brave.com/latest/osx',
    nightlyDmgUrl: 'https://laptop-updates.brave.com/latest/osx/nightly'
  },
  chrome: {
    name: 'Google Chrome',
    nightlyName: 'Google Chrome Canary',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    dmgUrl: 'https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg',
    nightlyDmgUrl: 'https://dl.google.com/chrome/mac/universal/canary/googlechromecanary.dmg'
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    nightlyName: 'DuckDuckGo',
    useOpen: true,
    dmgUrl: 'https://staticcdn.duckduckgo.com/macos-desktop-browser/duckduckgo.dmg',
    nightlyDmgUrl: 'https://staticcdn.duckduckgo.com/macos-desktop-browser/duckduckgo.dmg'
    //   incognitoCommand: "osascript safariPBM.applescript",
    //    basedOn: "safari",
  },
  edge: {
    name: 'Microsoft Edge',
    nightlyName: 'Microsoft Edge Canary',
    privateFlag: 'inprivate',
    basedOn: 'chromium',
    pkgUrl: 'https://go.microsoft.com/fwlink/?linkid=2093504',
    nightlyBrewCask: 'microsoft-edge@canary'
  },
  firefox: {
    name: 'firefox',
    nightlyName: 'Firefox Nightly',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1', MOZ_CRASHREPORTER_DISABLE: '1' },
    dmgUrl: 'https://download.mozilla.org/?product=firefox-latest-ssl&os=osx&lang=en-US',
    nightlyDmgUrl: 'https://download.mozilla.org/?product=firefox-nightly-latest-ssl&os=osx&lang=en-US',
    postLaunchDelay: 5000
  },
  librewolf: {
    name: 'LibreWolf',
    binaryName: 'librewolf',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    useOpen: true,
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    brewCask: 'librewolf',
    postLaunchDelay: 5000
  },
  mullvad: {
    name: 'Mullvad Browser',
    binaryName: 'mullvadbrowser',
    basedOn: 'firefox',
    useOpen: true,
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    githubRelease: {
      repo: 'mullvad/mullvad-browser',
      assetPattern: '^mullvad-browser-macos-.*\\.dmg$'
    },
    postLaunchDelay: 5000
  },
  opera: {
    name: 'Opera',
    nightlyName: 'Opera Developer',
    privateFlag: 'private',
    basedOn: 'chromium',
    directoryRelease: {
      listUrl: 'https://ftp.opera.com/ftp/pub/opera/desktop/',
      dmgUrlTemplate: 'https://get.geo.opera.com/pub/opera/desktop/{version}/mac/Opera_{version}_Setup.dmg'
    },
    nightlyDirectoryRelease: {
      listUrl: 'https://ftp.opera.com/ftp/pub/opera-developer/',
      dmgUrlTemplate: 'https://get.geo.opera.com/pub/opera-developer/{version}/mac/Opera_Developer_{version}_Setup.dmg'
    }
    // preferences: [[["ui","warn_on_quitting_opera_with_multiple_tabs"], false]]
  },
  safari: {
    name: 'Safari',
    nightlyName: 'Safari Technology Preview',
    useOpen: true,
    basedOn: 'safari',
    preinstalled: true,
    nightlyBrewCask: 'safari-technology-preview'
  },
  tor: {
    name: 'Tor Browser',
    // Tor "nightly" means the latest alpha build (e.g. 16.0a8).
    nightlyName: 'Tor Browser',
    binaryName: 'firefox',
    useOpen: true,
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1', MOZ_CRASHREPORTER_DISABLE: '1' },
    postLaunchDelay: 10000,
    directoryRelease: {
      listUrl: 'https://dist.torproject.org/torbrowser/',
      dmgUrlTemplate: 'https://dist.torproject.org/torbrowser/{version}/tor-browser-macos-{version}.dmg',
      // Stable releases only (exclude alphas like 16.0a8).
      versionPattern: 'href=["\']?(\\d+(?:\\.\\d+)+)/'
    },
    nightlyDirectoryRelease: {
      listUrl: 'https://dist.torproject.org/torbrowser/',
      dmgUrlTemplate: 'https://dist.torproject.org/torbrowser/{version}/tor-browser-macos-{version}.dmg',
      // Alpha / early builds, e.g. 16.0a8.
      versionPattern: 'href=["\']?(\\d+\\.\\d+a\\d+)/'
    }
  },
  ungoogled: {
    name: 'Ungoogled Chromium',
    binaryName: 'Chromium',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    brewCask: 'ungoogled-chromium',
    brewCaskInstalledName: 'Chromium'
  },
  vivaldi: {
    name: 'Vivaldi',
    nightlyName: 'Vivaldi Snapshot',
    privateFlag: 'incognito',
    //    postLaunchDelay: 10000,
    basedOn: 'chromium',
    dmgUrl: 'https://downloads.vivaldi.com/stable/Vivaldi.dmg',
    // Brew's vivaldi@snapshot cask often lags and 404s; resolve via Sparkle appcast.
    nightlySparkleRelease: {
      appcastUrl: 'https://update.vivaldi.com/update/1.0/snapshot/mac/appcast.xml',
      dmgUrlTemplate: 'https://downloads.vivaldi.com/snapshot/Vivaldi.{version}.universal.dmg'
    }
  }
};

const defaultAppDirectory = '/Applications';

module.exports = { macOSdefaultBrowserSettings, defaultAppDirectory };
