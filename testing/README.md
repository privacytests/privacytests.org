# PrivacyTests.org tests and website
This project runs browser privacy tests (fingerprinting resistance, partitioning between websites, etc.), saves the results to a JSON file, and renders those results in a website.

**NOTE**: privacytests.org no longer uses selenium because it is incompatible with some privacy protections such as Safari's ITP. The code is undergoing many changes and currently only works on macOS. There is no longer
browserstack support.

To set up:

`npm install`

* test.js runs the browser tests.
* render.js takes the results of the browser tests and renders them to a web page.

To run tests, point to a .yaml file:

`node test chromium.yaml`

You can use a few optional flags after the yaml file:

* `--repeat 10`: repeat the whole set of tests 10 times
* `--debug`: Don't close browser(s) after test is done
* `--only brave`: Only run a single browser in the config file with the name given
* `--aggregate`: Combine results from the same browser into a single column (enabled by default)

Config files are YAML arrays. Each item in the array is an object
that describes what should go into a single test. All parameters
are optional, except `browser`:

```
- browser: chrome          # Possible values include chrome, firefox, brave, opera, edge, vivaldi, etc.
  incognito: true,         # Set incognito to true for private browsing windows.
  tor: true                # Set tor to true for 'Brave Private Window with Tor.'
  repeat: 1                # Integer, how many times we should repeat this test.
  disable: false           # If true, this test won't be run.
- browser: firefox         # On to the next test item in the array...
  ...
```

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

