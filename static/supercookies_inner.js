import { runAllTests, sleepMs, fetchText } from "./test_utils.js";
import { tests } from "./test_definitions.js";

import * as IdbKeyVal from 'https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval.mjs';

// Wrap the code for any browsers that don't support top-level await.
(async () => {

await runAllTests(tests);

console.log("hello from supercookies_inner.js");

})();
