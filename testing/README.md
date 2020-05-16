This project runs browser privacy tests (fingerprinting resistance, partitioning between websites, etc.) using selenium and saves the results to a JSON file.

To set up:

`npm install`

* index.js runs the browser tests.
* render.js takes the results of the browser tests and renders them to a web page.

To run tests, point to a .config file:

`node index browserprivacy.config`

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

