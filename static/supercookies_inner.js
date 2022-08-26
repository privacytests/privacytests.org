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
  await runAllTests(await tests(), { category: "supercookies" } );

} catch (e) {
  const pre = document.createElement("pre");
  document.body.appendChild(pre);
  pre.innerHTML = e.message + "\n" + e.stack;
}


console.log("hello from supercookies_inner.js");

})();
