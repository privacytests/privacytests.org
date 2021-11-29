// postResults(results) learns the sessionId for this page load,
// and sends the results to results.privacytests.org/post under
// that sessionId.
const postData = async (results, type) => {
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
    body: JSON.stringify({sessionId, url: window.location.href, "data": results, type})
  });
  return await response.json();
};

const postDataAndCarryOn = async (results, type) => {
  const { newTabUrl, navigateUrl } = await postData(results, type);
  if (newTabUrl) {
    window.open(newTabUrl, "_blank");
  }
  if (navigateUrl) {
    window.location.href = navigateUrl;
  }
};
