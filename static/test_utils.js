let runTests = async (tests, mode, params) => {
  let results = {};
  for (let test of Object.keys(tests)) {
    let result;
    if (params["only"]) {
      if (test !== params["only"]) {
        continue;
      }
    }
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
  if (navigator.serviceWorker) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        registration.unregister()
      }
    } catch (e) {
      console.log(e);
    }
  }
};

const filterObject = (obj, f) => {
  const entries = Object.entries(obj);
  return Object.fromEntries(entries.filter(f));
};

export let runAllTests = async (tests, { category }) => {
  let params = queryParams(document.URL);
  if (params["mode"] === "write") {
    await removeAllServiceWorkers();
  }
  const testsFiltered = filterObject(tests, ([k,v]) => v.category === category);
  let results = await runTests(testsFiltered, params["mode"], params);
  console.log("results:",results);
  if (window.location !== parent.location) {
    parent.postMessage(results, "*");
  }
  return results;
};
