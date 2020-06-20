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
      img.src = testURI("resource", "image", key);
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
      }, "*");
      return key;
    },
    read: async (key) => {
      parent.postMessage({
        faviconURI: testURI("resource", "favicon", key)
      }, "*");
      await sleepMs(500);
      let response = await fetch(
        testURI("count", "image", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "font": {
    write: async (key) => {
      let style = document.createElement("style");
      style.type='text/css';
      let fontURI = testURI("resource", "font", key);
      style.innerHTML = `@font-face {font-family: "myFont"; src: url("${fontURI}"); } body { font-family: "myFont" }`;
      document.getElementsByTagName("head")[0].appendChild(style);
      return key;
    },
    read: async (key) => {
      let style = document.createElement("style");
      style.type='text/css';
      let fontURI = testURI("resource", "font", key);
      style.innerHTML = `@font-face {font-family: "myFont"; src: url("${fontURI}"); } body { font-family: "myFont" }`;
      document.getElementsByTagName("head")[0].appendChild(style);
      let response = await fetch(
        testURI("count", "font", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
/*  "video": {
    write: (key) => new Promise((resolve, reject) => {
      let video = document.createElement("video");
      document.body.appendChild(video);
      video.preload="auto";
      video.addEventListener("canplaythrough", () => resolve(key), {once: true});
      video.src = testURI("resource", "video", key);
    }),
    read: async (key) => {
      let video = document.createElement("video");
      document.body.appendChild(video);
      video.preload="auto";
      let videoLoadPromise = new Promise((resolve, reject) => {
        video.addEventListener("canplaythrough", resolve, {once: true});
      });
      video.src = testURI("resource", "video", key);
      await videoLoadPromise;
      let response = await fetch(
        testURI("count", "video", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },*/
  "locks": {
    write: async (key) => {
      if (navigator.locks) {
        navigator.locks.request(key, lock => new Promise((f,r) => {}));
        let queryResult = await navigator.locks.query();
        return queryResult.held[0].clientId;
      }
    },
    read: async () => {
      if (navigator.locks) {
        let queryResult = await navigator.locks.query();
        return queryResult.held[0].name;
      }
    }
  },
  "etag": {
    write: async (key) => {
      await fetch(testURI("etag", "request", key));
      return key;
    },
    read: async (key) => {
      await fetch(testURI("etag", "request", key));
      let response = await fetch(testURI("etag", "value", key));
      let responseText = await response.text();
      if (responseText === "undefined") {
        return undefined;
      } else {
        return responseText;
      }
    }
  },
  "HSTS": {
    write: () => {
      let image = document.getElementById("hsts-image");
      image.src = "https://hsts.arthuredelstein.net/set_hsts.png";
    },
    read: () => new Promise((resolve, reject) => {
      let image = document.getElementById("hsts-image");
      image.onload = () => resolve("image load succeeded");
      image.onerror = () => reject(new Error("image load failed"));
      image.src = "http://hsts.arthuredelstein.net/test_hsts.png";
    })
  },
  "TLS Session Id": {
    write: async () => {
      let results = await fetch("https://tls.arthuredelstein.net/");
      return results.json().sessionId;
    },
    read: async () => {
      let results = await fetch("https://tls.arthuredelstein.net:8900/");
      return results.json().sessionId;
    }
  }
};

runAllTests(tests);

console.log("hello from supercookies_inner.js");
