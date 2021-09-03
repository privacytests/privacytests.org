import { runAllTests, sleepMs } from "./test_utils.js";

let tests = {
  "sessionStorage": {
    write: (secret) => sessionStorage.setItem("secret", secret),
    read: () => sessionStorage.getItem("secret"),
  },
  "window.name": {
    write: (secret) => parent.postMessage({"write window.name": secret}),
    read: () => new Promise((resolve) => {
      parent.postMessage({"read window.name": true}, "*")
      addEventListener("message", ({data}) => {
        resolve(data);
      }, { once: true });
    })
  },
  "document.referrer": {
    write: (secret) => { /* do nothing */ },
    read: () => new Promise((resolve) => {
      parent.postMessage({"read document.referrer": true}, "*");
      addEventListener("message", ({data}) => {
        resolve(data);
      }, { once: true });
    });
  },
  "ServiceWorker": {
    write: async (key) => {
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
