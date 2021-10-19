// postResults(results) learns the sessionId for this page load,
// and sends the results to results.privacytests.org/post under
// that sessionId.
const postData = async (results) => {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has("sessionId")) {
    return;
  }
  const sessionId = urlParams.get("sessionId");
  console.log("posting", {sessionId, results});
  let response = await fetch("https://results.privacytests.org/post", {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({sessionId, "data": results})
  });
};
