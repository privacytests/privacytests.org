// # Miscellaneous tests

const fetchJSON = async (...fetchArgs) => {
  let response = await fetch(...fetchArgs);
  return response.json();
};

const fetchText = async(...fetchArgs) => {
  const response = await fetch(...fetchArgs);
  return response.text();
};

const testTor = async () => {
  let wtfJSON = await fetchJSON("https://wtfismyip.com/json");
  const ipAddress = wtfJSON["YourFuckingIPAddress"];
  console.log(wtfJSON);
  let torList = await fetchText('https://test-pages.privacytests2.org/live/torbulkexitlist');
  let IsTorExit = torList.includes(ipAddress);
  return {
    "Tor enabled" : {
      IsTorExit,
      passed: IsTorExit,
      description: "The Tor network sends the browser's web requests through a series of relays to hide a user's IP address, thereby helping to mask their identity and location. This test checks to see if the Tor network is being used by default."
    }
  };
};

const testECH = async () => {
  const response = await fetch(
    "https://encryptedsni.com/cdn-cgi/trace",
    { mode: 'cors', cache: 'reload' });
  const rawText = await response.text();
  const json = Object.fromEntries(rawText.split('\n').map(line => line.split('=')));
  const SNI_status = json['sni']
  return {
    "ECH enabled": {
      SNI_status,
      passed: SNI_status === 'encrypted',
      description: "Encrypted Client Hello (ECH) is a new protocol that hides the website you are visiting from third-party network eavesdroppers."
    }
  };
};

const testGPC = async () => {
  // Ask the server what headers it sees.
  const description = "The Global Privacy Control is an HTTP header that can be sent by a browser to instruct a visited website not to sell the user's personal data to other parties. This test checks to see if the GPC header is sent to third-party elements on the web page.";
  const requestHeaders = await fetchJSON("https://test-pages.privacytests2.org/live/headers");
  const passed = requestHeaders["sec-gpc"] === "1";
  return { "GPC enabled third-party": { "sec-gpc": requestHeaders["sec-gpc"], passed, description }};
};

const runTests = async () => {
  let resultsJSON = Object.assign({}, await testTor(), await testGPC(), await testECH());
  document.body.setAttribute("data-test-results", JSON.stringify(resultsJSON));
  await postDataAndCarryOn(resultsJSON, "misc");
};

runTests();
