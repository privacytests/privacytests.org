(async () => {

const sleepMs = (timeMs) => new Promise(
  (resolve, reject) => setTimeout(resolve, timeMs)
);

const show = (msg) => {
  const pre = document.createElement("pre");
  document.body.appendChild(pre);
  pre.innerHTML = msg;
};

const testURI = (path, type, key) => `https://test-pages.privacytests2.org/live/${path}?type=${type}&key=${key}`;

const itemsToTest = [
  'fetch cache',
  'iframe cache',
  'XMLHttpRequest cache',
  'CSS cache',
  'font cache',
  'image cache',
  'favicon cache',
  'script cache',
  'prefetch cache',
];

const selectTests = (tests, testNames) => {
  const filteredTests = {};
  for (const [testName, testDef] of Object.entries(tests)) {
    if (testNames.includes(testName)) {
      filteredTests[testName] = testDef;
    }
  }
  return filteredTests;
};

try {
  const { runAllTests, queryParams } = await import("./test_utils.js");
  const { tests } = await import("./test_definitions.js");
  const sessionId = queryParams(document.location.href)['sessionId'];
  const allTests = await tests();
  const filteredTests = selectTests(allTests, itemsToTest);
  await runAllTests(filteredTests, { sessionId, mode: "write" } );
  const uri = await testURI("ips", "", sessionId);
  await sleepMs(10000);
  const results = await fetch(uri);
  const jsonResults = await results.json();
  const h1 = await (await fetch("https://h1.privacytests2.org:8901/?mode=ip")).text()
  jsonResults["h1"] = h1;
  const h2 = await (await fetch("https://h2.privacytests2.org:8902/?mode=ip")).text()
  jsonResults["h2"] = h2;
  show(JSON.stringify(jsonResults, null, " "));
  console.log(jsonResults);
} catch (e) {
  const pre = document.createElement("pre");
  document.body.appendChild(pre);
  pre.innerHTML = e.message + "\n" + e.stack;
}


console.log("hello from stream-isolation.js");

})();

