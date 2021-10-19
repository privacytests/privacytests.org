// # Miscellaneous tests

const runTests = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("sessionId");
  const paramsFound = urlParams.keys();
  let results = {};
  for (const param of paramsFound) {
    results[param] = urlParams.get(param);
  }
  await postData(results);
};

runTests();
