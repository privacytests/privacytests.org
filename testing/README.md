This project runs browser privacy tests (fingerprinting resistance, partitioning between websites, etc.) using selenium and saves the results to a JSON file.

To set up:

`npm install`

* index.js runs the browser tests.
* render.js takes the results of the browser tests and renders them to a web page.

To run tests, point to a .config file:

`node index browserprivacy.config`

Config files are JSON arrays. Each item in the array is an object
that describes what should go into a single test.

```
{
  browser: "name" // name=chrome, firefox, brave, opera, edge, et.c
  browser_version: "92.0" // A string, the version of the browser number
  os: "windows" // windows, macOS, iOS, linux (optional)
  os_version: "10" // a string, the version of the OS we want (for remote)
  incognito: true // set incognito to true for private browsing windows
  tor_mode: true // Tor mode is currently supported in Brave
  service: "browserstack" // set remote service (currently browserstack supported)
}
```

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

