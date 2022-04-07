# News

## [Issue 20](/): 2022-04-07

### New browser

In this issue I have added Mull to the set of Android browsers.

### System font fingerprinting in Brave

Brave 1.39 (currently Nightly) has introduced a [new protection against system font fingerprinting](https://brave.com/privacy-updates/17-language-fingerprinting/). It works by randomizing the user-installed fonts that are exposed to a web page. I am investigating how to test this new protection, so no "pass" or "fail" decision has yet been made.

### New browser versions

New Desktop browser versions are:
* Brave 1.37
* Chrome 100.0
* Edge 100.0
* LibreWolf 98.0
* Opera 85.0
* Ungoogled 100.0
* Vivaldi 5.2

New iOS browser versions are:
* DuckDuckGo 7.66
* Firefox 98.2
* Focus 98.1
* Safari 15.4

New Android browser versions are:
* Brave 1.37
* Bromite 100.0
* Chrome 1.00.0
* DuckDuckGo 5.119
* Edge 100.0
* Firefox 99.1
* Focus 98.3
* Opera 68.2
* Vivaldi 5.2

## [Issue 19](/archive/issue19/): 2022-03-22

### Correction

The Brave team [reported](https://github.com/arthuredelstein/privacytests.org/issues/101) a bug that resulted in incorrect results for the Alt-Svc test on the Brave browser. Apologies for the bug; I have corrected the issue. Thanks to Aleksey Khoroshilov and Pete Snyder for alerting me to the issue.

### New browser

In this issue, we have added Firefox Focus to the set of Android browsers.

### New browser versions

New iOS browser versions are:
* Brave 1.36
* Chrome 99.4844
* Firefox 98.1
* Focus 98.0
* Yandex 2203.2

New android browser versions are:
* Brave 1.36
* Bromite 99.0
* DuckDuckGo 5.116
* Firefox 98.2
* Yandex 22.3

## [Issue 18](/archive/issue18/): 2022-03-11

### New browser versions

New desktop browser versions are:
* Chrome 99.0
* Edge 99.0
* Firefox 98.0
* Ungoogled 99.0

New Android browser versions:
* Chrome 99.0
* DuckDuckGo 5.115
* Edge 99.0
* Firefox 98.1
* Samsung 16.2

New iOS browser version:
* Edge: 99.1150

## [Issue 17](/archive/issue17/): 2022-03-04

### New "tracking cookie protection" category of tests

Today I am publishing a set of new "tracking cookie protection" tests for desktop browsers. In these tests, we check whether the browser allows cookies from 19 of the top tracking domains to be shared across websites. The test works as follows:

1. A web page from test site A is loaded with third-party tracking subresources, one from each tracking domain. A mitm proxy is used to inject a "Set-Cookie" header for each tracker.
2. A second web page from test site B is loaded, with the same set of tracking subresources. The MITM proxy is again used to test whether it can read back the same cookies that were set for those tracking domains in step 1.

### New browser versions

Desktop versions:
* Brave 1.36
* Opera 84.0

New Android browser versions:
* Brave 1.35
* Bromite 98.0
* Chrome 98.0
* DuckDuckGo 5.113
* Edge 98.0
* Firefox 97.2
* Opera 67.1
* Tor 11.0
* Vivaldi 5.1

New iOS browser versions:
* Brave 1.35
* Edge 98.1108
* Safari 15.3
* Yandex 2201.6

## [Issue 16](/archive/issue16/): 2022-02-16

### New cookie test

I have expanded general cookie testing to examine both cross-site tracking via HTTP cookies and cross-site tracking via JavaScript cookies (aka document.cookie).

### New versions

New desktop browser versions are:
* Edge 98.0
* Firefox 97.0
* Librewolf 97.0-2
* Ungoogled Chromium 98.0
* Vivaldi 5.1

New Android browser version:
* DuckDuckGo 5.112

New iOS browser versions:
* Chrome 98.4758
* Firefox 97.0
* Focus 97.0

## [Issue 15](/archive/issue15/): 2022-02-03

After a brief pause to investigate an inconsistency in test results, we are back with Issue 15:

New desktop browser versions are:
* Brave 1.35
* Chrome 98.0

On Android, one browser updated:
* Firefox 96.2

On iOS, updates are:
* Brave 1.34
* Chrome 97.4692
* Firefox 96.0
* Yandex 2201.3

### Investigation of inconsistency in four cache partitioning tests

Over the past week, I investigated puzzling behavior in four partitioning tests: CSS cache, font cache, image cache, and prefetch cache. Chromium-based browsers were passing these privacy tests, but, surprisingly, running the same tests manually or via a different testing framework resulted in failures. I wanted to understand why I was getting these inconsistent results, to make sure the published results are correct going forward.

Whether these tests passed or failed (i.e, isolation or sharing of data between websites) turned out to depend on how two pages from different websites were loaded. If the two pages are loaded completely independently, we see isolation, but if one page is loaded in a child tab of the other page, or if one page navigates to a second page, we see that the two pages can share cache data. That indicates that Chromium browsers are weakly isolating these caches, but not isolating them under all circumstances.

I decided to take the more stringent testing approach, on the principle that browsers should always isolate websites' data from one another except under user consent. So in this issue, the testing framework has been updated such that we see these tests newly failing for several Chromium-based browsers.

Thanks to Steven Englehardt for alerting me to this problem and providng helpful guidance.

## [Issue 14](/archive/issue14/): 2022-01-21

This week, Opera Desktop has updated to version 83.0.

On Android, new browser versions are:
* DuckDuckGo 5.109
* Fireofx 96.2
* Yandex 22.1

## [Issue 13](/archive/issue13/): 2022-01-14

This week, new desktop browser versions include:
* Firefox 96.0
* LibreWolf 96.0
* Safari 15.2
* Ungoogled Chromium 87.0

On iOS, new browser versions are:
* Edge 97.1072
* Yandex 2201.0

And on Android, we have:
* Brave 1.34
* DuckDuckGo 5.107
* Edge 97.0
* Opera 66.2
* Samsung 16.0

## [Issue 12](/archive/issue12/): 2022-01-07

This week, new desktop browser versions include:
* Brave 1.34
* Chrome 97.0
* Edge 97.0

## [Issue 11](/archive/issue11/): 2021-12-31

### New browsers

This week we have added the privacy-oriented Bromite browser to our Android tests, and Ungoogled Chromium to our desktop tests.

## [Issue 10.1](archive/issue10.1/): 2021-12-26

Issue 10.1 fixes a problem in Issue 10 where Alt-Svc and H3 connection tests weren't operating properly.

## Issue 10: 2021-12-24
([Desktop](archive/issue10/index.html), [Private modes](archive/issue10/private.html), [Android](archive/issue10/android.html), [iOS](archive/issue10/ios.html), [Nightly](archive/issue10/nightly.html), [Nightly private modes](archive/issue10/nightly-private.html))


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
