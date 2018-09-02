let tests = {
  "cookie": {
    write: (secret) => {
      let expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      document.cookie = `secret=${secret};expires=${expiry.toUTCString()}`;
    },
    read: () => {
      return document.cookie;
    },
  },
  "localStorage": {
    write: (secret) => {
      localStorage.setItem("secret", secret);
    },
    read: () => {
      return localStorage.getItem("secret");
    }
  },
  "sessionStorage": {
    write: (secret) => {
      sessionStorage.setItem("secret", secret);
    },
    read: () => {
      return sessionStorage.getItem("secret");
    },
  },
  "blob": {
    write: (secret) => {
      return URL.createObjectURL(new Blob([secret]));
    },
    read: async (url) => {
      let response = await fetch(url);
      return response.text();
    },
  },
};

let runWriteTests = (secret) => {
  let keys = {};
  for (let test of Object.keys(tests)) {
    console.log(test, tests[test].write.toString());
    let key = tests[test].write(secret);
    if (key !== undefined) {
      keys[test] = key;
    }
  }
  return keys;
};

let runReadTests = async () => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let readout = await tests[test].read();
    console.log(test, tests[test].read.toString(), readout);
    results[test] = readout;
  }
  return results;
};

(async () => {
  let searchParams = new URL(document.URL).searchParams;
  let secret = searchParams.get("secret");
  let write = searchParams.get("write");
  let read = searchParams.get("read");
  let readParams = searchParams.get("readParams");
  let results = write ? runWriteTests(secret) : runReadTests();
  if (window.location !== parent.location) {
    parent.postMessage(results, "*");
//  } else {
    console.log(results);
//  }
})();
