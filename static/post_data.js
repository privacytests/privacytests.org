// postResults(results) learns the sessionId for this page load,
// and sends the results to results.privacytests.org/post under
// that sessionId.


const progressBar = (parent, fraction) => {
  const progressOuter = document.createElement("div");
  parent.prepend(progressOuter);
  const progressInner = document.createElement("div");
  progressOuter.prepend(progressInner);
    progressOuter.style = `
    width: 100%;
    height: 48px;
    background-color: lightgray;
  `;
    progressInner.style = `
    width: ${100*(fraction ?? 0)}%;
    height: 100%;
    background-color: seagreen;
  `;
  return progressOuter;
};
const urlParams = new URLSearchParams(window.location.search);
(async () => {
  let progress = urlParams.get("progress") || 0.05;
  progressBar(document.body, parseFloat(progress));
})();

const showData = (name, data) => {
  console.log(name, data);
  const dataDiv = document.createElement("div");
  dataDiv.style = "white-space: pre; font-family: monospace;";
  dataDiv.innerText = `${name}: ` + JSON.stringify(data, null, 2);
  document.body.appendChild(dataDiv);
};

const postData = async (results, category) => {
  const sessionId = urlParams.get("sessionId");
  showData("posted", {sessionId, results});
  if (!urlParams.has("sessionId")) {
    return;
  }
  console.log("posting", {sessionId, results});
  const isLocal = window.location.host.endsWith(".example");
  const postURL = isLocal ? "https://results.pto2.example/post" : "https://results.privacytests.org/post";
  const response = await fetch(postURL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({sessionId, url: window.location.href, "data": results, category })
  });
  return await response.json();
};

const postDataAndCarryOn = async (results, category) => {
  try {
    const response = await postData(results, category);
    showData("response", response);
    const urlParams = new URLSearchParams(window.location.search);
    const manual = urlParams.get("manual");
    if (manual) {
      return;
    }
    if (!response) {
      return;
    }
    const { newTabUrl, navigateUrl } = response;
    if (newTabUrl) {
      window.open(newTabUrl, "_blank");
    }
    if (navigateUrl) {
      window.location.href = navigateUrl;
    }
  } catch (e) {
    showData("error", { message: e.toString(), stack: e.stack });
  }
};

