let testURI = (path, type, key) =>
    `https://arthuredelstein.net/browser-privacy-live/${path}?type=${type}&key=${key}`;

let sleepMs = (timeMs) => new Promise(
  (resolve, reject) => setTimeout(resolve, timeMs)
);

let tests = {
  "window.name": {
    write: (secret) => {
      window.name = secret;
      let expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      document.cookie = `secret=${secret};expires=${expiry.toUTCString()}`;
    },
    read: () => window.name;
   },
  "sessionStorage": {
    write: (secret) => localStorage.setItem("secret", secret),
    read: () => localStorage.getItem("secret"),
  }
};

let runTests = async (mode, params) => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let result;
    try {
      let input = params[test] || params["default"];
      console.log("input", input);
      result = await tests[test][mode](input);
    } catch (e) {
      result = "Error: " + e.message;
    }
    results[test] = {
      write: tests[test].write.toString(),
      read: tests[test].read.toString(),
      result,
    };
  }
  return results;
};

let queryParams = (urlString) => {
  let searchParams = new URL(urlString).searchParams;
  return Object.fromEntries(searchParams.entries());
};

(async () => {
  let params = queryParams(document.URL);
  let results = await runTests(params["mode"], params);
  console.log("results", results);
  if (window.location !== parent.location) {
    parent.postMessage(results, "*");
  }
})();
console.log("hello from supercookies_inner.js");
