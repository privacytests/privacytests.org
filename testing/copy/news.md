# News

## [Issue 11](/): 2021-12-31

### New browsers

This week we have added the privacy-oriented Bromite browser to our Android tests, and Ungoogle Chromium to our desktop tests.

## [Issue 10.1](archive/issue10.1/): 2021-12-26

Issue 10.1 fixes a problem in Issue 10 where Alt-Svc and H3 connection tests weren't operating properly.

## Issue 10: 2021-12-24
([Desktop](.), [Private modes](archive/issue10/private.html), [Android](archive/issue10/android.html), [iOS](archive/issue10/ios.html), [Nightly](archive/issue10/nightly.html), [Nightly private modes](archive/issue10/nightly-private.html))


### Introducing LibreWolf tests

In Issue 10, we have added LibreWolf to the set of tested browsers. LibreWolf is a Firefox-based browser with some unique default privacy features not found in other browsers.

### Updated layout

We have separated out Private Modes (aka Private Browsing, Incognito etc.) into their own tables for Desktop and Nightly browsers.

### New browser versions

Since last week, some browser versions have updated:
 * **Android:** Brave 1.33, DuckDuckGo 5.106, Firefox 95.2, Opera 66.2.
 * **iOS:** DuckDuckGo 7.65, Firefox 40.1, Safari 15.2, and Yandex 2111.7.

Desktop versions haven't updated this week.

### Added test

I have separated the Global Privacy Control test into "GPC enabled first-party" and "GPC enabled third-party."

## Issue 9: 2021-12-16
([Desktop](archive/issue9/), [Nightly](archive/issue9/nightly.html), [Android](archive/issue9/android.html), [iOS](archive/issue9/ios.html))

### Introducing mobile web browser testing

This issue adds two additional platforms for browser testing: Android and iOS. The new browsers are:

* **Android:** Brave, Chrome, DuckDuckGo, Microsoft Edge, Firefox, Opera, Samsung, Tor, Vivaldi, Yandex
* **iOS:** Brave, Chrome, DuckDuckGo, Edge, Firefox, Firefox Focus, Opera, Safari, Yandex

### A new suite of tests for tracker content blocking

Some web browsers maintain a blocklist of tracking domains. Third-party content (such as tracking pixels and tracking scripts) from these domains are blocked by the browser so that they are not loaded into the page. To see which browsers carry out this form of blocking, and what domains they block, Issue 9 introduces tracker content blocking tests. For 20 of the most common tracking domains reported by [whotracks.me](https://whotracks.me), the tests attempt to load a tracking script or image. A browser passes the test if it blocks the script or image from being loaded.

In this first run: Brave, DuckDuckGo, Firefox Private Mode and Firefox Focus were found to do substantial tracking content blocking.

### Known issue

Again we have skipped testing of Firefox Nightly because of the browser crash.

## Issue 8 ([Desktop](/archive/issue8.html), [Nightly](/archive/issue8.nightly.html): 2021-12-09)

### New browser versions

Since Issue 7, Firefox has updated to version 95.0.

### Known issue

Because of a crash in Firefox Nightly, it is not included in this week's Nightly browser testing.

## [Issue 7](/archive/issue7.html) (2021-12-02)

### New browser versions

Since Issue 6, Opera has updated to 82.0 and Vivaldi to 5.0.

### Known issue

Because of a crash in Firefox Nightly, it is not included in this week's testing.

## [Issue 6](/archive/issue6.html) (2021-11-24)

### New browser version

Since Issue 5, Edge has updated to version 96.0

### A privacy improvement in Brave

Brave has introduced an important new partitioning behavior. HTTP1, HTTP2, and HTTP3 connections are now partitioned by first party. That means your web connections can no longer be used to correlate your visits between different websites.

Thanks and congratulations to the Brave team for this fix!

## [Issue 5](/archive/issue5.html) (2021-11-17)

### New browser versions

Since Issue 4, three browsers have updates:
* Brave 1.32
* Opera 81.0
* Tor Browser 11.0

## [Issue 4](/archive/issue4.html) (2021-11-09)

### Testing of nightly builds added

I have now added testing of the Nightly build channel (or the nearest equivalent) for all monitored desktop browers. These include:
* Brave Nightly
* Chrome Canary
* Edge Canary
* Firefox Nightly
* Opera Developer
* Safari Technology Preview
* Tor Browser Nightly
* Vivaldi Snapshot

These tests give a preview of future privacy developments in these browsers. And I hope it offers faster feedback for browser development teams as they land patches for new privacy protections.

### New browser versions

Since Issue 3, Firefox has updated to v. 94.0.

## [Issue 3](/archive/issue3.html) (2021-11-02)

### New browser versions

Since Issue 2, new browser releases include Chrome 95.0, Edge 95.0, and Safari 15.1.

### New tests, new results

Three new tests have been added. These are:
1. **Alt-Svc.** When you visit a website for the first time, an [Alt-Svc header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Alt-Svc) may be sent to your browser to indicate that the same website can be fetched in another location or using another protocol. For subsequent, visits, the browser may use that alternate location or protocol instead of the one it originally used on the first connection. A common use of Alt-Svc is for the website suggest to the browser to upgrade the connection from HTTP/2 to HTTP/3. Unfortunately this protocol can leak information about which websites you have visited in the past and even be abused to track you across sites.

2. **Stream isolation.** In Tor Browser, [every website gets its own circuit](https://tor.stackexchange.com/questions/14634/does-tor-browser-open-a-new-circuit-for-each-unique-website) such that all first-party requests and third-party embedded requests for that website are on a separate stream from those of any other website. This helps to reduce the ability of adversaries to correlate a browser's connection to two different websites.

3. **System Font fingerprinting.** If you install a new font on your computer, most browsers will helpfully use that font if it is ever requested by a website you visit. Unfortunately, that reveals to the website that you have installed the font. That information leak turns out to be quite an [important source of fingerprinting entropy](https://dl.acm.org/doi/pdf/10.1145/3178876.3186097), making it easier to track you on the web Today's results show that Safari and Tor Browser protect against this type of fingerprinting.

## [Issue 2](/archive/issue2.html) (2021-10-25)

### Correction

The first issue of PrivacyTests.org had an important error in the results, incorrectly indicating that Safari does not stop tracking via third-party cookies. Safari cookie protections were assigned an <img src="/x-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);" title="fail"> when it should have been a <img src="/check-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);" title="pass">. This incorrect results seems to have happened because the Selenium Webdriver library I had been using to launch and control the various web browsers [likely disables Safari's Intelligent Tracking Protection feature](https://bugs.webkit.org/show_bug.cgi?id=222583). This new issue of PrivacyTests.org results shows the correct <img src="/check-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);" title="pass"> for cookie protections in Safari.

My apologies for the error. Thanks to John Wilander and Steven Englehardt for bringing this issue to my attention. 

### Code updates

Major updates have been made to the [testing code](https://github.com/arthuredelstein/privacytests.org). Because of the error mentioned above, I decided to discontinue the use of Selenium Webdriver altogether in the PrivacyTests.org. Instead, the code has now been extensively rewritten to launch each web browser by executing a shell command, and to direct the web browsers to testing pages via shell commands as well. This new approach has the advantage of more closely mimicking a web browser in its "natural" state. The new code also makes it possible to launch Safari in both standard windows and Private Windows.

Follwing this rewrite, the PrivacyTests.org testing code now runs on macOS only. I plan to extend the new code to be compatible with Linux and Windows in the future.

### New results

Due to popular request, I have added Vivaldi (currently version 4.3) to the roster of tested browsers. In addition, since Issue 1, some browsers have been updated to the latest release versions, including Brave 1.31, Edge 95.0, and Safari 15.0.

### Thank you

Thanks to everyone who gave feedback following the launch. Everyone's comments and suggestions for future improvements are much appreciated!

## [Issue 1](/archive/issue1.html) (2021-10-13)

PrivacyTests.org went live for the first time, presenting desktop browser privacy test results for Brave 1.30, Chrome 94.0, Edge 94.0, Firefox 93.0, Opera 80.0, Safari 14.1, and Tor 10.5.
