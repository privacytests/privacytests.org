import { runAllTests } from "./test_utils.js";
import { tests } from "./test_definitions.js";

// Wrap the code for any browsers that don't support top-level await.
(async () => {

const baseURI = "https://live.privacytests2.org/";

let testURI = (path, type, key) => `${baseURI}${path}?type=${type}&key=${key}`;

await runAllTests(await tests(), { category: "navigation" });

console.log("hello from navigation_inner.js");

})();
