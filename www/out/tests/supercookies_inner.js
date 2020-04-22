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
/*
  "SharedWorker": {
    write: run_in_sharedworker(() => { self.secret = secret; }),
    read: run_in_sharedworker(() => self.secret),
  },
*/
/*
  "blob": {
    write: (secret) => URL.createObjectURL(new Blob([secret])),
    read: async (url) => {
      if (url) {
        let response = await fetch(url);
        return response.text();
      }
    },
  },
*/
};

let runWriteTests = (secret) => {
  console.log(`runWriteTests(${secret})`);
  for (let key of Object.keys(tests)) {
    console.log(key, tests[key].write.toString());
    tests[key].write(secret);
  }
};

let runReadTests = async () => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let result;
    try {
      result = await tests[test].read();
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

(async () => {
  let searchParams = new URL(document.URL).searchParams;
  console.log(`searchParams = ${searchParams}`);
  let secret = searchParams.get("secret");
  let mode = searchParams.get("mode");
  let results = mode === "write" ? runWriteTests(secret) : await runReadTests();
  console.log("results", results);
  if (window.location !== parent.location) {
    parent.postMessage(results, "*");
  }
})();
console.log("hello from supercookies_inner.js");
