# News

## [Issue 2](/) (2021-10-25)

### Correction

Our first issue of PrivacyTests.org had an important error in the results, incorrectly indicating that Safari does not stop tracking via third-party cookies. This incorrect result (Safari cookie protections were assigned an <img src="/x-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);" title="fail"> when it should have been a <img src="/check-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);" title="pass">) seems to have happened because the Selenium Webdriver library I had been using to launch and control the various web browsers [apparently disables Safari's Intelligent Tracking Protection feature](https://bugs.webkit.org/show_bug.cgi?id=222583). I am sorry for the error. 

Thanks to John Wilander and Steven Englehardt for bringing this issue to my attention. This new issue of PrivacyTests.org results shows the correct <img src="/check-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);" title="pass"> for cookie protections in Safari.

### Code updates

Major updates have been made to the [testing code](https://github.com/arthuredelstein/privacytests.org). Because of the error mentioned above, I decided to discontinue the use of Selenium Webdriver altogether in the PrivacyTests.org. Instead, the code has now been extensively rewritten to launch each web browser by executing a shell command, and to direct the web browsers to testing pages via shell commands as well. This new approach has the advantage of more closely mimicking a web browser in its "natural" state. The new code also makes it possible to launch Safari in both standard windows and Private Windows.

Follwing this rewrite, the PrivacyTests.org testing code now runs on macOS only. I plan to extend the new code to be compatible with Linux and Windows in the future.

### New results

Due to popular request, I have added Vivaldi (currently version 4.3) to the roster of tested browsers. In addition, since Issue 1, some browsers have been updated to the latest release versions, including Brave 1.31, Edge 95.0, and Safari 15.0.

### Thank you

Thanks to everyone who gave feedback following the launch. Everyone's comments and suggestions for future improvements are much appreciated!

## [Issue 1](/archive/issue1.html) (2021-10-13)

PrivacyTests.org went live for the first time, presenting desktop browser privacy test results for Brave 1.30, Chrome 94.0, Edge 94.0, Firefox 93.0, Opera 80.0, Safari 14.1, and Tor 10.5.
