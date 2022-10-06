# A response to Vivaldi's statement regarding PrivacyTests.org

Vivaldi Technologies, the company that makes Vivaldi browser, has posted a [statement on their website](https://web.archive.org/web/20221003174703/https://vivaldi.com/security/common-questions/#privacytests) regarding PrivacyTests.org. Unfortunately, Vivaldi's statement contains claims about this project that I believe are inaccurate and should be corrected.

I address Vivaldi's claims below, but first I want to mention that criticism of the PrivacyTests.org project is very welcome. In this project I have striven for accuracy and transparency. If anyone discovers an inaccuracy or something that is not clear, I will be very grateful, and I will endeavor to fix the problem promptly.

In the remainder of this post I address three claims made by Vivaldi in their statement. I explain how each claim is not supported by the evidence.

Here is Vivaldi's first claim:

> The results shown on that testing website are misleading.

Unfortunately, Vivaldi does not reveal which results they believe are misleading, or provide any evidence for why they believe the results are misleading. All test results presented are accurate to the best of my knowledge. Any information to the contrary would be much appreciated.

Vivaldi's second claim:

> [The website] does not test using actual trackers.

This claim is simply not true. The website includes three sections that test blocking of actual top tracking domains seen in the wild. These sections, which have been included on the website since December 2021, are: **Tracking query parameter tests**, **Tracker content blocking**, and **Tracking cookie protection**. Results from these sections indicate whether the browser blocks tracking query parameters, tracking scripts, and tracking cookies, respectively, from those domains.

Vivaldi fails the tracking cookie and tracking content blocking tests because *Vivald's tracker blocking feature is disabled by default.* Indeed, if you manually enable Vivaldi's tracker blocking, then Vivaldi will pass most of the tests in those two sections. But PrivacyTests.org examines browsers' default behavior: that's because I believe that **users deserve privacy by default**, based on the observation that many users do not tweak their browser's settings. Vivaldi could easily pass those tests by enabling their tracker blocking by default.

Vivaldi's third claim:

> Tests on that website assume that browsers must use an approach that causes problems with legitimate websites.

> [A privacy oriented browser] could simply refuse to support things that might get used for both legitimate purposes and tracking, such as localStorage and cookies (third party or otherwise), or APIs that might provide useful data to websites, such as the dimensions of your screen. This will definitely cause many legitimate websites to break.

If that's the case, how is it that Safari, Firefox, and Brave pass most of the partitioning tests on PrivacyTests.org, including those for localStorage and cookies? Are they causing "many legitimate websites to break"? No. In fact, these browsers still support localStorage and cookies, while adding restrictions that prevent these APIs from being abused to track users between websites.

It's important to note that [Chrome has indicated](https://developer.chrome.com/docs/privacy-sandbox/storage-partitioning/) that they will be introducing protections that prevent cross-site tracking by partitioning storage, with a planned launch in 2023. I hope that Vivaldi will take advantage of this work in Chrome to enable partitioning protections by default in their own browser.

What about screen dimensions? Already, Tor Browser, LibreWolf, and Mull Browser have stopped leaking a user's screen width and height to any website that asks. While this protection remains more cutting-edge, I'm not aware of any website that breaks if browsers don't reveal the true screen dimensions. I would be very interested if anyone has examples.

In summary, I hope Vivaldi will reconsider their position. PrivacyTests.org is intended to offer constructive feedback to browser makers on how they can improve the privacy in their web browsers. Given the high level of innovation at Vivaldi, I hope the company will work on bringing state-of-the-art privacy by default to its users.

-- Arthur Edelstein, 2022 October 5
