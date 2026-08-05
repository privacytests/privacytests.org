# PrivacyTests.org
PrivacyTests.org is an open-source testing program that measures browser privacy characteristics, and a website, https://privacytests.org, that renders the results for human consumption.

PrivacyTests.org uses the MIT license.

* aioquic: a submodule with a fork of the aioquic project for HTTP3-related tests
* assets: copy, css, icons, images, fonts for running tests and rendering pages
* live: express JS files for the test server
* results: raw results are saved in this directory
* scripts: scripts for running tests and rendering website and results pages
* static: static files for the test server

The published site lives in a separate repository, [privacytests-website](https://github.com/privacytests/privacytests-website). To prepare or publish results, clone it as a **sibling** of this repo:

```
parent/
  privacytests.org/          # this repository (tests)
  privacytests-website/      # published HTML/JSON/PNG (optional for running tests)
```

Or set `WEBSITE_DIR` to that checkout. Running tests only requires this repository.
