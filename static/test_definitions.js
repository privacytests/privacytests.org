const baseURI = "https://arthuredelstein.net/browser-privacy-live/";

let testURI = (path, type, key) => `${baseURI}${path}?type=${type}&key=${key}`;

const { ipAddress, usingTor } = await (async () => {
  const response = await fetch("https://wtfismyip.com/json");
  const wtfJSON = await response.json();
  const ipAddress = wtfJSON["YourFuckingIPAddress"];
  const onionooResponse = await fetch(`https://onionoo.torproject.org/details?limit=1&search=${ipAddress}`);
  const onionooJSON = await onionooResponse.json();
  const usingTor = onionooJSON.relays.length > 0;
  return { ipAddress, usingTor };
})();

export let tests = {
  "cookie (JS)": {
    category: "supercookies",
    description: "The cookie, first introduced by Netscape in 1994, is a small amount of data stored by your browser on a website's behalf. It has legitimate uses, but it is also the classic cross-site tracking mechanism, and today still the most popular method of tracking users across websites. Browsers can stop cookies from being used for cross-site tracking by either blocking or partitioning them.",
    write: (secret) => {
      document.cookie = `secret=${secret}_js; SameSite=None; Secure`;
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
      return messagePromise;
    }
  },
  "blob": {
    category: "supercookies",
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
      await sleepMs(500);
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
      let results = await fetch("https://tls.arthuredelstein.net:8900/");
      return (await results.json()).sessionId;
    },
    read: async () => {
      let results = await fetch("https://tls.arthuredelstein.net:8900/");
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
      let response = await fetch(`${baseURI}/auth`, {"cache": "reload"});
    },
    read: async () => {
      let response = await fetch(`${baseURI}/auth`, {"cache": "reload"});
      return (await response.json()).password;
    }
  },*/
  "H1 connection": {
    category: "supercookies",
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
    category: "supercookies",
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
    category: "supercookies",
    description: "HTTP/3 is a new standard HTTP connection protocol, still in draft but widely supported by browsers. If it is not partitioned, it can be used to track users across websites.",
    write: async (secret) => {
      // Ensure that we can switch over to h3 via alt-svc:
      for (let i = 0; i<3; ++i) {
        await fetch(`https://h3.arthuredelstein.net:4434/connection_id`, {cache: "no-store"});
        await sleepMs(500);
      }
      // Are we now connecting over h3?
      let response = await fetch(`https://h3.arthuredelstein.net:4434/connection_id`, {cache: "no-store"});
      let text = await response.text();
      // Empty response text indicates we are not connecting over h3:
      if (text.trim() === "") {
        throw new Error("Unsupported");
      }
    },
    read: async () => {
      let response = await fetch(`https://h3.arthuredelstein.net:4434/connection_id`);
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
  }
};
