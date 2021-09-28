// imports
const { existsSync, promises : fs, constants : fsConstants } = require('fs');
const path = require('path');
const fileUrl = require('file-url');
const open = require('open');
const minimist = require('minimist');
const datauri = require('datauri');
const htmlUtils = require('./html-utils.js');

let browserLogos = {};

const browserLogoDataUri = async (browserName) =>
  datauri(`node_modules/browser-logos/src/${browserName}/${browserName}_128x128.png`);

const loadBrowserLogos = async () => {
  for (let browser of ["brave", "firefox", "tor", "edge", "chrome", "opera", "chromium", "safari"]) {
    browserLogos[browser] = await browserLogoDataUri(browser);
  }
  browserLogos["tor browser"] = browserLogos["tor"];
};

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
  let finalText = `<img src=${browserLogos[browser]} width="48" height="48"></img><br>${browserFinal} ${browserVersionFinal}<br>${platformFinal} ${platformVersionFinal}`;
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

const allHaveValue = (x, value) => {
  return Array.isArray(x) ? x.every(item => item === value) : x === value;
};

// Generates a table cell which indicates whether
// a test passed, and includes the tooltip with
// more information.
const itemBody = ({passed, testFailed, tooltip, unsupported}) => {
  let allTestsFailed = allHaveValue(testFailed, true);
  let allUnsupported = allHaveValue(unsupported, true);
  let anyDidntPass = Array.isArray(passed) ? passed.some(x => x === false) : !passed;
  return `<div class='${(allUnsupported) ? "na" : (anyDidntPass ? "bad" : "good")}'
title = '${ tooltip.replace(/'/g, "&#39;") }'> ${allUnsupported ? "&ndash;" : "&nbsp;"}
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
      let { passed, testFailed, unsupported } = resultMap[rowName];
      row.push(itemBody({ passed, testFailed, tooltip, unsupported }));
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

const render = async ({ dataFile, live, aggregate }) => {
  console.log("aggregate:", aggregate);
  await loadBrowserLogos();
  let resultsFileJSON = dataFile ?? await latestResultsFile("./out/results");
  let resultsFileHTMLLatest = "./out/results/latest.html";
  let resultsFileHTML = resultsFileJSON.replace(/\.json$/, ".html");
//  fs.copyFile(resultsFile, "./out/results/" + path.basename(resultsFile), fsConstants.COPYFILE_EXCL);
  console.log(`Reading from raw results file: ${resultsFileJSON}`);
  let results = await readJSONFile(resultsFileJSON);
  console.log(results.all_tests.length);
  let processedResults = aggregate ? aggregateRepeatedTrials(results) : results;
//  console.log(results.all_tests[0]);
//  console.log(JSON.stringify(results));
  await fs.writeFile(resultsFileHTMLLatest, htmlUtils.htmlPage({
    title: "Browser Privacy Project",
    content: content(processedResults, path.basename(resultsFileJSON)),
  }));
  console.log(`Wrote out ${fileUrl(resultsFileHTMLLatest)}`);
  await fs.copyFile(resultsFileHTMLLatest, resultsFileHTML);
  console.log(`Wrote out ${fileUrl(resultsFileHTML)}`);
  if (!live) {
    open(fileUrl(resultsFileHTML));
  }
};

const main = async () => {
  let { _: [ dataFile], live, aggregate } = minimist(process.argv.slice(2),
                                     opts = { default: { aggregate: true }});
  render({ dataFile, live, aggregate });
};

if (require.main === module) {
  main();
}

module.exports = { render };
