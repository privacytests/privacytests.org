import * as IdbKeyVal from 'https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval.mjs';

console.log("hi");

const run_in_sharedworker = function (aFunction) {
  return new Promise(resolve => {
    const worker = new SharedWorker(
      URL.createObjectURL(
        new Blob([
          `postMessage((${aFunction.toString()})())`
        ])
      )
    );
    worker.onmessage = msg => resolve(msg.data);
  });
};


let tests = {
  "cookie": {
    write: (secret) => {
      let expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      document.cookie = `secret=${secret};expires=${expiry.toUTCString()}`;
    },
    read: () => document.cookie ? document.cookie.match(/secret=(\S+)/)[1] : null,
   },
  "localStorage": {
    write: (secret) => localStorage.setItem("secret", secret),
    read: () => localStorage.getItem("secret"),
  },
  "sessionStorage": {
    write: (secret) => sessionStorage.setItem("secret", secret),
    read: () => sessionStorage.getItem("secret"),
  },
  "indexedDB": {
    write: async (secret) => await IdbKeyVal.set("secret", secret),
    read: async () => IdbKeyVal.get("secret")
  },
/*
  "SharedWorker": {
    write: run_in_sharedworker(() => { self.secret = secret; }),
    read: run_in_sharedworker(() => self.secret),
  },
*/

  "blob": {
    write: (secret) => URL.createObjectURL(new Blob([secret])),
    read: async (url) => {
      if (url) {
        let response = await fetch(url);
        return response.text();
      }
    },
  },
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
