// imports
const { existsSync, promises : fs, constants : fsConstants } = require('fs');
const path = require('path');
const fileUrl = require('file-url');
const open = require('open');
const minimist = require('minimist');

const faviconURI = "data:image/png;base64,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";

// The basic structure of the HTML page
let htmlPage = ({ title, content, style, faviconURI }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf8'/>
    <link href="${faviconURI}" rel="icon" type="image/x-icon" />
    <title>${title}</title>
    <style>${style}</style>
  </head>
  <body>
    ${content}
  </body>
</html>
`;

// An empty HTML table with styling
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

// Inline CSS for our page
const pageStyle = `
.title {
  font-weight: bold;
  margin: 0px -1px;
  text-align: left;
  padding-left: 0px;
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
  word-break: break-all;
  vertical-align: middle;
  top: 0px;
  font-size: 12px;
  table-layout: fixed;
  width: 120px;
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
  font-size: 20px;
  padding-top: 20px;
  padding-bottom: 6px;
}
table.comparison-table tr td div {
  font-size: 16px;
  background-repeat: no-repeat;
  background-position: center;
  background-clip: border-box;
}
table.comparison-table tr td div.good {
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAMAAABhq6zVAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAABEVBMVEUAAABKx0o/wz82wTY2wDb///84wTgAgABHxkcxvzEvvi8wvzAguiAxvzEluyUxvzErvSsuvi5OyE5Mx0xizmIRtREPtQ8rvSt01HQStRIDsQMBsAEPtQ////////+X35cTthMEsQQDsQMRtRFAxEAWtxYZuBn3/PcVthUEsQQDsQMQtRBSyVIStRIDsQMFsgUWtxb///8WtxYEsQQDsQMQtRBQyVAPtQ8BsAEEsQQRtREEsQQCsQIPtQ9GxkYtvi0MtAwCsAIBsAECsQIQtRBGxUYwvzANtA0CsQICsQIQtRBHxkcxvzEOtA4FsQUQtRBJxkkuvi4guiAuvi4AsAAAsAAAsAAAsAAAsAAAsAD////XNc91AAAAVHRSTlMAAAAAAAAAAAAAAAAAAAAAAAAEBwJljBMCYe78ogAAAV3s73gFWUABWerybAR38N1HAFXo83AEnvrfiOP0cwUPjvr+9XYFDIr59nkGCobvfQcMQAv6JZO0AAAAAWJLR0QF+G/pxwAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAAd0SU1FB+ILDwYJMqVzpxUAAAB7SURBVAjXY2CAAkYhYSYYm1lEVEwcymaRkJSSlmFglZVjZWCTV1AMUVJmUFFVY+dQ19AM0dLWYdDV0zcwNDIONTE142QwtwiztLIOtbG142JgsHdwDHeKcHZx5Qaaw+Pm7hHp6eXNCzaVz8fXzz+AH2qHQGBQsCADBgAAgLoQVIbOYasAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTgtMDktMDVUMTQ6MjQ6MjktMDc6MDD3IjJVAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE4LTA5LTA1VDE0OjI0OjI5LTA3OjAwhn+K6QAAAABJRU5ErkJggg==);
}
table.comparison-table tr td div.bad {
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAABF1BMVEXPAADeTEzgWFjIAADNAADLAADKAADNAADiY2PKAADPAADdTEzdTEzPAADKAADiZGTNAADKAADLAADMAADJAADhYWHdS0vOAADUGRnSDAzUFBTUFRXSDAzUGRnSDAzRBQXUFhbUFxfRBQXSDAzUFhbRBQXRBQXUGBjUGBjRBQXRBQXUFRXUFxfRBQXRBQXRBQXRBQXUFxfUGRnRBQXRBQXUGBjUGBjRBQXRBQXUGRnUFhbRBQXRBQXRBQXRBQXUFxfUFRXRBQXRBQXUGBjUGBjRBQXRBQXUFRXSDAzRBQXUFxfUFxfRBQXSDAzSDAzUFRXUFBTSDAzQAQHQAQHQAADQAADQAADQAADQAADQAADQAQHQAQH////CqmDcAAAAUnRSTlMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA5rjpHtze2zDI61a1F1M8yN9XNOznU19nPMzfa2DMz2No4Ms/Z19U6OcvUNzPP1Uet1Dkzzba3RTuu4CS2RAAAAAFiS0dEXOrYAJcAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfiCw8GCRaZcEPEAAAAdklEQVQI12OQkJRiYGRilpaRZZALkldgYVVUClZmUFENUVPX0AzV0mZg09EN09MPNzBkZ+DgNDKOiDAx5eJm4OE1M4+IsLDk42cQsLIOtbGNtLMXZHBwDHFydnENdXNn8Ijy9BIS9vaJ9mWQ8PMXERUTDwiUBQB4nxKWDdKgdgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxOC0wOS0wNVQxNDoyNDoyOS0wNzowMPciMlUAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTgtMDktMDVUMTQ6MjQ6MjktMDc6MDCGf4rpAAAAAElFTkSuQmCC);
}
table.comparison-table tr td:first-child,th:first-child {
  text-align: left;
  left: 0px;
  padding-left: 8px;
  position: sticky;
  position: -webkit-sticky;
}
table.comparison-table tr td:first-child {
  max-width: 220px;
  min-width: 220px;
  word-break: break-all;
}
h1 {
  word-break: normal;
  font-size: 32px;
}
`;

// Takes the results for tests on a specific browser,
// and returns an HTML fragment that will serve as
// the header for the column showing thoses tests.
let resultsToDescription = ({
  browser,
  capabilities: { os, os_version, browser: browser2, browserName, browserVersion, version,
                  browser_version, device, platformVersion, platformName, platform },
  prefs
}) => {
  let browserFinal = browser || browserName || browser2;
  let browserVersionFinal = browserVersion || version || "(version unknown)";
  let platformFinal = platformName || os || platform;
  let platformVersionFinal = platformVersion || "";
  let finalText = `${browserFinal} ${browserVersionFinal}<br>${platformFinal} ${platformVersionFinal}`;
  if (prefs) {
    for (let key of Object.keys(prefs).sort()) {
      finalText += `<br>${key}: ${prefs[key]}`
    }
  }
  return finalText;
};

// Generates a table cell which indicates whether
// a test passed, and includes the tooltip with
// more information.
let itemBody = ({passed, testFailed, tooltip}) =>
`<div class='${testFailed ? "na" : (passed ? "good" : "bad")}'
title = '${ tooltip.replace(/'/g, "&#39;") }'> &nbsp;
</div>`;

// Creates a tooltip with fingerprinting test results
// including the test expressions, the actual
// and desired values, and whether the test passed.
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

// For a tor tests, creates a tooltip that gives detail on
// the ip address and whether it's a Tor exit and
// whether the test passed.
let torTooltip = torItem => {
  let { IPAddress, TorExit, passed } = torItem;
  return `
IPAddress: ${ IPAddress }
TorExit: ${ TorExit }
passed: ${ passed }
`.trim();
};

let supercookieTooltip = (
  { write, read, readSameFirstParty, readDifferentFirstParty, passed, testFailed }
) => {
  return `
write: ${ write }
read: ${ read }
result, same first party: ${ readSameFirstParty }
result, different first party: ${ readDifferentFirstParty }
passed: ${ passed }
test failed: ${ testFailed }
`.trim();
};

let resultsSection = ({results, category, tooltipFunction}) => {
//  console.log(results);
  let bestResults = results.filter(m => m["testResults"][category]);
  if (bestResults.length === 0) {
    return [];
  }
  let rowNames = Object.keys(bestResults[0]["testResults"][category])
      .sort(Intl.Collator().compare);
  let resultMaps = bestResults
      .map(m => m["testResults"][category]);
  let section = [];
  for (let rowName of rowNames) {
    let row = [];
    row.push(rowName);
    for (let resultMap of resultMaps) {
      let tooltip = tooltipFunction(resultMap[rowName]);
      let { passed, testFailed } = resultMap[rowName];
      row.push(itemBody({ passed, testFailed, tooltip }));
    }
    section.push(row);
  };
  return section;
};

let resultsToTable = (results, title) => {
  let filteredResults = results
      .filter(m => m["testResults"])
      .filter(m => m["testResults"]["fingerprinting"]);
//  console.log(filteredResults[0]);
  let headers = filteredResults.map(resultsToDescription);
  headers.unshift(`<h1 class="title">${title}</h1>`);
  let body = [];
  body.push([{subheading:"IP address masking tests"}]);
  body = body.concat(resultsSection({results: filteredResults, category:"tor", tooltipFunction: torTooltip}));
  body.push([{subheading:"Partitioning tests"}]);
  body = body.concat(resultsSection({results: filteredResults, category:"supercookies", tooltipFunction: supercookieTooltip}));
  body.push([{subheading:"Fingerprinting resistance tests"}]);
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
         Source version: <a href="https://github.com/arthuredelstein/browser-privacy/tree/${results.git}"
    >${results.git.slice(0,8)}</a>.
    Raw data in <a href="${jsonFilename}">JSON</a>.
    </p>`;
};

let readJSONFile = async (file) =>
    JSON.parse(await fs.readFile(file));

let latestResultsFile = async (path) => {
  let files = await fs.readdir(path);
  let stem = files
      .filter(f => f.match("^results_(.*?)\.json$"))
      .sort()
      .pop();
  return path + "/" + stem;
};

let main = async () => {
  let { live } = minimist(process.argv.slice(2));
  let resultsFileJSON = await latestResultsFile("./out");
  let resultsFileHTMLLatest = "./out/results_latest.html";
  let resultsFileHTML = resultsFileJSON.replace(/\.json$/, ".html");
//  fs.copyFile(resultsFile, "./out/" + path.basename(resultsFile), fsConstants.COPYFILE_EXCL);
  console.log(`Reading from raw results file: ${resultsFileJSON}`);
  let results = await readJSONFile(resultsFileJSON);
//  console.log(results.all_tests[0]);
//  console.log(JSON.stringify(results));
  await fs.writeFile(resultsFileHTMLLatest, htmlPage({
    title: "Browser Privacy Project",
    content: content(results, path.basename(resultsFileJSON)),
    style: pageStyle,
    faviconURI
  }));
  console.log(`Wrote out ${fileUrl(resultsFileHTMLLatest)}`);
  await fs.copyFile(resultsFileHTMLLatest, resultsFileHTML);
  console.log(`Wrote out ${fileUrl(resultsFileHTML)}`);
  if (!live) {
    open(fileUrl(resultsFileHTML));
  }
};

main();
