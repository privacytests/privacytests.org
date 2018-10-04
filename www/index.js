const { existsSync, promises : fs, constants : fsConstants } = require('fs');
const path = require('path');
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
      if (item.subheading) {
        elements.push(`<th>${item.subheading}</th>`);
      } else {
        elements.push(`<td>${item}</td>`);
      }
    }
    elements.push("</tr>");
  }
  elements.push("</table>");
  return elements.join("");
};

const pageStyle = `
.title {
  font-weight: bold;
  margin: 0px -1px;
  text-align: start;
  padding-left: 8px;
}
table.comparison-table {
  border-collapse:collapse;
}
table.comparison-table tr:first-child th:first-child {
  z-index: 1;
}
table.comparison-table tr:first-child th {
  background-color: white;
  text-align: center;
  top: 0px;
  font-size: 12px;
  padding: 15px 0px 2px 0px;
  position: sticky;
  position: -webkit-sticky;
}
table.comparison-table tr:nth-child(2n+1) td {
  background-color: #eee;
}
table.comparison-table tr:nth-child(2n) td {
  background-color: white;
}
table.comparison-table tr td {
  min-width: 100px;
  padding: 4px 0px;
  text-align: center;
}
table.comparison-table tr th:first-child {
  font-size: 16px;
}
table.comparison-table tr td div {
  font-size: 16px;
  background-repeat: no-repeat;
  background-size: 12px;
  background-position: center;
  background-clip: border-box;
}
table.comparison-table tr td div.good {
  background-image: url('check-mark.png');
}
table.comparison-table tr td div.bad {
  background-image: url('x-mark.png');
  background-size: 10px;
}
table.comparison-table tr td:first-child,th:first-child {
  text-align: start;
  left: 0px;
  padding-left: 8px;
  position: sticky;
  position: -webkit-sticky;
}
`;

let resultsToDescription = ({browser,
                             capabilities: { os, os_version, browser: browser2,
                                             browser_version, device }}) => {
  let browserFinal = browser || browser2;
    return browser_version ?
      `${browserFinal} ${browser_version},<br>${os} ${os_version}` :
      (os ? `${os} ${os_version},<br>${device}` : `${browserFinal}`);
};

let bodyItem = ({passed, tooltip}) =>
`<div class='${passed ? "good" : "bad"}'
title = '${ tooltip }'> &nbsp;
</div>`;

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

let torTooltip = torItem => {
  let { IPAddress, TorExit, passed } = torItem;
  return `
IPAddress: ${ IPAddress }
TorExit: ${ TorExit }
passed: ${ passed }
`.trim();
};

let supercookieTooltip = ({ write, read, passed }) => {
  return `
write: ${ write }
read: ${ read }
passed: ${ passed }
`.trim();
};

let resultsSection = ({results, category, tooltipFunction}) => {
  let bestResults = results.filter(m => m["testResults"][category]);
  let rowNames = Object.keys(bestResults[0]["testResults"][category])
      .sort();
  let resultMaps = bestResults
      .map(m => m["testResults"][category]);
  let section = [];
  for (let rowName of rowNames) {
    let row = [];
    row.push(rowName);
    for (let resultMap of resultMaps) {
      let tooltip = tooltipFunction(resultMap[rowName]);
      let passed = resultMap[rowName].passed;
      row.push(bodyItem({ passed, tooltip }));
    }
    section.push(row);
  };
  return section;
};

let resultsToTable = (results, title) => {
  let filteredResults = results
      .filter(m => m["testResults"])
      .filter(m => m["testResults"]["fingerprinting"]);
  console.log(filteredResults[0]);
  let headers = filteredResults.map(resultsToDescription);
  headers.unshift(`<h1 class="title">${title}</h1>`);
  let body = [];
  body.push([{subheading:"Tor tests"}]);
  body = body.concat(resultsSection({results: filteredResults, category:"tor", tooltipFunction: torTooltip}));
  body.push([{subheading:"Supercookie tests"}]);
  body = body.concat(resultsSection({results: filteredResults, category:"supercookies", tooltipFunction: supercookieTooltip}));
  body.push([{subheading:"Fingerprinting tests"}]);
  body = body.concat(resultsSection({results: filteredResults, category:"fingerprinting", tooltipFunction: fingerprintingTooltip} ));
  return { headers, body };
};

let content = (results, jsonFilename) => {
  let { headers, body } = resultsToTable(results.all_tests, "Browser Privacy Tests");
  return '' + // `<h1 class="title">Browser Privacy Tests</h1>` +
//    `<pre>${JSON.stringify(results[0].testResults)}</pre>` +
    htmlTable({headers, body,
               className:"comparison-table"}) +
	`<p>Tests ran at ${results.timeStarted}.
         Source version: <a href="https://github.com/arthuredelstein/browser-privacy/commit/${results.git}"
    >${results.git.slice(0,8)}</a>.
    Raw data in <a href="${jsonFilename}">JSON</a>.
    </p>`;
};

let readJSONFile = async (file) =>
    JSON.parse(await fs.readFile(file));

let latestFile = async (path) => {
  let stem = (await fs.readdir(path)).sort().pop();
  return path + "/" + stem;
};

let main = async () => {
  if (!(existsSync("./out"))) {
    await fs.mkdir("./out");
  }
  let resultsFile = await latestFile("../selenium/results");
  fs.copyFile(resultsFile, "./out/" + path.basename(resultsFile), fsConstants.COPYFILE_EXCL);
  console.log(`Reading from raw results file: ${resultsFile}`);
  let results = await readJSONFile(resultsFile);
  console.log(results.all_tests[0]);
//  console.log(JSON.stringify(results));
  await fs.writeFile("./out/tests.html", htmlPage({
    title: "Browser Privacy Project",
    content: content(results, path.basename(resultsFile)),
    style: pageStyle
  }));
  console.log(`Wrote out ${fileUrl("./out/tests.html")}`);
};

main();
