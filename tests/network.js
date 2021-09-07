/*jshint: esnext true */


const fetchJSON = async (...fetchArgs) => {
  let response = await fetch(...fetchArgs);
  return response.json();
};

const testTor = async () => {
  let wtfJSON = await fetchJSON("https://wtfismyip.com/json");
  console.log(wtfJSON);
  let onionooJSON = await fetchJSON(`https://onionoo.torproject.org/details?limit=1&search=${wtfJSON["YourFuckingIPAddress"]}`);
  console.log(onionooJSON);
  let resultJSON = {};
  resultJSON["IsTorExit"] = (onionooJSON.relays.length > 0);
  resultJSON["passed"] = resultJSON["IsTorExit"];
  return resultJSON;
};

const testDoH = async () => {
  let cloudflareDoH;
  try {
    let cloudflareDoHResponse = await fetchJSON("https://is-doh.help.every1dns.net/resolvertest");
    cloudflareDoH = cloudflareDoHResponse === 1;
  } catch (e) {
    console.log(e);
    cloudflareDoH = false;
  }
  let nextDoH;
  try {
    // TODO: Get this working correctly.
    let nextDoHResponse = await fetchJSON("https://test.nextdns.io/");
    nextDoH = nextDoHResponse["status"] === "unconfigured";
  } catch (e) {
    nextDoH = false;
  }
  let passed = cloudflareDoH || nextDoH;
  return { cloudflareDoH, nextDoH, passed };
};

const testGPC = async () => {
  // Ask the server what headers it sees.
  const requestHeaders = await fetchJSON("https://arthuredelstein.net/browser-privacy-live/headers");
  const passed = requestHeaders["sec-gpc"] === "1";
  return { "sec-gpc": requestHeaders["sec-gpc"], passed };
};

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
  let upgradableEvent = await loadSubresource(tag, `http://upgradable.arthuredelstein.net/${fileName}`);
  let insecureEvent = await loadSubresource(tag, `http://insecure.arthuredelstein.net/${fileName}`);
  let passed = insecureEvent.type === "error";
  let putativeUpgradeHandling = upgradableEvent.type === "load" ? "upgraded" : "blocked";
  let handling = passed ? putativeUpgradeHandling : "loaded insecurely";
  return { passed, handling };
};

let runTests = async () => {
  let resultsJSON = {
    "Tor enabled": await testTor(),
    "DoH enabled": await testDoH(),
    "GPC enabled": await testGPC(),
    "Insecure passive subresource": await insecureSubresourceTest("img", "image.png"),
    "Insecure active subresource": await insecureSubresourceTest("script", "test.js")
  };
  console.log(resultsJSON);
  document.body.setAttribute("data-test-results", JSON.stringify(resultsJSON));
};

runTests();
