// imports
const fs = require('fs');
const path = require('path');
const fileUrl = require('file-url');
const open = require('open');
const minimist = require('minimist');
const template = require('./template.js');
const _ = require('lodash');

// The names used by browser-logos for nightly browsers.
const nightlyIconNames = {
  brave: "brave-nightly",
  chrome: "chrome-canary",
  edge: "edge-canary",
  firefox: "firefox-nightly",
  opera: "opera-developer",
  safari: "safari-technology-preview",
  tor: "tor-nightly",
  vivaldi: "vivaldi-snapshot",
};

// Returns a data: URI browser logo for the given browser.
const browserLogoDataUri = _.memoize((browserName, nightly) => {
  const browserIconName = nightly ? nightlyIconNames[browserName] : browserName;
  let iconUri;
  try {
    iconUri = template.dataUriFromFile(`node_modules/browser-logos/src/${browserIconName}/${browserIconName}_128x128.png`);
    return iconUri;
  } catch (e) {
    return template.dataUriFromFile(`icons/${browserIconName}.png`);
  }
});

// Deep-copy a JSON structure (by value)
const deepCopy = (json) => JSON.parse(JSON.stringify(json));

// An HTML table with styling
const htmlTable = ({ headers, body, className }) => {
  elements = [];
  elements.push(`<table class="${className}">`);
  elements.push("<tr>");
  for (let header of headers) {
    elements.push(`<th class="table-header" style="text-transform: capitalize;">${header}</th>`);
  }
  elements.push("</tr>");
  let firstSubheading = true;
  for (let row of body) {
    elements.push("<tr>");
    for (let item of row) {
      if (item.subheading) {
        let description = (item.description ?? "").replaceAll(/\s+/g, " ").trim();
        className = firstSubheading ? "first subheading" : "subheading";
        elements.push(`<th colspan="4" class="${className} tooltipParent">${item.subheading}<span class="tooltipText">${description}</span></th>`);
        firstSubheading = false;
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
  version ? version.split(".").slice(0,2).join(".") : version;

// An inline script that shows a tooltip if the user clicks on any table element
const tooltipScript = `
  const table = document.querySelector(".comparison-table");
  let visibleTooltip = null;
  const hide = () => {
    if (visibleTooltip) {
      visibleTooltip.style.display = "none";
      visibleTooltip.parentElement.style.backgroundColor = "";
      visibleTooltip = null;
    }
  }
  const show = (tooltip) => {
    hide();
    const viewportWidth = document.documentElement.clientWidth;
    tooltip.style.display = "block";
    tooltip.parentElement.style.backgroundColor = "#ffa";
    const tooltipRight = tooltip.getClientRects()[0].right;
    const tableRight = table.getClientRects()[0].right;
    const overflowX = tooltipRight- tableRight + 8;
    if (overflowX > 0) {
      tooltip.style.transform="translate(" + (-overflowX) +"px, 0px)";
    }
    visibleTooltip = tooltip;
  }
  document.addEventListener("mousedown", e => {
    if (e.target.classList.contains("tooltipParent")) {
      const tooltip = e.target.querySelector(".tooltipText");
      if (tooltip) {
        tooltip === visibleTooltip ? hide() : show(tooltip);
      }
    } else if (e.target.classList.contains("tooltipText")) {
      hide();
    } else {
      hide();
    }
  });
  //document.addEventListener("scroll", hide);
`;

// Takes the results for tests on a specific browser,
// and returns an HTML fragment that will serve as
// the header for the column showing thoses tests.
const resultsToDescription = ({
  browser,
  reportedVersion,
  os, os_version,
  prefs, incognito, tor, nightly
}) => {
  let browserFinal = browser;
  let browserVersionLong = reportedVersion;
  let browserVersionShort = dropMicroVersion(browserVersionLong) || "???";
  let platformFinal = os;
//  let platformVersionFinal = platformVersion || "";
  let finalText = `
  <span>
    <img class="browser-logo-image" src="${browserLogoDataUri(browser, nightly)}" width="32" height="32"><br>
    ${browserFinal}<br>
    ${browserVersionShort}
  </span>`;
  if (prefs) {
    for (let key of Object.keys(prefs).sort()) {
      if (key !== "extensions.torlauncher.prompt_at_startup") {
        finalText += `<br>${key}: ${prefs[key]}`;
      }
    }
  }
  if (incognito === true) {
    finalText += "<br>private";
  }
  if (tor === true) {
    finalText += "<br>Tor";
  }
  return finalText;
};

const allHaveValue = (x, value) => {
  return Array.isArray(x) ? x.every(item => item === value) : x === value;
};

const htmlEscape = (s) => s.replace(/'/g, "&#39;");

// Generates a table cell which indicates whether
// a test passed, and includes the tooltip with
// more information.
const testBody = ({passed, testFailed, tooltip, unsupported}) => {
  let allTestsFailed = allHaveValue(testFailed, true);
  let allUnsupported = allHaveValue(unsupported, true);
  let anyDidntPass = Array.isArray(passed) ? passed.some(x => x === false) : (passed === false);
  return `<div class='dataPoint tooltipParent ${(allUnsupported) ? "na" : (anyDidntPass ? "bad" : "good")}'
> ${allUnsupported ? "&ndash;" : "&nbsp;"}
<span class="tooltipText">${htmlEscape(tooltip)}</span>
</div>`;
};

// Creates a tooltip with fingerprinting test results
// including the test expressions, the actual
// and desired values, and whether the test passed.
const fingerprintingTooltip = fingerprintingItem => {
  let { expression, desired_expression, actual_value,
        desired_value, passed, worker } = fingerprintingItem;
  return `
expression: ${ expression }
desired expression: ${ desired_expression }
actual value: ${ actual_value }
desired value: ${ desired_value }
passed: ${ passed }
${ worker ? "[Worker]" : "" }
  `.trim();
};

// For simple tests, creates a tooltip that shows detailed results.
const simpleToolTip = (result) => {
  let text = "";
  for (let key in result) {
    if (key !== "description") {
      text += `${key}: ${result[key]}\n`;
    }
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
let section = [];
let bestResultsForCategory = bestResults[0]["testResults"][category];
if (!bestResultsForCategory) {
  return [];
}
let rowNames = Object.keys(bestResultsForCategory)
      .sort(Intl.Collator().compare);
  let resultMaps = bestResults
      .map(m => m["testResults"][category]);
  for (let rowName of rowNames) {
    let row = [];
    let description = bestResultsForCategory[rowName]["description"] ?? "";
    row.push(`<div class="tooltipParent">${rowName}<span class="tooltipText">${description}</span></div>`);
    for (let resultMap of resultMaps) {
      try {
        let tooltip = tooltipFunction(resultMap[rowName]);
        let { passed, testFailed, unsupported } = resultMap[rowName];
        row.push(testBody({ passed, testFailed, tooltip, unsupported }));
      } catch (e) {
        console.log(e, category, rowName, resultMap, resultMap[rowName]);
        throw e;
      }
    }
    section.push(row);
  }
  return section;
};

const sectionDescription = {
  statePartitioning: `
    A common vulnerability of web browsers is that they allow tracking companies
    to 'tag' your browser with some data ('state') that identifies you. When third-party trackers
    are embedded in websites, they can see this identifying data as you browse to different
    websites. Fortunately, it is possible for this category of leaks to be fixed by partitioning
    all data stored in the browser such that no data can be shared between websites.`,
  navigation: `
    When you click a hyperlink to navigate your browser from one site to another, certain
    browser APIs allow the first site to communicate to the second site. These privacy
    vulnerabilities can be fixed by introducing new limits on how much data is transfered
    between sites.`,
  https: `
    HTTPS is the protocol that web browsers use to connect securely to websites. When
    HTTPS is being used, the connection is encrypted so
    that third parties on the network cannot read content being sent between the
    server and your browser. In the past, insecure connections were the default and websites
    would need to actively request that a browser use HTTPS. Now the status quo is shifting,
    and browser makers are moving toward a world where HTTPS is the default protocol.`,
  misc: `This category includes tests for the presence of miscellaneous privacy features.`,
  fingerprinting: `
    Fingerprinting is a technique trackers use to uniquely identify you as you browse the web.
    A fingerprinting script will measure several characteristics of your browser and, combining
    this data, will build a fingerprint that may uniquely identify you among web users.
    Browsers can introduce countermeasures, such as minimizing the distinguishing information
    disclosed by certain web APIs so your browser is harder to pick out from the crowd
    (so-called 'fingerprinting resistance').`,
  queryParameters: `
    When you browse from one web page to another, tracking companies will frequently attach
    a 'tracking query parameter' to the address of the second web page. That query parameter
    may contain a unique identifier that tracks you individually as you browse the web. And
    these query parameters are frequently synchronized with cookies, making them a powerful
    tracking vector. Web browsers can protect you from known tracking query parameters by
    stripping them from web addresses before your browser sends them. (The set of
    tracking query parameters tested here was largely borrowed from Brave.)`,
  trackers: `
    When you visit a web page, it frequently has third-party embedded tracking content, such
    as scripts and tracking pixels. These embedded components spy on you. Some browsers and
    browser extensions maintain list of tracking companies and block their content from
    being loaded.
    
    This section checks to see if a browser blocks 20 of the largest trackers listed
    by https://whotracks.me.`,
  tracker_cookies: `
    A large fraction of web pages on the web have hidden third-party trackers that read and
    write cookies in your browser. These cookies can be used to track your browsing across
    websites.

    This section checks to see if a browser stops cross-site tracking by cookies from 20 of
    the largest trackers listed by https://whotracks.me.
  `};

const resultsToTable = (results, title, includeTrackingCookies) => {
  console.log(results);
  let bestResults = results
      .filter(m => m["testResults"])
      .filter(m => m["testResults"]["supercookies"])
      .sort((m1, m2) => m1["browser"] ? m1["browser"].localeCompare(m2["browser"]) : -1);
      console.log(bestResults[0]);
  let headers = bestResults.map(resultsToDescription);
  headers.unshift(`<h1 class="title">${title}</h1>`);
  let body = [];
  if (bestResults.length === 0) {
    return [];
  }
  body.push([{subheading:"State Partitioning tests", description: sectionDescription.statePartitioning}]);
  body = body.concat(resultsSection({bestResults, category:"supercookies", tooltipFunction: crossSiteTooltip}));
  body.push([{subheading:"Navigation tests", description: sectionDescription.navigation}]);
  body = body.concat(resultsSection({bestResults, category:"navigation", tooltipFunction: crossSiteTooltip}));
  body.push([{subheading:"HTTPS tests", description: sectionDescription.https }]);
  body = body.concat(resultsSection({bestResults, category:"https", tooltipFunction: simpleToolTip}));
  body.push([{subheading:"Misc tests", description: sectionDescription.misc}]);
  body = body.concat(resultsSection({bestResults, category:"misc", tooltipFunction: simpleToolTip}));
  body.push([{subheading:"Fingerprinting resistance tests", description: sectionDescription.fingerprinting}]);
  body = body.concat(resultsSection({bestResults, category:"fingerprinting", tooltipFunction: fingerprintingTooltip} ));
  body.push([{subheading:"Tracking query parameter tests", description: sectionDescription.queryParameters}]);
  body = body.concat(resultsSection({bestResults, category:"query", tooltipFunction: simpleToolTip}));
  body.push([{subheading:"Tracker content blocking", description: sectionDescription.trackers}]);
  body = body.concat(resultsSection({bestResults, category:"trackers", tooltipFunction: simpleToolTip}));
  if (includeTrackingCookies) {
    body.push([{subheading:"Tracking cookie protection", description: sectionDescription.tracker_cookies}]);
    body = body.concat(resultsSection({bestResults, category:"tracker_cookies", tooltipFunction: simpleToolTip}));
  }
  return { headers, body };
};

// Create the title HTML for a results table.
const tableTitleHTML = (title) => `
  <div class="table-title">${title}</div>
  <div class="instructions">(click anywhere for more info)</a>`;

// Create dateString from the given date and time string.
const dateString = (dateTime) => {
  let dateTimeObject = new Date(dateTime);
  return dateTimeObject.toISOString().split("T")[0];
};

// Creates the content for a page.
const content = (results, jsonFilename, title, nightly, incognito) => {
  let { headers, body } = resultsToTable(results.all_tests, tableTitleHTML(title), results.platform === "Desktop");
  const issueNumberExists = fs.existsSync(`${__dirname}/issue-number`);
  const issueNumber = issueNumberExists ? fs.readFileSync(`${__dirname}/issue-number`).toString().trim() : undefined;
  const leftHeaderText = issueNumber ? `No. ${issueNumber}` : "";
  console.log(results.platform);
  return `
    <div class="banner" id="issueBanner">
      <div class="left-heading">${leftHeaderText}</div>
      <div class="middle-heading">Open-source tests of web browser privacy.</div>
      <div class="right-heading">Updated ${results.timeStarted ? dateString(results.timeStarted) : "??"}</div>
    </div>
    <div class="banner" id="navBanner">
      <div class="navItem ${!incognito && !nightly && results.platform !== "Android" && results.platform !== "iOS" ? "selectedItem" : ""}">
        <a href=".">Desktop browsers</a>
      </div>
      <div class="navItem ${incognito && !nightly && results.platform !== "Android" && results.platform !== "iOS" ? "selectedItem" : ""}">
        <a href="private.html">Desktop private modes</a>
      </div>
      <div class="navItem ${results.platform === "iOS" ? "selectedItem" : ""}">
        <a href="ios.html">iOS browsers</a>
      </div>
      <div class="navItem ${results.platform === "Android" ? "selectedItem" : ""}">
        <a href="android.html">Android browsers</a>
      </div>
      <div class="navItem ${nightly && !incognito ? "selectedItem" : ""}">
        <a href="nightly.html">Nightly builds</a>
      </div>
      <div class="navItem ${nightly && incognito ? "selectedItem" : ""}">
        <a href="nightly-private.html">Nightly private modes</a>
      </div>
    </div>
    <div class="banner" id="legend">
      <div><span class="marker good">&nbsp;</span>= Passed privacy test</div>
      <div><span class="marker bad">&nbsp;</span>= Failed privacy test</div>
      <div><span class="marker na">–</span>= No such feature</div>
    </div>` +
  htmlTable({headers, body,
                    className:"comparison-table"}) +
	`<p class="footer">Tests ran at ${results.timeStarted ? results.timeStarted.replace("T"," ").replace(/\.[0-9]{0,3}Z/, " UTC") : "??"}.
         Source version: <a href="https://github.com/arthuredelstein/browser-privacy/tree/${results.git}"
    >${results.git.slice(0,8)}</a>.
    Raw data in <a href="${jsonFilename}">JSON</a>.
    </p>` + `<script type="module">${tooltipScript}</script>`;
};

const contentPage = ({results, title, basename, previewImageUrl, tableTitle, nightly, incognito}) =>
      template.htmlPage({
        title, previewImageUrl,
        cssFiles: [`${__dirname}/template.css`, `${__dirname}/inline.css`],
        content: content(results, basename, tableTitle, nightly, incognito),
      });

// Reads in a file and parses it to a JSON object.
const readJSONFile = (file) =>
    JSON.parse(fs.readFileSync(file));

// Returns the path to the latest results file in
// the given directory.
const latestResultsFile = (dir) => {
  let files = fs.readdirSync(dir);
  let stem = files
      .filter(f => f.match("^(.*?)\.json$"))
      .sort()
      .pop();
  return dir + "/" + stem;
};

// List of results keys that should be collected in an array
const resultsKeys = [
  "passed", "testFailed",
  "readSameFirstParty", "readDifferentFirstParty",
  "actual_value", "desired_value",
  "IsTorExit", "cloudflareDoH", "nextDoH", "result",
  "unsupported", "upgraded", "cookieFound"
];

// Finds any repeated trials of tests and aggregate the results
// for a simpler rendering.
const aggregateRepeatedTrials = (results) => {
  let aggregatedResults = new Map();
  let testIndex = 0;
  for (let test of results.all_tests) {
    if (test && test.testResults) {
      let key = resultsToDescription(test);
      //console.log(key);
      if (aggregatedResults.has(key)) {
        let theseTestResults = aggregatedResults.get(key).testResults;
        if (theseTestResults) {
            for (let subcategory of ["supercookies", "fingerprinting", "https", "misc", "navigation",
				     "query", "trackers", "tracker_cookies"]) {
            let someTests = theseTestResults[subcategory];
            for (let testName in test.testResults[subcategory]) {
              for (let value in test.testResults[subcategory][testName]) {
                if (resultsKeys.includes(value)) {
                  if (!someTests[testName]) {
                    throw new Error(`Can't find the "${testName}" ${subcategory} test in testing round ${testIndex}`);
                  }
                  if (!Array.isArray(someTests[testName][value])) {
                    someTests[testName][value] = [someTests[testName][value]];
                  }
                  someTests[testName][value].push(test.testResults[subcategory][testName][value]);
                }
              }
            }
          }
        }
      } else {
        aggregatedResults.set(key, deepCopy(test));
      }
    }
    ++testIndex;
  }
  let resultsCopy = deepCopy(results);
  resultsCopy.all_tests = [...aggregatedResults.values()];
  return resultsCopy;
};

const getMergedResults = (dataFiles) => {
  let resultItems = dataFiles.map(readJSONFile);
  let finalResults = resultItems[0];
  for (let resultItem of resultItems.slice(1)) {
    finalResults.all_tests = finalResults.all_tests.concat(resultItem.all_tests);
  }
  return finalResults;
}

const renderPage = ({ dataFiles, live, aggregate }) => {
  let resultsFilesJSON = (dataFiles && dataFiles.length > 0) ? dataFiles : [latestResultsFile("./out/results")];
  console.log(resultsFilesJSON);
  const resultsFileHTMLLatest = "./out/results/latest.html";
  const resultsFileHTML = resultsFilesJSON[0].replace(/\.json$/, ".html");
  const resultsFilePreviewImage = resultsFileHTML.replace(".html", "-preview.png");
//  fs.copyFile(resultsFile, "./out/results/" + path.basename(resultsFile), fs.constants.COPYFILE_EXCL);
  console.log(`Reading from raw results files: ${resultsFilesJSON}`);
  let results = getMergedResults(resultsFilesJSON);
  console.log(results.all_tests.length);
  let processedResults = aggregate ? aggregateRepeatedTrials(results) : results;
//  console.log(results.all_tests[0]);
//  console.log(JSON.stringify(results));
  const nightly = results.all_tests.every(t => (t.nightly === true));
  const incognito = results.all_tests.every(t => (t.incognito === true || t.tor === true));
  let tableTitle;
  if (nightly) {
    tableTitle = incognito ? "Nightly private modes" : "Nightly Builds";     
  } else if (results.platform === "Android") {
    tableTitle = "Android Browsers";
  } else if (results.platform === "iOS") {
    tableTitle = "iOS Browsers";
  } else {
    tableTitle = incognito ? "Desktop private modes" : "Desktop Browsers";
  }
  const basename = path.basename(resultsFilesJSON[0]);
  fs.writeFileSync(resultsFileHTMLLatest, contentPage({
    title: "PrivacyTests.org",
    tableTitle, nightly, incognito, basename,
    results: processedResults,
    previewImageUrl: path.basename(resultsFilePreviewImage)
  }));
  console.log(`Wrote out ${fileUrl(resultsFileHTMLLatest)}`);
  fs.copyFileSync(resultsFileHTMLLatest, resultsFileHTML);
  console.log(`Wrote out ${fileUrl(resultsFileHTML)}`);
  return { resultsFileHTML, resultsFilePreviewImage };
};

const render = async ({dataFiles, live, aggregate }) => {
  const createPreviewImage = (await import('./preview.mjs')).createPreviewImage;
  const { resultsFileHTML, resultsFilePreviewImage} = renderPage({dataFiles, live, aggregate});
  await createPreviewImage(resultsFileHTML, resultsFilePreviewImage);
  if (!live) {
    open(fileUrl(resultsFileHTML));
  }
}

const main = async () => {
  let { _: dataFiles, live, aggregate } = minimist(process.argv.slice(2),
                                     opts = { default: { aggregate: true }});
  await render({ dataFiles, live, aggregate: (aggregate === true) });
};

if (require.main === module) {
  main();
}

module.exports = { render, contentPage };
