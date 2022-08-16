import { runAllTests } from "./test_utils.js";
import { tests } from "./test_definitions.js";

// Wrap the code for any browsers that don't support top-level await.
(async () => {

await runAllTests(tests, { category: "supercookies" } );

console.log("hello from supercookies_inner.js");

})();
