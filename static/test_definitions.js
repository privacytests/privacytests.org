// Wrap the code for any browsers that don't support top-level await.
export let tests = (async () => {

const IdbKeyVal = await import('https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval.mjs');

const baseURI = document.location.origin + "/live/";

const altSvcOrigin = document.location.origin.includes("privacytests3.org") ?
      "https://altsvc.privacytests3.org:4435" : "https://altsvc.privacytests2.org:4433";

let testURI = (path, type, key) => `${baseURI}${path}?type=${type}&key=${key}`;

let sleepMs = (timeMs) => new Promise(
  (resolve, reject) => setTimeout(resolve, timeMs)
);

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

return {
  "cookie (JS)": {
    category: "supercookies",
    description: "The cookie, first introduced by Netscape in 1994, is a small amount of data stored by your browser on a website's behalf. It has legitimate uses, but it is also the classic cross-site tracking mechanism, and today still the most popular method of tracking users across websites. Browsers can stop cookies from being used for cross-site tracking by either blocking or partitioning them.",
    write: (secret) => {
      document.cookie = `secret=${secret}_js; max-age=3600; SameSite=None; Secure`;
    },
    read: () => document.cookie ? document.cookie.match(/secret=([\w-]+)/)[1] : null,
    session: true,
   },
  "cookie (HTTP)": {
    category: "supercookies",
    description: "The cookie, first introduced by Netscape in 1994, is a small amount of data stored by your browser on a website's behalf. It has legitimate uses, but it is also the classic cross-site tracking mechanism, and today still the most popular method of tracking users across websites. Browsers can stop cookies from being used for cross-site tracking by either blocking or partitioning them.",
    write: async (secret) => {
      // Request a page that will send an HTTPOnly 'set-cookie' response header with secret value.
      await fetch(`${baseURI}cookie?secret=${secret}_http`);
    },
    read: async () => {
      // Test if we now send a requests with a 'cookie' header containing the secret.
      let response = await fetch(`${baseURI}headers`);
      let cookie = (await response.json())["cookie"];
      return cookie ? cookie.match(/secret=([\w-]+)/)[1]: null;
    },
    session: true,
   },
  "localStorage": {
    category: "supercookies",
    description: "The localStorage API gives websites access to a key-value database that will remain available across visits. If the localStorage API is not partitioned or blocked, it can also be used to track users across websites.",
    write: (secret) => localStorage.setItem("secret", secret),
    read: () => localStorage.getItem("secret"),
    session: true,
  },
  "indexedDB": {
    category: "supercookies",
    description: "The IndexedDB API exposes a transactional database to web pages. That database can be used to track users across websites, unless it is partitioned.",
    write: async (secret) => {
      try {
        return await IdbKeyVal.set("secret", secret);
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: () => IdbKeyVal.get("secret"),
    session: true,
  },
  "SharedWorker": {
    category: "supercookies",
    description: "The SharedWorker API allows scripts from multiple tabs to share a background thread of computation. If SharedWorker is not partitioned, then it can be abused to shared data between websites in your browser.",
    write: async (secret) => {
      try {
        let worker = new SharedWorker("supercookies_sharedworker.js");
        worker.port.start();
//        console.log("worker", worker);
        const messagePromise = new Promise((resolve) => {
          worker.port.onmessage = (e) => resolve(e.data);
        });
        worker.port.postMessage(secret);
        await messagePromise;
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      let worker = new SharedWorker("supercookies_sharedworker.js");
      worker.port.start();
      const messagePromise = new Promise((resolve, reject) => {
        worker.port.onmessage = (e) => resolve(e.data);
        setTimeout(() => reject(new Error("no SharedWorker message received")), 200);
      });
      worker.port.postMessage("request");
      const message = await messagePromise;
      if (message === "none") {
        throw new Error("Unsupported");
      }
      return message;
    }
  },
  "blob": {
    category: "supercookies",
    description: "A 'blob URL' is a local reference to some raw data. Trackers can use a blob URL to share data between websites.",
    write: (secret) => {
      try {
        let blobURL = URL.createObjectURL(new Blob([secret]));
        fetch(`${baseURI}blob?mode=write&key=${secret}&blobUrl=${encodeURIComponent(blobURL)}`);
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: async (secret) => {
      let response = await fetch(`${baseURI}blob?mode=read&key=${secret}`);
      let result = await response.json();
      let blobUrl = decodeURIComponent(result.blobUrl);
      let blobResponse = await fetch(blobUrl);
      return blobResponse.text();
    },
  },
  "BroadcastChannel": {
    category: "supercookies",
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
    category: "supercookies",
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
    },
    session: true,
  },
  "XMLHttpRequest cache": {
    category: "supercookies",
    description: "Similar to the newer Fetch API, any resource received may be cached by the browser. The cache is potentially vulnerable to cross-site tracking attack.",
    write: async (key) => {
      const req = new XMLHttpRequest();
      const loadPromise = new Promise(resolve => req.addEventListener("load", resolve));
      req.open("GET", testURI("resource", "xhr", key));
      req.send();
      await loadPromise;
      return key;
    },
    read: async (key) => {
      const req = new XMLHttpRequest();
      const loadPromise = new Promise(resolve => req.addEventListener("load", resolve));
      req.open("GET", testURI("resource", "xhr", key));
      req.send();
      await loadPromise;
      let countResponse = await fetch(testURI("ctr", "xhr", key),
                                      {cache: "reload"});
      return (await countResponse.text()).trim();
    },
    session: true,
  },
  "iframe cache": {
    category: "supercookies",
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
    },
    session: true,
  },
  "CacheStorage": {
    category: "supercookies",
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
    },
    session: true,
  },
  "favicon cache": {
    category: "supercookies",
    description: "A favicon is an icon that represents a website, typically shown in browser tab and bookmarks menu. If the favicon cache is not partitioned, it can be used to track users across websites.",
    write: (key) => key,
    read: async (key) => {
      // Wait for the favicon to load (defined in supercookies.html)
      await sleepMs(2000);
      let response = await fetch(
        testURI("ctr", "favicon", key), {"cache": "reload"});
      let count = (await response.text()).trim();
      if (count === "0") {
        throw new Error("No requests received");
      }
      return count;
    },
    session: true,
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
    category: "supercookies",
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
    category: "supercookies",
    description: "The TLS protocol is used by HTTPS to make connections secure. If the browser were to re-use a TLS session, then the session ID could be used to track users across websites.",
    write: async () => {
      let results = await fetch("https://tls.privacytests2.org:8900/");
      return (await results.json()).sessionId;
    },
    read: async () => {
      let results = await fetch("https://tls.privacytests2.org:8900/");
      return (await results.json()).sessionId;
    }
  },
  "Web SQL Database": {
    category: "supercookies",
    description: "The Web SQL Database is a deprecated web API for storing data in an SQL database.",
    // Borrowed from https://github.com/samyk/evercookie
    write: async (key) => {
      if (!window.openDatabase) {
        throw new Error("gported");
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
    },
    session: true,
  },
/*  "basic_auth": {
    write: async (key) => {
      let response = await fetch(`${baseURI}auth`, {"cache": "reload"});
    },
    read: async () => {
      let response = await fetch(`${baseURI}auth`, {"cache": "reload"});
      return (await response.json()).password;
    }
  },*/
  "H1 connection": {
    category: "supercookies",
    description: "HTTP/1.x are the classic web connection protocols. If these connections are re-used across websites, they can be used to track users.",
    write: async (secret) => {
      await fetch(`https://h1.privacytests2.org:8901/?mode=write&secret=${secret}`, {cache: "no-store"});
    },
    read: async () => {
      let response = await fetch(`https://h1.privacytests2.org:8901/?mode=read`, {cache: "no-store"});
      return await response.text();
    }
  },
  "H2 connection": {
    category: "supercookies",
    description: "HTTP/2 is a web connection protocol introduced in 2015. Some browsers re-use HTTP/2 connections across websites and can thus be used to track users.",
    write: async (secret) => {
      await fetch(`https://h2.privacytests2.org:8902/?mode=write&secret=${secret}`, {cache: "no-store"});
    },
    read: async () => {
      let response = await fetch(`https://h2.privacytests2.org:8902/?mode=read`, {cache: "no-store"});
      return await response.text();
    }
  },
  "H3 connection": {
    category: "supercookies",
    description: "HTTP/3 is a new standard HTTP connection protocol, still in draft but widely supported by browsers. If it is not partitioned, it can be used to track users across websites.",
    write: async (secret) => {
      // Ensure that we can switch over to h3 via alt-svc:
      for (let i = 0; i<3; ++i) {
        await fetch(`https://h3.privacytests2.org:4434/connection_id`, {cache: "no-store"});
        await sleepMs(500);
      }
      // Are we now connecting over h3?
      let response = await fetch(`https://h3.privacytests2.org:4434/connection_id`, {cache: "no-store"});
      let text = await response.text();
      // Empty response text indicates we are not connecting over h3:
      if (text.trim() === "") {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      let response = await fetch(`https://h3.privacytests2.org:4434/connection_id`);
      return await response.text();
    }
  },
  "Stream isolation": {
    category: "supercookies",
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
  },
  'CookieStore': {
    // Test originally written by Steven Englehardt
    category: "supercookies",
    description: "The Cookie Store API is an alternative asynchronous API for managing cookies, supported by some browsers.",
    write: (data) => {
      const msPerHour = 60 * 60 * 1000;
      if (!window.cookieStore) {
        throw new Error("Unsupported");
      }
      window.cookieStore.set({
        name: "partition_test",
        value: data,
        expires: Date.now() + msPerHour,
        sameSite: "none"
      });
    },
    read: async () => {
      if (!window.cookieStore) {
        throw new Error("Unsupported");
      }
      const cookie = await window.cookieStore.get("partition_test");
      if (!cookie) {
        return null;
      }
      return cookie.value;
    },
    session: true,
  },
  "getDirectory": {
    category: "supercookies",
    description: "navigator.storage.getDirectory exposes a location for storing files to web content. In some cases, these files may be shared across tabs.",
    write: async (secret) => {
      try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("secret.txt", { create: true });
        const stream = await fileHandle.createWritable();
        await stream.write(secret);
        await stream.close();
      } catch (e) {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("secret.txt");
        const file = await fileHandle.getFile();
        return file.text();
      } catch (e) {
        throw new Error("Unsupported");
      }
    }
  },
  "sessionStorage": {
    category: "navigation",
    description: "The sessionStorage API is similar to the localStorage API, but it does not persist across tabs or across browser sessions. Nonetheless, it can be used to track users if they navigate from one website to another. This tracking can be thwarted by partitioning sessionStorage between websites.",
    write: (secret) => sessionStorage.setItem("secret", secret),
    read: () => sessionStorage.getItem("secret"),
  },
  "ServiceWorker": {
    category: "navigation",
    description: "The ServiceWorker API allows websites to run code in the background and store content in the browser for offline use. If a ServiceWorker can be accessed from multiple websites, it can be abused to track users across sites.",
    write: async (key) => {
      if (!navigator.serviceWorker) {
        throw new Error("Unsupported");
      }
      let registration = await navigator.serviceWorker.register(
        'serviceWorker.js');
      console.log(registration);
      await navigator.serviceWorker.ready;
      console.log("service worker ready");
      await sleepMs(100);
      await fetch(`serviceworker-write?secret=${key}`);
    },
    read: async () => {
      console.log("trying to register the serviceworker now...");
      const registration = await Promise.race([
        navigator.serviceWorker.register('serviceWorker.js'),
        sleepMs(500)
      ]);
      if (registration === undefined) {
        // We timed out or otherwise failed.
        throw new Error("ServiceWorker registration failed");
      }
      console.log(registration);
      await navigator.serviceWorker.ready;
      console.log("service worker ready");
      await sleepMs(100);
      let response = await fetch("serviceworker-read");
      return await response.text();
    }
  },
  "CSS cache": {
    session: true,
    category: "navigation",
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
  "image cache": {
    session: true,
    category: "navigation",
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
  "font cache": {
    session: true,
    category: "navigation",
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
      const text = document.createElement("span");
      text.id = "text";
      text.innerText = "test";
      document.body.appendChild(text);
      const originalWidth = text.getBoundingClientRect().width;
      let style = document.createElement("style");
      style.type='text/css';
      let fontURI = testURI("resource", "font", key);
      style.innerHTML = `@font-face {font-family: "myFont"; src: url("${fontURI}"); } #text { font-family: "myFont" }`;
      document.getElementsByTagName("head")[0].appendChild(style);
      let newWidth;
      do {
        await sleepMs(100);
        newWidth = text.getBoundingClientRect().width;
      } while (newWidth < 0 || newWidth === originalWidth)
      let response = await fetch(
        testURI("ctr", "font", key), {"cache": "reload"});
      return (await response.text()).trim();
    }
  },
  "prefetch cache": {
    session: true,
    category: "navigation",
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
  "Alt-Svc": {
    session: true,
    category: "navigation",
    description: "Alt-Svc allows the server to indicate to the web browser that a resource should be loaded on a different server. Because this is a persistent setting, it could be used to track users across websites if it is not correctly partitioned.",
    write: async () => {
      // Clear Alt-Svc caching first.
      let responseText = "";
      for (let i = 0; i < 3; ++i) {
        await fetch(altSvcOrigin + "/clear");
        await sleepMs(100);
      }
      responseText = await fetchText(altSvcOrigin + "/protocol");
      console.log("after clear:", responseText);
      // Store "h3" state in Alt-Svc cache
      for (let i = 0; i < 3; ++i) {
        await fetch(altSvcOrigin + "/set");
        await sleepMs(100);
      }
      responseText = await fetchText(altSvcOrigin + "/protocol");
      console.log("after set:", responseText);
    },
    read: async () => {
      const protocol = await fetchText(altSvcOrigin + "/protocol");
      if ((new URL(location)).searchParams.get("thirdparty") === "same") {
        if (protocol !== "h3") {
          throw new Error("Unsupported");
        }
      }
      return protocol;
    }
  },
  "window.name": {
    category: "navigation_toplevel",
    description: "The window.name API allows websites to store data that will persist after the user has navigated the tab to a different website. This mechanism could be partitioned so that data is not allowed to persist between websites.",
    write: (secret) => window.name = "name_" + secret,
    read: () => window.name
  },
  "document.referrer": {
    category: "navigation_toplevel",
    description: "The Referer [sic] request header is a mechanism used by browsers to let a website know where the user is visiting from. This header is inherently tracking users across websites. In recent times, browsers have switched to a policy of trimming a referrer to convey less tracking information, but Referer continues to convey cross-site tracking data by default.",
    write: (secret) => { /* do nothing */ },
    read: () => document.referrer
  },
};

});

