const description = `The HTTP Strict-Transport-Security response header allows a website to signal that it should only be accessed via HTTPS. The browser remembers this directive in a database, but if this database is not partitioned, then it can be used to track users across websites."`;

const clear_hsts = async () => {
  await fetch("https://hsts.privacytests2.org/clear_hsts2_file.html");
};

const set_hsts = async () => {
  await fetch("https://hsts.privacytests2.org/set_hsts2_file.html");
};

const test_hsts = async () => {
  // Test HSTS:
  const result = await fetch("http://hsts.privacytests2.org/test_hsts2_file.html");
  console.log(result);
  const passed = result.redirected === false;
  const readDifferentFirstParty = result.redirected ? "Upgraded to https" : "Used http";
  // Create a result object that conforms to the supercookies style
  return {
    description,
    passed,
    unsupported: false,
    testFailed: false,
    readDifferentFirstParty,
    readSameFirstParty: "not tested",
    write: "set HSTS flag",
    read: "read HSTS flag"
  }
};

console.log("hello from hsts2.js");
