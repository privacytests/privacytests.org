import { runAllTests} from "./test_utils.js"
import * as IdbKeyVal from 'https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval.mjs';

let testURI = (path, type, key) =>
    `https://arthuredelstein.net/browser-privacy-live/${path}?type=${type}&key=${key}`;

let sleepMs = (timeMs) => new Promise(
  (resolve, reject) => setTimeout(resolve, timeMs)
);

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
  "fetch": {
    write: async (key) => {
      let response = await fetch(testURI("resource", "fetch", key),
                                 {cache: "force-cache"});
      return key;
    },
    read: async (key) => {
      let response = await fetch(testURI("resource", "fetch", key),
                                 {cache: "force-cache"});
      let countResponse = await fetch(testURI("count", "fetch", key),
                                      {cache: "reload"})
      return (await countResponse.text()).trim();
    }
  },
  "XMLHttpRequest": {
    write: () => new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.addEventListener("load", () => resolve(
        {"secret": xhr.getResponseHeader("date")}));
      xhr.open("GET", "https://arthuredelstein.net");
      xhr.setRequestHeader("Cache-Control", "no-cache");
      xhr.send();
      setTimeout(() => reject({message: "XHR: no response"}), 3000);
    }),
    read: () => new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.addEventListener("load", () => resolve(
        xhr.getResponseHeader("date")));
      xhr.open("GET", "https://arthuredelstein.net");
      xhr.setRequestHeader("Cache-Control", "max-age");
      xhr.send();
      setTimeout(() => reject({message: "XHR: no response"}), 3000);
    })
  },
  "iframe": {
    write: (key) => new Promise((resolve, reject) => {
      let iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      iframe.addEventListener("load", () => resolve(key), {once: true});
      iframe.src = testURI("resource", "page", key);
    }),
    read: async (key) => {
      let iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      let iframeLoadPromise = new Promise((resolve, reject) => {
        iframe.addEventListener("load", resolve, {once: true});
      });
      let address = testURI("resource", "page", key);
      iframe.src = address;
      await iframeLoadPromise;
      let response = await fetch(
        testURI("count", "page", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "image": {
    write: (key) => new Promise((resolve, reject) => {
      let img = document.createElement("img");
      document.body.appendChild(img);
      img.addEventListener("load", () => resolve(key), {once: true});
      img.src = testURI("resource", "image", key);
    }),
    read: async (key) => {
      let img = document.createElement("img");
      document.body.appendChild(img);
      let imgLoadPromise = new Promise((resolve, reject) => {
        img.addEventListener("load", resolve, {once: true});
      });
      let address = testURI("resource", "image", key);
      img.src = address;
      await imgLoadPromise;
      let response = await fetch(
        testURI("count", "image", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "CacheStorage": {
    write: async (key) => {
      let cache = await caches.open("supercookies");
      cache.addAll([`test.css?key=${key}`]);
    },
    read: async () => {
      let cache = await caches.open("supercookies");
      let cacheKeys = await cache.keys();
      let url = cacheKeys[0].url;
      return (new URL(url)).searchParams.get("key");
    }
  },
  "favicon": {
    write: (key) => {
      parent.postMessage({
        faviconURI: testURI("resource", "favicon", key)
      });
      return key;
    },
    read: async (key) => {
      parent.postMessage({
        faviconURI: testURI("resource", "favicon", key)
      });
      await sleepMs(500);
      let response = await fetch(
        testURI("count", "image", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  }
};

runAllTests(tests);

console.log("hello from supercookies_inner.js");
