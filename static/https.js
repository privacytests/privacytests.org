// # HTTPS tests

const loadSubresource = async(tagName, url) => {
  const element = document.createElement(tagName);
  document.body.appendChild(element);
  let resultPromise = new Promise((resolve, reject) => {
    element.addEventListener("load", resolve, { once: true });
    element.addEventListener("error", reject, { once: true });
  });
  element.src = url;
  try {
    return await resultPromise;
  } catch (e) {
    // some sort of loading error happened
    return e;
  }
};

const insecureSubresourceTest = async (tag, fileName) => {
  let fileTypeNames = { "img": "image", "script": "script" };
  const description = `Checks to see if the browser attempts to upgrade an insecure address for an ${fileTypeNames[tag]} to HTTPS whenever possible.`;
  let upgradableEvent = await loadSubresource(tag, `http://upgradable.privacytests2.org/content/${fileName}`);
  let insecureEvent = await loadSubresource(tag, `http://insecure.privacytests2.org/content/${fileName}`);
  let passed = insecureEvent.type === "error";
  let putativeUpgradeHandling = upgradableEvent.type === "load" ? "upgraded" : "blocked";
  let result = passed ? putativeUpgradeHandling : "loaded insecurely";
  return { passed, result, description };
};

const runTests = async () => {
  let resultsJSON = {
    "Upgradable image": await insecureSubresourceTest("img", "image.png"),
    "Upgradable script": await insecureSubresourceTest("script", "test.js"),
  };
  document.body.setAttribute("data-test-results", JSON.stringify(resultsJSON));
  console.log(resultsJSON);
  await postDataAndCarryOn(resultsJSON, "https");
};

runTests();
