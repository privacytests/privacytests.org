import { runAllTests, sleepMs } from "./test_utils.js";

let tests = {
  "sessionStorage": {
    description: "The sessionStorage API is similar to the localStorage API, but it does not persist across tabs or across browser sessions. Nonetheless, it can be used to track users if they navigate from one website to another. This tracking can be thwarted by partitioning sessionStorage between websites.",
    write: (secret) => sessionStorage.setItem("secret", secret),
    read: () => sessionStorage.getItem("secret"),
  },
  "window.name": {
    description: "The window.name API allows websites to store data that will persist after the user has navigated the tab to a different website. This mechanism could be partitioned so that data is not allowed to persist between websites.",
    write: (secret) => parent.postMessage({"write window.name": secret}),
    read: () => new Promise((resolve) => {
      parent.postMessage({"read window.name": true}, "*");
      addEventListener("message", ({data}) => {
        resolve(data);
      }, { once: true });
    })
  },
  "document.referrer": {
    description: "The Referer [sic] request header is a mechanism used by browsers to let a website know where the user is visiting from. This header is inherently tracking users across websites. In recent times, browsers have switched to a policy of trimming a referrer to convey less tracking information, but Referer continues to convey cross-site tracking data by default.",
    write: (secret) => { /* do nothing */ },
    read: () => new Promise((resolve) => {
      parent.postMessage({"read document.referrer": true}, "*");
      addEventListener("message", ({data}) => {
        resolve(data);
      }, { once: true });
    })
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
  }
};

runAllTests(tests);

console.log("hello from navigation_inner.js");
