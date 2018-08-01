const { existsSync, promises : fs } = require('fs');
const fileUrl = require('file-url');

let htmlPage = ({ title, content, style }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf8'/>
    <title>${title}</title>
    <style>${style}</style>
  </head>
  <body>
    ${content}
  </body>
</html>
`;

let htmlTable = ({ headers, body, className }) => {
  elements = [];
  elements.push(`<table class="${className}">`);
  elements.push("<tr>");
  for (let header of headers) {
    elements.push(`<th>${header}</th>`);
  }
  elements.push("</tr>");
  for (let row of body) {
    elements.push("<tr>");
    for (let item of row) {
      elements.push(`<td>${item}</td>`);
    }
    elements.push("</tr>");
  }
  elements.push("</table>");
  return elements.join("");
};

const pageStyle = `
.title {
  font-weight: bold;
}
table.comparison-table {
  border-collapse:collapse;
}
table.comparison-table tr th {
  text-align: center;
  font-size: 12px;
  padding: 4px;
}
table.comparison-table tr:nth-child(2n) td {
  background-color: #eee;
}
table.comparison-table tr td {
  text-align: center;
}
table.comparison-table tr th:first-child {
  font-size: 16px;
}
table.comparison-table tr td span {
  font-size: 16px;
}
table.comparison-table tr td span.good {
  color: green;
}
table.comparison-table tr td span.bad {
  color: red;
}
table.comparison-table tr :first-child {
  text-align: start;
  padding-left: 3px;
}
`;

let capabilitiesToDescription = ({ os, os_version, browser, browser_version, device }) =>
  browser_version ?
    `${browser} ${browser_version}, ${os} ${os_version}` :
    (os ? `${os} ${os_version}, ${device}` : `${browser}`);

let resultItemToName = ({expression, worker}) =>
    `${expression} ${worker ? " [Worker]" : ""}`;

let fingerprintingMap = ({rowNames, fingerprintingResult}) => {
  let result = {};
  for (let item of fingerprintingResult) {
    result[resultItemToName(item)] = item;
  }
  return result;
};

let bodyItem = ({passed, tooltip}) =>
`<span class='${passed ? "good" : "bad"}'
title = '${ tooltip }'>
  ${passed ? "&#x2714;" : "&#x00D7;"}
</span>`;

let fingerprintingTooltip = fingerprintingItem => {
  let { expression, spoof_expression, actual_value,
        desired_value, passed, worker } = fingerprintingItem;
  return `
expression: ${ expression }
spoof expression: ${ spoof_expression }
actual value: ${ actual_value }
desired value: ${ desired_value }
passed: ${ passed }
${ worker ? "[Worker]" : "" }
  `.trim();
};

let fingerprintingResultsToTable = (results) => {
  let bestResults = results.filter(m => m["testResults"]["fingerprinting"]);
  let headers = bestResults
      .map(m => m["capabilities"])
      .map(capabilitiesToDescription);
  headers.unshift("Fingerprinting tests");
  let rowNames = bestResults[0]["testResults"]["fingerprinting"]
      .map(resultItemToName);
  let fingerprintingMaps = bestResults
      .map(m => m["testResults"]["fingerprinting"])
      .map(fingerprintingResult => fingerprintingMap({rowNames,
                                                      fingerprintingResult}));
  let body = [];
  for (let rowName of rowNames) {
    let row = [];
    row.push(rowName);
    for (let fingerprintingMap of fingerprintingMaps) {
      let tooltip = fingerprintingTooltip(fingerprintingMap(rowName));
      row.push(bodyItem({ passed, tooltip }));
    }
    body.push(row);
  };
  return { headers, body };
};

let content = (results) => {
  let { headers, body } = fingerprintingResultsToTable(results);
  return `<h1 class="title">browserprivacy.net</h1>` +
  //  `<pre>${headers}</pre>` +
    htmlTable({headers, body,
               className:"comparison-table"});
};

let readResults = async (file) =>
    JSON.parse(await fs.readFile(file));

let latestFile = async (path) => {
  let stem = (await fs.readdir(path)).sort().pop();
  return path + "/" + stem;
};

let main = async () => {
  if (!(existsSync("./out"))) {
    await fs.mkdir("./out");
  }
  let resultsFile = await latestFile("../selenium/results/");
  let results = await readResults(resultsFile);
  console.log(results);
  await fs.writeFile("./out/index.html", htmlPage({
    title: "Browser Privacy Project",
    content: content(results),
    style: pageStyle
  }));
  console.log(`Wrote out ${fileUrl("./out/index.html")}`);
};

main();
