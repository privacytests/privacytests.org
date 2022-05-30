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

const description = `The HTTP Strict-Transport-Security response header allows a website to signal that it should only be accessed via HTTPS. The browser remembers this directive in a database, but if this database is not partitioned, then it can be used to track users across websites."`;

const clear_hsts = async () => {
  await loadSubresource("img", "https://hsts.arthuredelstein.net/clear_hsts.png");
};

const set_hsts = async () => {
  await clear_hsts();
  // Test HSTS:
  let result1 = await loadSubresource("img", "http://hsts.arthuredelstein.net/test_hsts.png");
  console.log(result1.type);
  // Set HSTS:
  await loadSubresource("img", "https://hsts.arthuredelstein.net/set_hsts.png");
  // Test HSTS:
  let result2 = await loadSubresource("img", "http://hsts.arthuredelstein.net/test_hsts.png");
  console.log(result2.type);
};

const test_hsts = async () => {
  // Test HSTS:
  const event = await loadSubresource("img", "http://hsts.arthuredelstein.net/test_hsts.png");
  console.log(event.type);
  const http = (event.type === "error");
  const passed = http;
  const result = http ? "Used http" : "Upgraded to https";
  // Create a result object that conforms to the supercookies style
  return {
    description,
    passed,
    unsupported: false,
    testFailed: false,
    readDifferentFirstParty: result,
    readSameFirstParty: "not tested",
    write: "set HSTS flag",
    read: "read HSTS flag"
  }
};

console.log("hello from hsts.js");
