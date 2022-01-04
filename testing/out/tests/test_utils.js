let runTests = async (tests, mode, params) => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let result;
    console.log(`running ${test}...`);
    try {
      let input = params["sessionId"];
      console.log("input", input);
      result = await tests[test][mode](input);
    } catch (e) {
      result = "Error: " + e.message;
    }
    console.log(`  ... finished ${test} with result: ${result}.`);
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

// Remove any lingering service workers.
const removeAllServiceWorkers = async () => {
  let registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    registration.unregister()
  }
};

export let sleepMs = (timeMs) => new Promise(
  (resolve, reject) => setTimeout(resolve, timeMs)
);

export let runAllTests = async (tests) => {
  let params = queryParams(document.URL);
  if (params["mode"] === "write") {
    await removeAllServiceWorkers();
  }
  let results = await runTests(tests, params["mode"], params);
  console.log("results", results);
  if (window.location !== parent.location) {
    console.log("results:",results);
    parent.postMessage(results, "*");
  }
};
