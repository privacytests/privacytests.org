import { runAllTests, sleepMs, fetchText } from "./test_utils.js";

// Wrap the code for any browsers that don't support top-level await.
(async () => {

const baseURI = "https://arthuredelstein.net/browser-privacy-live/";

let testURI = (path, type, key) => `${baseURI}${path}?type=${type}&key=${key}`;

let tests = {
  "sessionStorage": {
    description: "The sessionStorage API is similar to the localStorage API, but it does not persist across tabs or across browser sessions. Nonetheless, it can be used to track users if they navigate from one website to another. This tracking can be thwarted by partitioning sessionStorage between websites.",
    write: (secret) => sessionStorage.setItem("secret", secret),
    read: () => sessionStorage.getItem("secret"),
  },
  "ServiceWorker": {
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
      let registration = await navigator.serviceWorker.register(
        'serviceWorker.js');
      console.log(registration);
      await navigator.serviceWorker.ready;
      console.log("service worker ready");
      await sleepMs(100);
      let response = await fetch("serviceworker-read");
      return await response.text();
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
  "Alt-Svc": {
    description: "Alt-Svc allows the server to indicate to the web browser that a resource should be loaded on a different server. Because this is a persistent setting, it could be used to track users across websites if it is not correctly partitioned.",
    write: async () => {
      // Clear Alt-Svc caching first.
      let responseText = "";
      await fetch("https://altsvc.arthuredelstein.net:4433/clear");
      await sleepMs(100);
      responseText = await fetchText("https://altsvc.arthuredelstein.net:4433/protocol");
      console.log("after clear:", responseText);
      // Store "h3" state in Alt-Svc cache
      await fetch("https://altsvc.arthuredelstein.net:4433/set");
      await sleepMs(100);
      responseText = await fetchText("https://altsvc.arthuredelstein.net:4433/protocol");
      console.log("after set:", responseText);
    },
    read: async () => {
      const protocol = await fetchText("https://altsvc.arthuredelstein.net:4433/protocol");
      if ((new URL(location)).searchParams.get("thirdparty") === "same") {
        if (protocol !== "h3") {
          throw new Error("Unsupported");
        }
      }
      return protocol;
    }
  },
};

await runAllTests(tests);

console.log("hello from navigation_inner.js");

})();
