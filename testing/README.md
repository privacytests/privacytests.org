This project runs browser privacy tests (fingerprinting resistance, partitioning between websites, etc.) using selenium and saves the results to a JSON file.

To set up:

`npm install`

* index.js runs the browser tests.
* render.js takes the results of the browser tests and renders them to a web page.

To run tests, point to a .config file:

`node index browserprivacy.config`

There are a few optional flags:

`--repeat 10`: repeat the whole set of tests 10 times
`--stayOpen`: Don't close browser(s) after test is done
`--only brave`: Only run a single browser with the name given

Config files are JSON arrays. Each item in the array is an object
that describes what should go into a single test. All parameters
are optional, except `browser`:

```
{
  browser: "chrome", // Possible values include chrome, firefox, brave, opera, edge, etc.
  browser_version: "92.0", // A string, the version of the browser
  os: "windows", // windows, macOS, iOS, linux (optional)
  os_version: "10", // a string, the version of the OS we want (for remote)
  incognito: true, // set incognito to true for private browsing windows
  tor_mode: true, // Tor mode is currently supported in Brave
  service: "browserstack", // set remote service (currently browserstack supported)
  repeat: 1 // integer, how many times we should repeat this test.
  disable: false // If true, this test won't be run.
}
```

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

