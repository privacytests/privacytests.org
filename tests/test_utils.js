let runTests = async (tests, mode, params) => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let result;
    try {
      let input = decodeURIComponent(params[test] || params["default"]);
      console.log("input", input);
      result = await tests[test][mode](input);
    } catch (e) {
      result = "Error: " + e.message;
    }
    results[test] = {
      write: tests[test].write.toString(),
      read: tests[test].read.toString(),
      description: tests[test].description,
      result,
    };
  }
  return results;
};

let queryParams = (urlString) => {
  let searchParams = new URL(urlString).searchParams;
  return Object.fromEntries(searchParams.entries());
};

export let sleepMs = (timeMs) => new Promise(
  (resolve, reject) => setTimeout(resolve, timeMs)
);

export let runAllTests = async (tests) => {
  let params = queryParams(document.URL);
  let results = await runTests(tests, params["mode"], params);
  console.log("results", results);
  if (window.location !== parent.location) {
    console.log("results:",results);
    parent.postMessage(results, "*");
  }
};
