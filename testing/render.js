// imports
const { existsSync, promises : fs, constants : fsConstants } = require('fs');
const path = require('path');
const fileUrl = require('file-url');
const open = require('open');
const minimist = require('minimist');
const datauri = require('datauri');

let browserLogos = {};

const faviconURI = "data:image/png;base64,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";

const browserLogoDataUri = async (browserName) => 
  datauri(`node_modules/browser-logos/src/${browserName}/${browserName}_48x48.png`);

const loadBrowserLogos = async () => {
  for (let browser of ["brave", "firefox", "tor", "edge", "chrome", "opera", "chromium", "safari"]) {
    browserLogos[browser] = await browserLogoDataUri(browser);
  }
  browserLogos["tor browser"] = browserLogos["tor"];
};

// The basic structure of the HTML page
const htmlPage = ({ title, content, style, faviconURI }) => `
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

// Deep-copy a JSON structure (by value)
const deepCopy = (json) => JSON.parse(JSON.stringify(json));

// An HTML table with styling
const htmlTable = ({ headers, body, className }) => {
  elements = [];
  elements.push(`<table class="${className}">`);
  elements.push("<tr>");
  for (let header of headers) {
    elements.push(`<th  style="text-transform: capitalize;">${header}</th>`);
  }
  elements.push("</tr>");
  for (let row of body) {
    elements.push("<tr>");
    for (let item of row) {
      if (item.subheading) {
        elements.push(`<th colspan="4">${item.subheading}</th>`);
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
const pageStylePromise = fs.readFile("./inline.css");

const dropMicroVersion = (version) =>
  version.split(".").slice(0,2).join(".");

// Takes the results for tests on a specific browser,
// and returns an HTML fragment that will serve as
// the header for the column showing thoses tests.
const resultsToDescription = ({
  browser,
  capabilities: { os, os_version, browser: browser2, browserName, browserVersion, version,
                  browser_version, device, platformVersion, platformName, platform },
  prefs, incognito, tor_mode
}) => {
  let browserFinal = browser || browserName || browser2;
  let browserVersionFinal =  dropMicroVersion(browserVersion || version) || "(version unknown)";
  let platformFinal = platformName || os || platform;
  let platformVersionFinal = platformVersion || "";
  let finalText = `<img src=${browserLogos[browser]}></img><br>${browserFinal} ${browserVersionFinal}<br>${platformFinal} ${platformVersionFinal}`;
  if (prefs) {
    for (let key of Object.keys(prefs).sort()) {
      if (key !== "extensions.torlauncher.prompt_at_startup") {
        finalText += `<br>${key}: ${prefs[key]}`;
      }
    }
  }
  if (incognito === true) {
    finalText += "<br>(incognito)";
  }
  if (tor_mode === true) {
    finalText += "<br>(Tor window)";
  }
  return finalText;
};

// Generates a table cell which indicates whether
// a test passed, and includes the tooltip with
// more information.
const itemBody = ({passed, testFailed, tooltip}) => {
  let allTestsFailed = Array.isArray(testFailed) ? testFailed.every(x => x === true) : testFailed;
  let anyDidntPass = Array.isArray(passed) ? passed.some(x => x === false) : !passed;
  return `<div class='${allTestsFailed ? "na" : (anyDidntPass ? "bad" : "good")}'
title = '${ tooltip.replace(/'/g, "&#39;") }'> &nbsp;
</div>`;
};

// Creates a tooltip with fingerprinting test results
// including the test expressions, the actual
// and desired values, and whether the test passed.
const fingerprintingTooltip = fingerprintingItem => {
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

// For simple tests, creates a tooltip that shows detailed results.
const simpleToolTip = item => {
  let text = "";
  for (let key in item) {
    text += `${key}: ${item[key]}\n`;
  }
  return text.trim();
};

const joinIfArray = x => Array.isArray(x) ? x.join(", ") : x;

const crossSiteTooltip = (
  { write, read, readSameFirstParty, readDifferentFirstParty, passed, testFailed, unsupported }
) => {
  return `
write: ${ write }

read: ${ read }

result, same first party: ${ joinIfArray(readSameFirstParty) }

result, different first party: ${ joinIfArray(readDifferentFirstParty) }

unsupported: ${ joinIfArray(unsupported) }

passed: ${ joinIfArray(passed) }

test failed: ${ joinIfArray(testFailed) }
`.trim();
};

const resultsSection = ({bestResults, category, tooltipFunction}) => {
//  console.log(results);
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
  }
  return section;
};

const resultsToTable = (results, title) => {
  let bestResults = results
      .filter(m => m["testResults"])
      .filter(m => m["testResults"]["fingerprinting"])
      .sort((m1, m2) => m1["browser"] ? m1["browser"].localeCompare(m2["browser"]) : -1);
  let headers = bestResults.map(resultsToDescription);
  headers.unshift(`<h1 class="title">${title}</h1>`);
  let body = [];
  if (bestResults.length === 0) {
    return [];
  }
  body.push([{subheading:"State Partitioning tests"}]);
  body = body.concat(resultsSection({bestResults, category:"supercookies", tooltipFunction: crossSiteTooltip}));
  body.push([{subheading:"Navigation tests"}]);
  body = body.concat(resultsSection({bestResults, category:"navigation", tooltipFunction: crossSiteTooltip}));
  body.push([{subheading:"HTTPS tests"}]);
  body = body.concat(resultsSection({bestResults, category:"https", tooltipFunction: simpleToolTip}));
  body.push([{subheading:"Misc tests"}]);
  body = body.concat(resultsSection({bestResults, category:"misc", tooltipFunction: simpleToolTip}));
  body.push([{subheading:"Tracking query parameter tests"}]);
  body = body.concat(resultsSection({bestResults, category:"query", tooltipFunction: simpleToolTip}));
  body.push([{subheading:"Fingerprinting resistance tests"}]);
  body = body.concat(resultsSection({bestResults, category:"fingerprinting", tooltipFunction: fingerprintingTooltip} ));
  return { headers, body };
};

const content = (results, jsonFilename) => {
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

const readJSONFile = async (file) =>
    JSON.parse(await fs.readFile(file));

const latestResultsFile = async (path) => {
  let files = await fs.readdir(path);
  let stem = files
      .filter(f => f.match("^(.*?)\.json$"))
      .sort()
      .pop();
  return path + "/" + stem;
};

// List of results keys that should be collected in an array
const resultsKeys = [
  "passed", "testFailed",
  "readSameFirstParty", "readDifferentFirstParty",
  "actual_value", "desired_value",
  "IsTorExit", "cloudflareDoH", "nextDoH"
];

// Finds any repeated trials of tests and aggregate the results
// for a simpler rendering.
const aggregateRepeatedTrials = (results) => {
  let aggregatedResults = new Map();
  for (let test of results.all_tests) {
    let key = resultsToDescription(test);
    console.log(test, key);
    if (aggregatedResults.has(key)) {
      for (let subcategory of ["supercookies", "fingerprinting", "https", "misc", "navigation", "query"]) {
        let someTests = aggregatedResults.get(key).testResults[subcategory];
        for (let testName in someTests) {
          for (let value of resultsKeys) {
            if (!Array.isArray(someTests[testName][value])) {
              someTests[testName][value] = [someTests[testName][value]];
            }
            someTests[testName][value].push(test.testResults[subcategory][testName][value]);
          }
        }
      }
    } else {
      aggregatedResults.set(key, deepCopy(test));
    }
  }
  let resultsCopy = deepCopy(results);
  resultsCopy.all_tests = [...aggregatedResults.values()];
  return resultsCopy;
};

const main = async () => {
  let { live, aggregate } = minimist(process.argv.slice(2),
                                     opts = { default: { aggregate: true }});
  console.log("aggregate:", aggregate);
  await loadBrowserLogos();
  let resultsFileJSON = await latestResultsFile("./out/results");
  let resultsFileHTMLLatest = "./out/results/latest.html";
  let resultsFileHTML = resultsFileJSON.replace(/\.json$/, ".html");
//  fs.copyFile(resultsFile, "./out/results/" + path.basename(resultsFile), fsConstants.COPYFILE_EXCL);
  console.log(`Reading from raw results file: ${resultsFileJSON}`);
  let results = await readJSONFile(resultsFileJSON);
  console.log(results.all_tests.length);
  let processedResults = aggregate ? aggregateRepeatedTrials(results) : results;
//  console.log(results.all_tests[0]);
//  console.log(JSON.stringify(results));
  await fs.writeFile(resultsFileHTMLLatest, htmlPage({
    title: "Browser Privacy Project",
    content: content(processedResults, path.basename(resultsFileJSON)),
    style: await pageStylePromise,
    faviconURI
  }));
  console.log(`Wrote out ${fileUrl(resultsFileHTMLLatest)}`);
  await fs.copyFile(resultsFileHTMLLatest, resultsFileHTML);
  console.log(`Wrote out ${fileUrl(resultsFileHTML)}`);
  if (!live) {
    open(fileUrl(resultsFileHTML));
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
