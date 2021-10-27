// # Miscellaneous tests

const fetchJSON = async (...fetchArgs) => {
  let response = await fetch(...fetchArgs);
  return response.json();
};

const testTorAndIp = async () => {
  const description = ;
  let wtfJSON = await fetchJSON("https://wtfismyip.com/json");
  const ipAddress = wtfJSON["YourFuckingIPAddress"];
  console.log(wtfJSON);
  let onionooJSON = await fetchJSON(`https://onionoo.torproject.org/details?limit=1&search=${ipAddress}}`);
  console.log(onionooJSON);
  let IsTorExit = (onionooJSON.relays.length > 0);
  return {
    "Tor enabled" : {
      IsTorExit,
      passed: IsTorExit,
      description: "The Tor network sends the browser's web requests through a series of relays to hide a user's IP address, thereby helping to mask their identity and location. This test checks to see if the Tor network is being used by default."
    },
    "IP address leak" : {
      ipAddress,
      description: "IP addresses can be used to uniquely identify a large percentage of users. A proxy, VPN, or Tor can mask a user's IP address."
    }};
};

const testDoH = async () => {
  const description = "Checks if DNS over HTTPS is enabled by default.";
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
  } catch (e) {
    nextDoH = false;
  }
  let passed = cloudflareDoH || nextDoH;
  return { cloudflareDoH, nextDoH, passed, description };
};

const testGPC = async () => {
  // Ask the server what headers it sees.
  const description = "The Global Privacy Control is a referrer header that can be sent by a browser to instruct a website not to sell the user's personal data to third parties. This test checks to see if the GPC header is sent by default.";
  const requestHeaders = await fetchJSON("https://arthuredelstein.net/browser-privacy-live/headers");
  const passed = requestHeaders["sec-gpc"] === "1";
  return { "GPC enabled": { "sec-gpc": requestHeaders["sec-gpc"], passed, description }};
};

const runTests = async () => {
  let resultsJSON = Object.assign({}, await testTorAndIp(), await testGPC());
  document.body.setAttribute("data-test-results", JSON.stringify(resultsJSON));
  await postData(resultsJSON);
};

runTests();
