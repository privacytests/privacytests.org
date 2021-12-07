browserSettings = {
  brave: {
    bundleId: "com.brave.ios.browser",
    urlBarClick: "url",
    urlBarKeys: "url"
  },
  chrome: {
    bundleId: "com.google.chrome.ios",
		urlBarClick: "Search or type URL",
		urlBarKeys: "Search or type URL",
  },
  duckduckgo: {
    bundleId: "com.duckduckgo.mobile.ios",
		urlBarClick: "searchEntry",
		urlBarClear: "Clear Text",
		urlBarKeys: "searchEntry",
  },
  edge: {
    bundleId: "com.microsoft.msedge",
		urlBarClick: "Search and address bar",
		urlBarClick2: "NTPHomeFakeOmniboxAccessibilityID",
		urlBarKeys: "Address"
  },
  firefox: {
    bundleId: "org.mozilla.ios.Firefox",
    urlBarClick: "url",
    urlBarKeys: "address"
  },
  focus: {
    bundleId: "org.mozilla.ios.Focus",
		urlBarClick: "URLBar.urlText",
		urlBarKeys: "URLBar.urlText",
  },
  onion: {
    bundleId: "com.miketigas.OnionBrowser",
		urlBarClickElement: "XCUIElementTypeTextField",
		urlBarKeysElement: "XCUIElementTypeTextField",
  },
  opera: {
    bundleId: "com.opera.OperaTouch",
		urlBarClickElement: "XCUIElementTypeTextField", // Search or enter an address
		urlBarKeysElement: "XCUIElementTypeTextField", // Search or enter an address
  },
  safari: {
    bundleId: "com.apple.mobilesafari",
    urlBarClick: "TabBarItemTitle",
    urlBarKeys: "URL"
  },
  yandex: {
    bundleId: "ru.yandex.mobile.search",
		urlBarClick: "Enter a search query or URL",
		urlBarKeysSibling: "Clear the input field",
		// //XCUIElementTypeApplication[@name="Yandex"]/XCUIElementTypeWindow[1]/XCUIElementTypeOther/XCUIElementTypeOther/XCUIElementTypeOther/XCUIElementTypeOther[2]/XCUIElementTypeOther[4]/XCUIElementTypeOther/XCUIElementTypeTextView
  }
};
