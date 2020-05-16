import { runAllTests } from "./test_utils.js";

let tests = {
  "sessionStorage": {
    write: (secret) => sessionStorage.setItem("secret", secret),
    read: () => sessionStorage.getItem("secret"),
  },
  "window.name": {
    write: (secret) => parent.postMessage({"write window.name": secret}),
    read: () => {
      parent.postMessage({"read window.name": true})
      addEventListener("message", {data} => {
        return data;
      }, { once: true });
    }
  },
};

runAllTests(tests);

console.log("hello from navigation_inner.js");
