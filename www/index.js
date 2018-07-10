const mkdirp = require('mkdirp');
const { promises : fs } = require('fs');

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
table.comparison-table tr td span {
  font-size: 16px;
}
table.comparison-table tr td span.good {
  color: green;
}
table.comparison-table tr td span.bad {
  color: red;
}
table.comparison-table tr td:first-child {
  text-align: start;
}
`;

let readResults = async () =>
    JSON.parse(await fs.readFile(
      "../selenium/results/results_20180709_065329.json"));

let capabilitiesToDescription = ({ os, os_version, browser, browser_version, device }) =>
  browser_version ?
    `${browser} ${browser_version}, ${os} ${os_version}` :
    `${os} ${os_version}, ${device}`;

let resultItemToName = ({expression, worker}) =>
    `${expression} ${worker ? " [Worker]" : ""}`;

let fingerprintingMap = ({rowNames, fingerprintingResult}) => {
  let result = {};
  for (let item of fingerprintingResult) {
    result[resultItemToName(item)] = item;
  }
  return result;
};

let resultsToTable = (results) => {
  let bestResults = results.filter(m => m["fingerprintingResults"]);
  let headers = bestResults
      .map(m => m["capabilities"])
      .map(capabilitiesToDescription);
  headers.unshift("");
  let rowNames = bestResults[0]["fingerprintingResults"]
      .map(resultItemToName);
  let fingerprintingMaps = bestResults
      .map(m => m["fingerprintingResults"])
      .map(fingerprintingResult => fingerprintingMap({rowNames,
                                                      fingerprintingResult}));
  let body = [];
  for (let rowName of rowNames) {
    let row = [];
    row.push(rowName);
    for (let fingerprintingMap of fingerprintingMaps) {
      let { expression, spoof_expression, actual_value, desired_value, passed, worker } =
          fingerprintingMap[rowName];
      let tooltip = `
expression: ${ expression }
spoof expression: ${ spoof_expression }
actual value: ${ actual_value }
desired value: ${ desired_value }
passed: ${ passed }
${ worker ? "[Worker]" : "" }
`.trim();
      row.push(`<span class='${passed ? "good" : "bad"}'
               title = '${ tooltip }'>
               ${passed ? "&#x2714;" : "&#x00D7;"}
               </span>`);
    }
    body.push(row);
  };
  return { headers, body };
};

let content = async () => {
  let results = await readResults();
  let { headers, body } = resultsToTable(results);
  return `<h2>Browser Fingerprinting Comparison</h2>` +
  //  `<pre>${headers}</pre>` +
    htmlTable({headers, body,
               className:"comparison-table"});
};

let main = async () => {
  mkdirp("./out/");
  await fs.writeFile("./out/index.html", htmlPage({
    title: "Browser Fingerprinting Comparison",
    content: await content(),
    style: pageStyle
  }));
};

main();
