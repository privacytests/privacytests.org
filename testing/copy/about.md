# What is PrivacyTests.org?

All web browsers leak, but some browsers are more leaky than others. Most web browsers leak your identity and your browsing history.

The goal of PrivacyTests.org is to understand in detail: what data is each web browser leaking? Which web browsers offer the best privacy protections?

PrivacyTests.org is an open-source initiatve that regularly subjects popular web browsers to a suite of automated tests. These tests are designed to audit web browsers' privacy properties in an unbiased manner. The results of the tests are made public to help users make an informed choice about which browser to use, and to encourage browser makers to fix leaks of private user data.

## Why privacy on the web matters

The web has rapidly developed into one of the primary ways that billions of people interact with the world. Reading the news, communicating with friends and colleagues, watching movies, participating in political discourse, and searching for information all take place heavily through the web.

Despite the crucial importance of the web, it has been designed in a fashion that historically has not respected users' privacy. Advertising companies have taken advantage of this design to collect tremendous quantities of private data, using it to show ads targeted to specific groups of consumers. Governments have also seized the opportunity to surveill people en masse without their knowledge.

Why are these privacy violations a problem? Privacy is a fundamental human right because it is necessary to preserving the autonomy, safety, and dignity of human beings. Individuals whose privacy is violated are vulnerable to [discrimination](https://www.nber.org/system/files/working_papers/w24551/w24551.pdf) and [manipulation](https://www.channel4.com/news/revealed-trump-campaign-strategy-to-deter-millions-of-black-americans-from-voting-in-2016). [Examples from history](https://www.theengineroom.org/dangerous-data-the-role-of-data-collection-in-genocides/) show that mass surveillance can facilitate enormous harm.

> "We are creating an architecture of surveillance that is so good that if it gets taken over by a bad government we are in serious trouble because it will be impossible to resist." — Carissa Véliz.

## Why web browsers are critical to online privacy

Once private data has leaked from your computer, phone or tablet, there is not much you can do to control it. But how did that data leave your device in the first place? Frequently your data is quietly leaked by your web browser.

Web browsers commonly leak data revealing what web pages you have visited to third parties. This information lets tracking companies know what you read, what you write, where you are located, what you search for and what you buy. And this highly personal information is assembled by those companies into detailed individual profiles of every person on the internet, containing [data on](https://assets.wordstream.com/s3fs-public/styles/simple_image/public/images/media/images/facebook_ad_targeting_options_infographic_update.png?26LWxETqnc01Oo7_PuvplhKTsNHCC0gA&itok=67flVdty) your ethnicity, your religious views, your politic views, your sexual orientation, your gender, your family, your friends, your colleagues, your health history, your habits, your relationships, your educational records, your income, and so on. These companies often retain your data for years or decades, and sometimes sharing it with third parties, including other companies or governments.

Fortunately, most browser makers have acknowledged their responsibility to stop users' private information from leaking out in the first place. But the default behavior for browsers used by billions of people remains highly leaky. Browsers continue to leak massive quantities of user data.

## How the tests work

In order to understand and compare what the privacy characteristics of browsers are, we subject each browser to the same suite of rigorous automated tests. Each privacy test examines whether the browser protects against a specific kind of data leak.

The results for all browsers and tests are presented in a unified table. If a browser is found to protect users from a given data leak, it gets a green <img src="/check-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);">, but if it leaks user data, it gets a red <img src="/x-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);">.

We plan to run these tests on a regular basis, to monitor the privacy improvements of each browser. As browser developers fix a privacy vulnerability, it will be reflected in the latest results.

## Work in progress

This project is a work in progress and is under active development! We plan to cover more browsers and more tracking vulnerabilities in the future. [Feedback](https://twitter.com/browserprivacy), [bug reports](https://github.com/arthuredelstein/browser-privacy/issues) and [pull requests](https://github.com/arthuredelstein/browser-privacy/pulls) are welcome.

*This website and the browser privacy tests are an independent project by Arthur Edelstein.*
