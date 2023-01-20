# What is PrivacyTests.org?

Most web browsers leak your identity and your browsing history, but some browsers are more leaky than others.

The goal of PrivacyTests.org is to understand in detail: what data is each web browser leaking? Which web browsers offer the best privacy protections?

PrivacyTests.org is an open-source initiative that subjects popular web browsers to a suite of automated tests. These tests are designed to audit web browsers' privacy properties in an unbiased manner. The results of the tests are made public to help users make an informed choice about which browser to use, and to encourage browser makers to fix leaks of private user data.

## Why privacy on the web matters

The web has rapidly developed into one of the primary mediums used by billions of people to interact with the world. Reading the news, communicating with friends and colleagues, watching movies, participating in political discourse, and searching for information all take place through the web.

Despite the crucial importance of the web, it has been designed in a fashion that historically has not respected users' privacy. Advertising companies have taken advantage of this design to collect tremendous amounts of private data, using it to show ads targeted to specific groups of consumers. Governments have also seized the opportunity to surveill people en masse without their knowledge.

Why are these privacy violations a problem? Privacy is a fundamental human right because it is necessary for preserving the autonomy, safety, and dignity of human beings. Individuals whose privacy is violated are vulnerable to [discrimination](https://www.nber.org/system/files/working_papers/w24551/w24551.pdf) and [manipulation](https://www.channel4.com/news/revealed-trump-campaign-strategy-to-deter-millions-of-black-americans-from-voting-in-2016). [Examples from history](https://www.theengineroom.org/dangerous-data-the-role-of-data-collection-in-genocides/) show that mass surveillance can facilitate enormous harm.

## Why web browsers are critical to online privacy

Once private data has leaked from your computer, phone or tablet, there is not much you can do to control it. But how does data leave your device in the first place?

Your web browser is a likely route: browsers commonly leak data to third parties, revealing what web pages you have visited. This information lets tracking companies know what you read, what you write, where you are located, what you search for, and what you buy. And this highly personal information is assembled by those companies into detailed individual profiles of every person on the internet, containing [data on](https://www.wordstream.com/blog/ws/2018/12/10/facebook-ad-targeting-options) your ethnicity, religious views, political views, sexual orientation, gender, family, friends, colleagues, health history, habits, relationships, educational records, income, and so on. These companies often retain your data for years or decades, and sometimes share it with third parties, including other companies or governments.

Fortunately, most browser makers have acknowledged their responsibility to stop users' private information from leaking out. But the default behavior for browsers used by billions of people remains highly leaky.

## How the tests work

To understand and compare the privacy characteristics of popular web browsers, each browser is subjected to the same suite of rigorous automated tests. Each privacy test examines whether the browser protects against a specific kind of data leak.

The results for all browsers and tests are presented in a [unified table](https://privacytests.org). If a browser is found to protect users from a given data leak, it receives a green <img src="/check-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);">, but if it leaks user data, it receives a red <img src="/x-mark.png" width=16 height=16 style="transform:translate(0px, 0.15em);">.

These tests will be run on a regular basis, to monitor the privacy improvements of each browser. As browser developers fix a privacy vulnerability, it will be reflected in the latest results.

## Work in progress

This project is a work in progress and is under active development! I plan to cover more browsers and more tracking vulnerabilities in the future.

I want to hear from you! All kinds of feedback: comments, suggestions, critiques and questions are welcome. You can contact me via email (contact@privacytests.org), [Twitter](https://twitter.com/privacytests), or [github](https://github.com/arthuredelstein/privacytests.org/issues).

## Full disclosure and transparency

*(Updated June 2022)*

This website and the browser privacy tests are an independent project by me, Arthur Edelstein. I have developed this project on my own time and on my own initiative. Several months after first publishing the website, I became an employee of Brave, where I contribute to Brave's browser privacy engineering efforts. I continue to run this website independently of my employer, however. There is no connection with Brave marketing efforts whatsoever.

I am committed to maintaining this website's accuracy and impartiality. It is my goal not to promote any browser here, but rather to offer objective test results for all browsers that encourages a general improvement in privacy across the industry.

By keeping this project fully open source, I endeavor to provide the maximum possible transparency and verifiability of the tests and results. Anyone who wishes to check the results can clone the git repository and run the browser tests independently. Ideas for additional tests, or code (pull requests) for additional tests that provide further insight into browser privacy, will be gratefully accepted.

## Thanks

Many thanks to the people who have offered suggestions, critiques, bug reports and code contributions, including: Peter Dolanjski, Steven Englehardt, Aleksey Khoroshilov, Simon Mainey, Jasper Rebane, Pete Snyder, and John Wilander.