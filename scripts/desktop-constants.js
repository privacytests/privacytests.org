const macOSdefaultBrowserSettings = {
  brave: {
    name: 'Brave Browser',
    nightlyName: 'Brave Browser Nightly',
    privateFlag: 'incognito',
    torFlag: 'tor',
    torPostLaunchDelay: 10000,
    basedOn: 'chromium',
    update: ['Brave', 'About Brave'],
    updateNightly: ['Brave', 'About Brave']
  },
  chrome: {
    name: 'Google Chrome',
    nightlyName: 'Google Chrome Canary',
    privateFlag: 'incognito',
    basedOn: 'chromium',
    update: ['Chrome', 'About Google Chrome'],
    updateNightly: ['Chrome Canary', 'About Google Chrome']
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    nightlyName: 'DuckDuckGo',
    useOpen: true
    //   incognitoCommand: "osascript safariPBM.applescript",
    //    basedOn: "safari",
  },
  edge: {
    name: 'Microsoft Edge',
    nightlyName: 'Microsoft Edge Canary',
    privateFlag: 'inprivate',
    basedOn: 'chromium',
    update: ['Microsoft Edge', 'About Microsoft Edge'],
    updateNightly: ['Microsoft Edge Canary', 'About Microsoft Edge']
  },
  firefox: {
    name: 'firefox',
    nightlyName: 'Firefox Nightly',
    privateFlag: 'private-window',
    basedOn: 'firefox',
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1', MOZ_CRASHREPORTER_DISABLE: '1' },
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
    useOpen: true,
    env: { MOZ_DISABLE_AUTO_SAFE_MODE: '1' },
    update: ['Mullvad Browser', 'About Mullvad Browser']
  },
  opera: {
    name: 'Opera',
    nightlyName: 'Opera Developer',
    privateFlag: 'private',
    basedOn: 'chromium',
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
    update: ['Zen', 'About Zen'],
    postLaunchDelay: 2000
  }
};

const defaultAppDirectory = '/Applications';

module.exports = { macOSdefaultBrowserSettings, defaultAppDirectory };
