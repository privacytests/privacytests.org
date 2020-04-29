import * as IdbKeyVal from 'https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval.mjs';

console.log("hi");

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
  "indexedDB": {
    write: (secret) => IdbKeyVal.set("secret", secret),
    read: () => IdbKeyVal.get("secret")
  },
  "SharedWorker": {
    write: (secret) => {
      let worker = new SharedWorker("supercookies_sharedworker.js");
      worker.port.start();
      worker.port.postMessage(secret);
    },
    read: () =>
      new Promise((resolve, reject) => {
        let worker = new SharedWorker("supercookies_sharedworker.js");
        worker.port.start();
        worker.port.postMessage("request");
        worker.port.onmessage = (e) => resolve(e.data);
        setTimeout(() => reject("no SharedWorker message received"), 1000);
      })
  },
  "blob": {
    write: (secret) => URL.createObjectURL(new Blob([secret])),
    read: async (url) => {
      if (url) {
        let response = await fetch(url);
        return response.text();
      }
    },
  },
  "BroadcastChannel": {
    write: (secret) => {
      let bc = new BroadcastChannel("secrets");
      bc.onmessage = (event) => {
        if (event.data === "request") {
          bc.postMessage(secret);
        }
      }
    },
    read: () =>
      new Promise((resolve, reject) => {
        let bc = new BroadcastChannel("secrets");
        bc.onmessage = (event) => {
          if (event.data !== "request") {
            resolve(event.data);
          }
        };
        bc.postMessage("request");
        setTimeout(() => reject({message: "no BroadcastChannel message"}), 3000);
      })
  },
  "fetch_caching": {
    write: async () => {
      let response = await fetch("https://www.random.org/integers/?num=1&min=1&max=1000000000&col=5&base=10&format=plain&rnd=new",
                                 {cache: "reload"});
      let text = await response.text();
      return {"secret": text.trim()};
    },
    read: async () => {
      let response = await fetch("https://www.random.org/integers/?num=1&min=1&max=1000000000&col=5&base=10&format=plain&rnd=new",
                                 {cache: "force-cache"});
      let text = await response.text();
      return text.trim();
    }
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
