This project runs browser privacy tests (fingerprinting resistance, partitioning between websites, etc.) using selenium and saves the results to a JSON file.

To set up:

`npm install`

* index.js runs the browser tests.
* render.js takes the results of the browser tests and renders them to a web page.

To run tests, point to a .yaml file:

`node index chromium.yaml`

There are a few optional flags:

* `--repeat 10`: repeat the whole set of tests 10 times
* `--stayOpen`: Don't close browser(s) after test is done
* `--only brave`: Only run a single browser with the name given

Config files are YAML arrays. Each item in the array is an object
that describes what should go into a single test. All parameters
are optional, except `browser`:

```
- browser: chrome          # Possible values include chrome, firefox, brave, opera, edge, etc.
  browser_version: '92.0'  # A string, the version of the browser (for remote).
  os: windows              # Operating system: windows, macOS, iOS, linux (for remote).
  os_version: '10'         # A string, the version of the OS we want (for remote).
  incognito: true,         # Set incognito to true for private browsing windows.
  tor_mode: true           # Set tor_mode to true for 'Brave Private Window with Tor.'
  service: browserstack    # Use remote selenium service (currently browserstack is supported).
  repeat: 1                # Integer, how many times we should repeat this test.
  disable: false           # If true, this test won't be run.
- browser: firefox         # On to the next test item in the array...
  ...
```

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

