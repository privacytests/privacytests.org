let runTests = async (tests, mode, params) => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let result;
    try {
      let input = params[test] || params["default"];
      console.log("input", input);
      result = await tests[test][mode](input);
    } catch (e) {
      result = "Error: " + e.message;
    }
    results[test] = {
      write: tests[test].write.toString(),
      read: tests[test].read.toString(),
      result,
    };
  }
  return results;
};

let queryParams = (urlString) => {
  let searchParams = new URL(urlString).searchParams;
  return Object.fromEntries(searchParams.entries());
};

let runAllTests = (tests) => {
  let params = queryParams(document.URL);
  let results = await runTests(tests, params["mode"], params);
  console.log("results", results);
  if (window.location !== parent.location) {
    parent.postMessage(results, "*");
  }
};

export runAllTests;
