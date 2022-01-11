import { runAllTests, sleepMs } from "./test_utils.js";
import * as IdbKeyVal from 'https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval.mjs';

// Wrap the code for any browsers that don't support top-level await.
(async () => {

const baseURI = "https://arthuredelstein.net/browser-privacy-live/";

let testURI = (path, type, key) => `${baseURI}${path}?type=${type}&key=${key}`;

let fetchText = async (...args) => {
  let response = await fetch(...args);
  return await response.text();
};

const { ipAddress, usingTor } = await (async () => {
  const response = await fetch("https://wtfismyip.com/json");
  const wtfJSON = await response.json();
  const ipAddress = wtfJSON["YourFuckingIPAddress"];
  const onionooResponse = await fetch(`https://onionoo.torproject.org/details?limit=1&search=${ipAddress}`);
  const onionooJSON = await onionooResponse.json();
  const usingTor = onionooJSON.relays.length > 0;
  return { ipAddress, usingTor };
})();

let tests = {
  "cookie": {
    description: "The cookie, first introduced by Netscape in 1994, is a small amount of data stored by your browser on a website's behalf. It has legitimate uses, but it is also the classic cross-site tracking mechanism, and today still the most popular method of tracking users across websites. Browsers can stop cookies from being used for cross-site tracking by either blocking or partitioning them.",
    write: (secret) => {
      let expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      document.cookie = `secret=${secret}; SameSite=None; Secure`;
    },
    read: () => document.cookie ? document.cookie.match(/secret=(\S+)/)[1] : null,
   },
  "localStorage": {
    description: "The localStorage API gives websites access to a key-value database that will remain available across visits. If the localStorage API is not partitioned or blocked, it can also be used to track users across websites.",
    write: (secret) => localStorage.setItem("secret", secret),
    read: () => localStorage.getItem("secret"),
  },
  "indexedDB": {
    description: "The IndexedDB API exposes a transactional database to web pages. That database can be used to track users across websites, unless it is partitioned.",
    write: async (secret) => {
      try {
        return await IdbKeyVal.set("secret", secret);
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: () => IdbKeyVal.get("secret")
  },
  "SharedWorker": {
    description: "The SharedWorker API allows scripts from multiple tabs to share a background thread of computation. If SharedWorker is not partitioned, then it can be abused to shared data between websites in your browser.",
    write: (secret) => {
      try {
        let worker = new SharedWorker("supercookies_sharedworker.js");
        worker.port.start();
        worker.port.postMessage(secret);
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: () =>
      new Promise((resolve, reject) => {
        let worker = new SharedWorker("supercookies_sharedworker.js");
        worker.port.start();
        worker.port.postMessage("request");
        worker.port.onmessage = (e) => resolve(e.data);
        setTimeout(() => reject("no SharedWorker message received"), 100);
      })
  },
  "blob": {
    description: "A 'blob URL' is a local reference to some raw data. Trackers can use a blob URL to share data between websites.",
    write: (secret) => {
      try {
        let blobURL = URL.createObjectURL(new Blob([secret]));
        fetch(`${baseURI}/blob?mode=write&key=${secret}&blobUrl=${encodeURIComponent(blobURL)}`);
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: async (secret) => {
      let response = await fetch(`${baseURI}/blob?mode=read&key=${secret}`);
      let result = await response.json();
      let blobUrl = decodeURIComponent(result.blobUrl);
      let blobResponse = await fetch(blobUrl);
      return blobResponse.text();
    },
  },
  "BroadcastChannel": {
    description: "A BroadcastChannel is designed to send messages between tabs. In some browsers it can be used for cross-site communication and tracking.",
    write: (secret) => {
      try {
        let bc = new BroadcastChannel("secrets");
        bc.onmessage = (event) => {
          if (event.data === "request") {
            bc.postMessage(secret);
          }
        };
      } catch (e) {
        throw new Error("Unsupported");
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
  "fetch cache": {
    description: "When a resource is received via the Fetch API, it is frequently cached. That cache can potentially be abused for cross-site tracking.",
    write: async (key) => {
      let response = await fetch(testURI("resource", "fetch", key),
                                 {cache: "force-cache"});
      return key;
    },
    read: async (key) => {
      let response = await fetch(testURI("resource", "fetch", key),
                                 {cache: "force-cache"});
      let countResponse = await fetch(testURI("ctr", "fetch", key),
                                      {cache: "reload"});
      return (await countResponse.text()).trim();
    }
  },
  "XMLHttpRequest cache": {
    description: "Similar to the newer Fetch API, any resource received may be cached by the browser. The cache is potentially vulnerable to cross-site tracking attack.",
    write: async (key) => {
      const req = new XMLHttpRequest();
      const loadPromise = new Promise(resolve => req.addEventListener("load", resolve));
      req.open("GET", testURI("resource", "xhr", key));
      req.setRequestHeader("Cache-Control", "max-age=604800");
      req.send();
      await loadPromise;
      return key;
    },
    read: async (key) => {
      const req = new XMLHttpRequest();
      const loadPromise = new Promise(resolve => req.addEventListener("load", resolve));
      req.open("GET", testURI("resource", "xhr", key));
      req.setRequestHeader("Cache-Control", "max-age=604800");
      req.send();
      await loadPromise;
      let countResponse = await fetch(testURI("ctr", "xhr", key),
                                      {cache: "reload"});
      return (await countResponse.text()).trim();
    }
  },
  "iframe cache": {
    description: "An iframe is an element in a web page than allows websites to embed a second web page. Caching of this web page could be abused for cross-site tracking.",
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
        testURI("ctr", "page", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "image cache": {
    description: "Caching of images in web browsers is a standard behavior. But if that cache leaks between websites, it can be abused for cross-site tracking.",
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
        testURI("ctr", "image", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "CacheStorage": {
    description: "The Cache API is a content storage mechanism originally introduced to support ServiceWorkers. If the same Cache object is accessible to multiple websites, it can be abused to track users.",
    write: async (key) => {
      try {
        let cache = await caches.open("supercookies");
        cache.addAll([`test.css?key=${key}`]);
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      let cache = await caches.open("supercookies");
      let cacheKeys = await cache.keys();
      let url = cacheKeys[0].url;
      return (new URL(url)).searchParams.get("key");
    }
  },
  "favicon cache": {
    description: "A favicon is an icon that represents a website, typically shown in browser tab and bookmarks menu. If the favicon cache is not partitioned, it can be used to track users across websites.",
    write: (key) => key,
    read: async (key) => {
      // Wait for the favicon to load (defined in supercookies.html)
      await sleepMs(500);
      let response = await fetch(
        testURI("ctr", "favicon", key), {"cache": "reload"});
      let count = (await response.text()).trim();
      if (count === "0") {
        throw new Error("No requests received");
      }
      return count;
    }
  },
  "font cache": {
    description: "Web fonts are sometimes stored in their own cache, which is vulnerable to being abused for cross-site tracking.",
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
      await sleepMs(500);
      let response = await fetch(
        testURI("ctr", "font", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "CSS cache": {
    description: "CSS stylesheets are cached, and if that cache is shared between websites, it can be used to track users across sites.",
    write: async (key) => {
      const href = testURI("resource", "css", key);
      const head = document.getElementsByTagName("head")[0];
      head.innerHTML += `<link type="text/css" rel="stylesheet" href="${href}">`;
      const testElement = document.querySelector("#css");
      let fontFamily;
      while (true) {
        await sleepMs(100);
        fontFamily = getComputedStyle(testElement).fontFamily;
        if (fontFamily.startsWith("fake")) {
          break;
        }
      }
      console.log(fontFamily);
      return key;
    },
    read: async (key) => {
      const href = testURI("resource", "css", key);
      const head = document.getElementsByTagName("head")[0];
      head.innerHTML += `<link type="text/css" rel="stylesheet" href="${href}">`;
      const testElement = document.querySelector("#css");
      let fontFamily;
      while (true) {
        await sleepMs(100);
        fontFamily = getComputedStyle(testElement).fontFamily;
        if (fontFamily.startsWith("fake")) {
          break;
        }
      }
      console.log(fontFamily);
      return fontFamily;
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
        testURI("ctr", "video", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },*/
  "locks": {
    description: "navigator.locks (only supported in some browsers) allows scripts on multiple tabs to coordinate. If this API is not partitioned, it can be used for cross-site tracking.",
    write: async (key) => {
      if (navigator.locks) {
        navigator.locks.request(key, lock => new Promise((f,r) => {}));
        let queryResult = await navigator.locks.query();
        return queryResult.held[0].clientId;
      } else {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      if (navigator.locks) {
        let queryResult = await navigator.locks.query();
        return queryResult.held[0].name;
      }
    }
  },
/*
  "etag": {
    write: async (key) => {
      let prime = await fetch(testURI("etag", "", key));
      let response = await fetch(testURI("etag", "", key));
      return key;
    },
    read: async (key) => {
      let response = await fetch(testURI("etag", "", key));
      let receivedIfNoneMatch = response.headers.get("x-received-if-none-match");
      if (receivedIfNoneMatch === "undefined") {
        return undefined;
      } else {
        return receivedIfNoneMatch;
      }
    }
  },
*/
  "TLS Session ID": {
    description: "The TLS protocol is used by HTTPS to make connections secure. If the browser were to re-use a TLS session, then the session ID could be used to track users across websites.",
    write: async () => {
      let results = await fetch("https://tls.arthuredelstein.net:8900/");
      return (await results.json()).sessionId;
    },
    read: async () => {
      let results = await fetch("https://tls.arthuredelstein.net:8900/");
      return (await results.json()).sessionId;
    }
  },
  "prefetch cache": {
    description: "A <link rel='prefetch'...> suggests to browsers they should fetch a resource ahead of time and cache it. But if browsers don't partition this cache, it can be used to track users across websites.",
    write: async (key) => {
      let link = document.createElement("link");
      link.rel = "prefetch";
      link.href = testURI("resource", "prefetch", key);
      document.getElementsByTagName("head")[0].appendChild(link);
      return key;
    },
    read: async (key) => {
      let link = document.createElement("link");
      link.rel = "prefetch";
      link.href = testURI("resource", "prefetch", key);
      document.getElementsByTagName("head")[0].appendChild(link);
      await sleepMs(500);
      let response = await fetch(
        testURI("ctr", "prefetch", key), {"cache": "reload"});
      let countString = (await response.text()).trim();
      if (parseInt(countString) === 0) {
        throw new Error("No requests received");
      }
      return countString;
    }
  },
  "Web SQL Database": {
    description: "The Web SQL Database is a deprecated web API for storing data in an SQL database.",
    // Borrowed from https://github.com/samyk/evercookie
    write: async (key) => {
      if (!window.openDatabase) {
        throw new Error("Unsupported");
      }
      let database = window.openDatabase("sqlite_supercookie", "", "supercookie", 1024 * 1024);
      let tx = new Promise((resolve) => database.transaction(tx => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS cache(
             id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
             name TEXT NOT NULL,
             value TEXT NOT NULL,
             UNIQUE (name)
           )`,
          [], (tx, rs) => {}, (tx, err) => {});
        tx.executeSql(
          `INSERT OR REPLACE INTO cache(name, value)
           VALUES(?, ?)`,
          ["secret", key], (tx, rs) => {}, (tx, rs) => {});
      }));
    },
    read: async () => {
      let database = window.openDatabase("sqlite_supercookie", "", "supercookie", 1024 * 1024);
      let result = await new Promise((resolve, reject) => database.transaction(tx => {
        tx.executeSql(
          "SELECT value FROM cache WHERE name=?",
          ["secret"],
          (tx, rs) => resolve(rs),
          (tx, err) => reject(err));
      }));
      return result.rows.item(0).value;
    }
  },
/*  "basic_auth": {
    write: async (key) => {
      let response = await fetch(`${baseURI}/auth`, {"cache": "reload"});
    },
    read: async () => {
      let response = await fetch(`${baseURI}/auth`, {"cache": "reload"});
      return (await response.json()).password;
    }
    },*/
  "Alt-Svc": {
    description: "Alt-Svc allows the server to indicate to the web browser that a resource should be loaded on a different server. Because this is a persistent setting, it could be used to track users across websites if it is not correctly partitioned.",
    write: async () => {
      // Clear Alt-Svc caching first.
      let responseText = "";
      for (let i = 0; i < 10 && responseText !== "h2"; ++i) {
        responseText = await fetchText("https://h3.arthuredelstein.net:4433/clear");
        console.log("clear", responseText, i);
        await sleepMs(10);
      }
      if (responseText !== "h2") {
        // Clearing failed.
        throw new Error("Unsupported");
      }
      // Store "h3" state in Alt-Svc cache
      for (let i = 0; i < 10 && responseText !== "h3"; ++i) {
        responseText = await fetchText("https://h3.arthuredelstein.net:4433/protocol");
        console.log("protocol", responseText, i);
        await sleepMs(10);
      }
      if (responseText !== "h3") {
        // Storage failed.
        throw new Error("Unsupported");
      }
    },
    read: () => fetchText("https://h3.arthuredelstein.net:4433/protocol")
  },
  "H1 connection": {
    description: "HTTP/1.x are the classic web connection protocols. If these connections are re-used across websites, they can be used to track users.",
    write: async (secret) => {
      await fetch(`https://h1.arthuredelstein.net:8901/?mode=write&secret=${secret}`, {cache: "no-store"});
    },
    read: async () => {
      let response = await fetch(`https://h1.arthuredelstein.net:8901/?mode=read`, {cache: "no-store"});
      return await response.text();
    }
  },
  "H2 connection": {
    description: "HTTP/2 is a web connection protocol introduced in 2015. Some browsers re-use HTTP/2 connections across websites and can thus be used to track users.",
    write: async (secret) => {
      await fetch(`https://h2.arthuredelstein.net:8902/?mode=write&secret=${secret}`, {cache: "no-store"});
    },
    read: async () => {
      let response = await fetch(`https://h2.arthuredelstein.net:8902/?mode=read`, {cache: "no-store"});
      return await response.text();
    }
  },
  "H3 connection": {
    description: "HTTP/3 is a new standard HTTP connection protocol, still in draft but widely supported by browsers. If it is not partitioned, it can be used to track users across websites.",
    write: async (secret) => {
      // Ensure that we can switch over to h3 via alt-svc:
      for (let i = 0; i<3; ++i) {
        await fetch(`https://h3.arthuredelstein.net:4433/connection_id`, {cache: "no-store"});
        await sleepMs(500);
      }
      // Are we now connecting over h3?
      let response = await fetch(`https://h3.arthuredelstein.net:4433/connection_id`, {cache: "no-store"});
      let text = await response.text();
      // Empty response text indicates we are not connecting over h3:
      if (text.trim() === "") {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      let response = await fetch(`https://h3.arthuredelstein.net:4433/connection_id`);
      return await response.text();
    }
  },
  "Stream isolation": {
    description: "Browsers that use Tor can use a different Tor circuit per top-level website.",
    write: () => {
      if (!usingTor) {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      if (usingTor) {
        return ipAddress;
      } else {
        throw new Error("Unsupported");
      }
    }
  }
};

runAllTests(tests);

console.log("hello from supercookies_inner.js");

})();
