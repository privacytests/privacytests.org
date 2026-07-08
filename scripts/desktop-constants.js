const macOSdefaultBrowserSettings = {
  brave: {
    name: 'Brave Browser',
    nightlyName: 'Brave Browser Nightly',
    privateFlag: 'incognito',
    torFlag: 'tor',
    torPostLaunchDelay: 10000,
    basedOn: 'chromium',
    dmgUrl: 'https://laptop-updates.brave.com/latest/osx',
    update: ['Brave', 'About Brave'],
    updateNightly: ['Brave', 'About Brave']
  },
  chrome: {
    name: 'Google Chrome',
    nightlyName: 'Google Chrome Canary',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    dmgUrl: 'https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg',
    update: ['Chrome', 'About Google Chrome'],
    updateNightly: ['Chrome Canary', 'About Google Chrome']
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    nightlyName: 'DuckDuckGo',
    useOpen: true,
    dmgUrl: 'https://staticcdn.duckduckgo.com/macos-desktop-browser/duckduckgo.dmg'
    //   incognitoCommand: "osascript safariPBM.applescript",
    //    basedOn: "safari",
  },
  edge: {
    name: 'Microsoft Edge',
    nightlyName: 'Microsoft Edge Canary',
    privateFlag: 'inprivate',
    basedOn: 'chromium',
    pkgUrl: 'https://go.microsoft.com/fwlink/?linkid=2093504',
    update: ['Microsoft Edge', 'About Microsoft Edge'],
    updateNightly: ['Microsoft Edge Canary', 'About Microsoft Edge']
  },
  firefox: {
    name: 'firefox',
    nightlyName: 'Firefox Nightly',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1', MOZ_CRASHREPORTER_DISABLE: '1' },
    dmgUrl: 'https://download.mozilla.org/?product=firefox-latest-ssl&os=osx&lang=en-US',
    update: ['Firefox', 'About Firefox'],
    postLaunchDelay: 1000,
    updateNightly: ['Firefox Nightly', 'About Nightly']
  },
  librewolf: {
    name: 'librewolf',
    displayName: 'LibreWolf',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    updateCommand: '/opt/homebrew/bin/brew upgrade librewolf --no-quarantine',
    postLaunchDelay: 2000
  },
  mullvad: {
    name: 'Mullvad Browser',
    binaryName: 'mullvadbrowser',
    basedOn: 'firefox',
    //useOpen: true,
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    githubRelease: {
      repo: 'mullvad/mullvad-browser',
      assetPattern: '^mullvad-browser-macos-.*\\.dmg$'
    },
    update: ['Mullvad Browser', 'About Mullvad Browser']
  },
  opera: {
    name: 'Opera',
    nightlyName: 'Opera Developer',
    privateFlag: 'private',
    basedOn: 'chromium',
    dmgUrl: 'https://ftp.opera.com/ftp/pub/opera/desktop/131.0.5877.116/mac/Opera_131.0.5877.116_Setup.dmg',
    update: ['Opera', 'About Opera'],
    updateNightly: ['Opera Developer', 'About Opera']
    // preferences: [[["ui","warn_on_quitting_opera_with_multiple_tabs"], false]]
  },
  safari: {
    name: 'Safari',
    nightlyName: 'Safari Technology Preview',
    useOpen: true,
    basedOn: 'safari'
  },
  tor: {
    name: 'Tor Browser',
    nightlyName: 'Tor Browser Nightly',
    binaryName: 'firefox',
    basedOn: 'firefox',
    useOpen: true,
    postLaunchDelay: 10000,
    update: ['Tor Browser', 'About Tor Browser'],
    updateNightly: ['Tor Browser', 'About Tor Browser']
  },
  ungoogled: {
    name: 'Ungoogled Chromium',
    binaryName: 'Chromium',
    privateFlag: 'incognito',
    updateCommand: "mv '/Applications/Ungoogled Chromium.app' /Applications/Chromium.app ; /opt/homebrew/bin/brew upgrade eloston-chromium --no-quarantine && mv /Applications/Chromium.app '/Applications/Ungoogled Chromium.app'",
    basedOn: 'chromium'
  },
  vivaldi: {
    name: 'Vivaldi',
    nightlyName: 'Vivaldi Snapshot',
    privateFlag: 'incognito',
    //    postLaunchDelay: 10000,
    basedOn: 'chromium',
    dmgUrl: 'https://downloads.vivaldi.com/stable/Vivaldi.dmg',
    // Assumes Vivaldi is on automatic updates:
    update: ['Vivaldi', 'About Vivaldi'],
    updateNightly: ['Vivaldi Snapshot', 'About Vivaldi']
  },
  waterfox: {
    name: 'waterfox',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    update: ['Waterfox', 'About Waterfox']
  },
  zen: {
    name: 'Zen',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    dmgUrl: 'https://github.com/zen-browser/desktop/releases/latest/download/zen.macos-universal.dmg',
    update: ['Zen', 'About Zen'],
    postLaunchDelay: 2000
  }
};

const defaultAppDirectory = '/Applications';

module.exports = { macOSdefaultBrowserSettings, defaultAppDirectory };
