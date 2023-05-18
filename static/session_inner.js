// Wrap the code for any browsers that don't support top-level await.

(async () => {

const show = (msg) => {
  const pre = document.createElement("pre");
  document.body.appendChild(pre);
  pre.innerHTML = msg;
};

try {
  const { runAllTests } = await import("./test_utils.js");
  const { tests } = await import("./test_definitions.js");
  const testList = Object.entries(await tests());
  console.log({testList});
  const sessionTests = Object.fromEntries(testList.filter(
    ([name, data]) => (data.category === "supercookies" || data.category === "navigation") && data.session === true));
  console.log({sessionTests});
  await runAllTests(sessionTests);

} catch (e) {
  const pre = document.createElement("pre");
  document.body.appendChild(pre);
  pre.innerHTML = e.message + "\n" + e.stack;
}

console.log("hello from session_inner.js");

})();
