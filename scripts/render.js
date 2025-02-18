/* eslint-disable camelcase */

// imports
const fs = require('fs');
const path = require('path');
const fileUrl = require('file-url');
const open = require('open');
const minimist = require('minimist');
const template = require('./template.js');
const _ = require('lodash');
const { readYAMLFile, dataUriFromFile } = require('./utils.js');
const cleaner = require('clean-html');
const { HtmlValidate } = require('html-validate');

const cleanHtml = async (content) => {
  const step1 = await new Promise(resolve => cleaner.clean(content,
    { wrap: 0, 'preserve-tags': ['script', 'style', 'pre'] },
    resolve));
  // Remove trailing whitespace:
  const step2 = step1.replaceAll(/\s+\n/g, '\n');
  return step2;
};

const stubRe = /[^A-Za-z1-9 ]/g
const titleToFragment = str => str.replace(stubRe, '').replace(' ', '-').toLowerCase()

const escapeHtml = str => str.replace(/[&<>'"]/g,
  tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag]));

// The names used by browser-logos for nightly browsers.
const nightlyIconNames = {
  brave: 'brave-nightly',
  chrome: 'chrome-canary',
  duckduckgo: 'duckduckgo',
  edge: 'edge-canary',
  firefox: 'firefox-nightly',
  opera: 'opera-developer',
  safari: 'safari-technology-preview',
  tor: 'tor-nightly',
  vivaldi: 'vivaldi-snapshot'
};

// Returns a data: URI browser logo for the given browser.
const browserLogoDataUri = _.memoize((browserName, nightly) => {
  const browserIconName = nightly ? nightlyIconNames[browserName] : browserName;
  let iconUri;
  try {
    iconUri = dataUriFromFile(`node_modules/@browser-logos/${browserIconName}/${browserIconName}_128x128.png`);
    return iconUri;
  } catch (e) {
    try {
      return dataUriFromFile(`../assets/icons/${browserIconName}.png`);
    } catch (e) {
      return dataUriFromFile('../assets/icons/unknown.svg');
    }
  }
});

// Deep-copy a JSON structure (by value)
const deepCopy = (json) => JSON.parse(JSON.stringify(json));

// An HTML table with styling
const htmlTable = ({ headers, body, className }) => {
  const elements = [];
  elements.push(`<table class="${className}">`);
  elements.push('<tbody>');
  elements.push('<tr>');
  if (headers) {
    for (const header of headers) {
      elements.push(`<th class="table-header">${header}</th>`);
    }
  }
  elements.push('</tr>');
  let firstSubheading = true;
  for (const row of body) {
    elements.push('<tr>');
    for (const item of row) {
      if (item.subheading) {
        const description = (item.description ?? '').replaceAll(/\s+/g, ' ').trim();
        className = firstSubheading ? 'first subheading' : 'subheading';
        elements.push(`
        <th colspan="8" class="${className} tooltipParent">
          <div>
            <span class="subheading-title" id="${titleToFragment(item.subheading)}">
              <a href="#${titleToFragment(item.subheading)}">${escapeHtml(item.subheading)}</a>
            </span>
            <span class="tagline">${item.tagline}</span>
          </div>
          <pre class="tooltipText">${escapeHtml(description)}</pre>
        </th>`);
        firstSubheading = false;
      } else {
        elements.push(`${item}`);
      }
    }
    elements.push('</tr>');
  }
  elements.push('</tbody>');
  elements.push('</table>');
  return elements.join('');
};

const dropMicroVersion = (version) =>
  version ? version.split('.').slice(0, 2).join('.') : version;

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
      tooltip.style.transform="translate(" + (-overflowX) +"px, -12px)";
    }
    visibleTooltip = tooltip;
  }
  document.addEventListener("mousedown", e => {
    if (e.button !== 0) {
      return;
    }
    const tooltipParent = e.composedPath().filter(element => element.classList?.contains("tooltipParent"))[0];
    if (tooltipParent) {
      const tooltip = tooltipParent.querySelector(".tooltipText");
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
  const browserFinal = browser;
  const browserVersionLong = reportedVersion;
  const browserVersionShort = dropMicroVersion(browserVersionLong) || '???';
  // const platformFinal = os;
  //  let platformVersionFinal = platformVersion || "";
  let finalText = `
  <span>
    <img class="browser-logo-image" alt="${browserFinal} logo" src="${browserLogoDataUri(browser, nightly)}" width="32" height="32"><br>
    ${browserFinal}<br>
    ${browserVersionShort}
  </span>`;
  if (prefs) {
    for (const key of Object.keys(prefs).sort()) {
      if (key !== 'extensions.torlauncher.prompt_at_startup') {
        finalText += `<br>${key}: ${prefs[key]}`;
      }
    }
  }
  if (incognito === true) {
    finalText += '<br>private';
  }
  if (tor === true) {
    finalText += '<br>Tor';
  }
  return finalText;
};

const allHaveValue = (x, value) => {
  return Array.isArray(x) ? x.every(item => item === value) : x === value;
};

// Generates a table cell which indicates whether
// a test passed, and includes the tooltip with
// more information.
const testBody = ({ passed, testFailed, tooltip, unsupported }) => {
  const allUnsupported = allHaveValue(unsupported, true);
  const anyDidntPass = Array.isArray(passed) ? passed.some(x => x === false) : (passed === false);
  const altText = allUnsupported ? 'Unsupported' : (anyDidntPass ? 'Failed' : 'Passed');
  return `<td class='tooltipParent'><img alt='${altText}' src='' class='dataPoint ${(allUnsupported) ? 'na' : (anyDidntPass ? 'bad' : 'good')}'
>
<pre class="tooltipText">${escapeHtml(tooltip)}</pre></td>`;
};
//  ${allUnsupported ? '&ndash;' : '&nbsp;'}
const tooltipFunctions = {};

// Creates a tooltip with fingerprinting test results
// including the test expressions, the actual
// and desired values, and whether the test passed.
tooltipFunctions.fingerprinting = fingerprintingItem => {
  const {
    expression, desired_expression, actual_value,
    desired_value, passed, worker
  } = fingerprintingItem;
  return `
expression: ${expression}
desired expression: ${desired_expression}
actual value: ${actual_value}
desired value: ${desired_value}
passed: ${passed}
${worker ? '[Worker]' : ''}
  `.trim();
};

const joinIfArray = x => {
  const isArray = Array.isArray(x);
  const joined = isArray ? x.join(', ') : x;
  const final = isArray && x[0] && x[0].length > 10 ? '\n' + joined.replaceAll(', ', ',\n') : joined;
  return final;
};

// For simple tests, creates a tooltip that shows detailed results.
tooltipFunctions.simple = (result) => {
  let text = '';
  for (const key in result) {
    console.log(key, result[key]);
    if (key !== 'description') {
      text += `${key}: ${joinIfArray(result[key])}\n`;
    }
  }
  return text.trim();
};

tooltipFunctions.crossSite = (
  { write, read, readSameFirstParty, readDifferentFirstParty, passed, testFailed, unsupported }
) => {
  return `
write: ${write}

read: ${read}

result, same first party: ${joinIfArray(readSameFirstParty)}

result, different first party: ${joinIfArray(readDifferentFirstParty)}

unsupported: ${joinIfArray(unsupported)}

passed: ${joinIfArray(passed)}

test failed: ${joinIfArray(testFailed)}
`.trim();
};

tooltipFunctions.crossSession = (
  { write, read, readSameSession, readDifferentSession, passed, testFailed, unsupported }
) => {
  return `
write: ${write}

read: ${read}

result, same session: ${joinIfArray(readSameSession)}

result, different session: ${joinIfArray(readDifferentSession)}

unsupported: ${joinIfArray(unsupported)}

passed: ${joinIfArray(passed)}

test failed: ${joinIfArray(testFailed)}
`.trim();
};

const resultsSection = ({ bestResults, category, tooltipFunction }) => {
  //  console.log(results);
  const section = [];
  const bestResultsForCategory = bestResults[0].testResults[category];
  if (!bestResultsForCategory) {
    return [];
  }
  const rowNames = Object.keys(bestResultsForCategory)
    .sort(Intl.Collator().compare);
  const resultMaps = bestResults
    .map(m => m.testResults[category]);
  for (const rowName of rowNames) {
    const row = [];
    const description = bestResultsForCategory[rowName].description ?? '';
    row.push(`<td class="tooltipParent">
                <div>${rowName}</div>
                <pre class="tooltipText">${escapeHtml(description)}</pre>
              </td>`);
    for (const resultMap of resultMaps) {
      try {
        const tooltip = tooltipFunction(resultMap[rowName]);
        const { passed, testFailed, unsupported } = resultMap[rowName];
        row.push(testBody({ passed, testFailed, tooltip, unsupported }));
      } catch (e) {
        console.log('----', rowName, resultMap[rowName]);
        console.log(e, category, rowName, resultMap, resultMap[rowName]);
        throw e;
      }
    }
    section.push(row);
  }
  return section;
};

const resultsToTable = (results, title, subtitle, desktopOnly, testMyBrowser) => {
  console.log(results);
  const bestResults = results
    .filter(m => m.testResults)
    //  .filter(m => m["testResults"]["supercookies"])
    .sort((m1, m2) => m1.browser ? m1.browser.localeCompare(m2.browser) : -1);
  console.log(bestResults[0]);
  const headers = bestResults.map(resultsToDescription);
  headers.unshift(`<h1 class="title">${title}</h1><span class="subtitle">${subtitle}</span>`);
  let body = [];
  if (bestResults.length === 0) {
    return [];
  }
  const sections = readYAMLFile('../assets/copy/sections.yaml');
  for (const { category, name, description, tagline, tooltipType } of sections) {
    if (!(!desktopOnly && ['tracker_cookies', 'dns'].includes(category)) &&
        !(testMyBrowser && ['session_1p', 'session_3p', 'dns', 'tracker_cookies'].includes(category))) {
      body.push([{ subheading: name, description, tagline }]);
      body = body.concat(resultsSection({
        bestResults,
        category,
        tooltipFunction: tooltipFunctions[tooltipType]
      }));
    }
  }
  return { headers, body };
};

// Create the title HTML for a results table.
const tableTitleHTML = (title) => `
  <span class="table-title">${title}</span>`;

// Create dateString from the given date and time string.
const dateString = (dateTime) => {
  const dateTimeObject = new Date(dateTime);
  return dateTimeObject.toISOString().split('T')[0];
};

// Creates the content for a page.
const content = (results, jsonFilename, title, nightly, incognito, testMyBrowser) => {
  const { headers, body } = resultsToTable(results.all_tests, tableTitleHTML(title), '(default settings)', results.platform === 'Desktop', testMyBrowser);
  const issueNumberPath = path.join(__dirname, 'issue-number');
  const issueNumberExists = fs.existsSync(issueNumberPath);
  const issueNumber = issueNumberExists ? fs.readFileSync(issueNumberPath).toString().trim() : undefined;
  const leftHeaderText = issueNumber ? `No. ${issueNumber}` : '';
  console.log(results.platform);
  return `
    <div class="banner" id="issueBanner">
      <div class="left-heading">${leftHeaderText}</div>
      <div class="middle-heading">Open-source tests of web browser privacy.</div>
      <div class="right-heading">Updated ${results.timeStarted ? dateString(results.timeStarted) : '??'}</div>
    </div>
    <div class="banner" id="navBanner">
      <div class="navItem ${!incognito && !nightly && results.platform !== 'Android' && results.platform !== 'iOS' ? 'selectedItem' : ''}">
        <a href=".">Desktop browsers</a>
      </div>
      <div class="navItem ${incognito && !nightly && results.platform !== 'Android' && results.platform !== 'iOS' ? 'selectedItem' : ''}">
        <a href="private">Desktop private modes</a>
      </div>
      <div class="navItem ${results.platform === 'iOS' ? 'selectedItem' : ''}">
        <a href="ios">iOS browsers</a>
      </div>
      <div class="navItem ${results.platform === 'Android' ? 'selectedItem' : ''}">
        <a href="android">Android browsers</a>
      </div>
      <div class="navItem ${nightly && !incognito ? 'selectedItem' : ''}">
        <a href="nightly">Nightly builds</a>
      </div>
      <div class="navItem ${nightly && incognito ? 'selectedItem' : ''}">
        <a href="nightly-private">Nightly private modes</a>
      </div>
    </div>
    <div class="banner" id="legend">
      <div id="key">
        <div><img class="marker good" alt="Passed" src=""> = Passed privacy test</div>
        <div><img class="marker bad" alt="Failed" src=""> = Failed privacy test</div>
        <div><img class="marker na" alt="Unsupported" src=""> = No such feature</div>
      </div>
      <div class="banner" id="instructions">
        <div><span class="click-anywhere">(Click anywhere for more info.)</span></div>
      </div>
    </div>` +
    htmlTable({
      headers,
      body,
      className: 'comparison-table'
    }) +
    `<p class="footer">Tests ran at ${results.timeStarted ? results.timeStarted.replace('T', ' ').replace(/\.[0-9]{0,3}Z/, ' UTC') : '??'}.
         Source version: <a href="https://github.com/privacytests/privacytests.org/tree/${results.git}"
    >${results.git.slice(0, 8)}</a>.
    Raw data in <a href="${jsonFilename}">JSON</a>.
    </p>` + `<script type="module">${tooltipScript}</script>`;
};

const contentPage = ({ results, title, basename, canonicalUrl, previewImageUrl, tableTitle, nightly, incognito, testMyBrowser }) =>
  cleanHtml(
    template.htmlPage({
      title,
      date: new Date(results.timeStarted),
      previewImageUrl,
      canonicalUrl,
      cssFiles: [
        path.join(__dirname, '/../assets/css/template.css'),
        path.join(__dirname, '../assets/css/table.css')
      ],
      content: content(results, basename, tableTitle, nightly, incognito, testMyBrowser)
    }));

// Reads in a file and parses it to a JSON object.
const readJSONFile = (file) =>
  JSON.parse(fs.readFileSync(file));

// Returns the path to the latest results file in
// the given directory.
const latestResultsFile = (dir) => {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const stem = files
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .pop();
  const todayPath = dir + '/' + stem;
  console.log(todayPath);
  const todayFiles = fs.readdirSync(todayPath);
  const latestFile = todayFiles.filter(d => d.endsWith('.json')).sort().pop();
  return todayPath + '/' + latestFile;
};

// List of results keys that should be collected in an array
const resultsKeys = [
  'passed', 'testFailed',
  'readSameFirstParty', 'readDifferentFirstParty',
  'readSameSession', 'readDifferentSession',
  'actual_value', 'desired_value',
  'IsTorExit', 'cloudflareDoH', 'nextDoH', 'result',
  'unsupported', 'upgraded', 'cookieFound', 'leak detected'
];

// Finds any repeated trials of tests and aggregate the results
// for a simpler rendering.
const aggregateRepeatedTrials = (results) => {
  const aggregatedResults = new Map();
  let testIndex = 0;
  for (const test of results.all_tests) {
    if (test && test.testResults) {
      const key = resultsToDescription(test);
      // console.log(key);
      if (aggregatedResults.has(key)) {
        const testResultsForRound = aggregatedResults.get(key).testResults;
        if (testResultsForRound) {
          for (const subcategory of ['supercookies', 'session_1p', 'session_3p', 'fingerprinting', 'https', 'misc', 'navigation',
            'query', 'trackers', 'tracker_cookies', 'dns']) {
            const someTests = testResultsForRound[subcategory];
            for (const testName in test.testResults[subcategory]) {
              for (const value in test.testResults[subcategory][testName]) {
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
  const resultsCopy = deepCopy(results);
  resultsCopy.all_tests = [...aggregatedResults.values()];
  return resultsCopy;
};

const getMergedResults = (dataFiles) => {
  const resultItems = dataFiles.map(readJSONFile);
  const finalResults = resultItems[0];
  for (const resultItem of resultItems.slice(1)) {
    finalResults.all_tests = finalResults.all_tests.concat(resultItem.all_tests);
  }
  return finalResults;
};

const createTitle = ({ nightly, incognito, timeStarted, platform }) => {
  const year = (new Date(timeStarted)).getFullYear().toString();
  const onPlatformPhrase = platform === 'Desktop' ? '' : `on ${platform} `;
  return `What are the best ${nightly ? 'alpha ' : ''}${incognito ? 'incognito modes' : 'private browsers'} ${onPlatformPhrase}in ${year}?`;
};

const renderPage = async ({ dataFiles, aggregate }) => {
  const resultsFilesJSON = (dataFiles && dataFiles.length > 0) ? dataFiles : [latestResultsFile('../results')];
  console.log(resultsFilesJSON);
  const resultsFileHTMLLatest = '../results/latest.html';
  const resultsFileHTML = resultsFilesJSON[0].replace(/\.json$/, '.html');
  const resultsFilePreviewImage = resultsFileHTML.replace('.html', '-preview.png');
  const resultsFileCanonicalUrl = resultsFileHTML.replace('.html', '');
  //  fs.copyFile(resultsFile, "../results/" + path.basename(resultsFile), fs.constants.COPYFILE_EXCL);
  console.log(`Reading from raw results files: ${resultsFilesJSON}`);
  const results = getMergedResults(resultsFilesJSON);
  console.log(results.all_tests.length);
  const processedResults = aggregate ? aggregateRepeatedTrials(results) : results;
  //  console.log(results.all_tests[0]);
  //  console.log(JSON.stringify(results));
  const nightly = results.all_tests.every(t => (t.nightly === true));
  const incognito = results.all_tests.every(t => (t.incognito === true || t.tor === true));
  let tableTitle;
  if (nightly) {
    tableTitle = incognito ? 'Nightly private modes' : 'Nightly Builds';
  } else if (results.platform === 'Android') {
    tableTitle = 'Android Browsers';
  } else if (results.platform === 'iOS') {
    tableTitle = 'iOS Browsers';
  } else {
    tableTitle = incognito ? 'Desktop private modes' : 'Desktop Browsers';
  }
  const basename = path.basename(resultsFilesJSON[0]);
  const content = await contentPage({
    title: createTitle({ platform: results.platform, nightly, incognito, timeStarted: processedResults.timeStarted }),
    tableTitle,
    nightly,
    incognito,
    basename,
    results: processedResults,
    canonicalUrl: path.basename(resultsFileCanonicalUrl),
    previewImageUrl: path.basename(resultsFilePreviewImage)
  });
  const htmlvalidate = new HtmlValidate();
  const report = await htmlvalidate.validateString(content, {
    rules: {
      'attribute-allowed-values': 'off',
      'wcag/h63': 'off',
      'element-permitted-content': 'off'
    }
  });
  if (!report.valid) {
    console.log(report.results[0].messages);
    throw new Error('HTML validation failed.');
  }
  fs.writeFileSync(resultsFileHTMLLatest, content);
  console.log(`Wrote out ${fileUrl(resultsFileHTMLLatest)}`);
  fs.copyFileSync(resultsFileHTMLLatest, resultsFileHTML);
  console.log(`Wrote out ${fileUrl(resultsFileHTML)}`);
  return { resultsFileHTML, resultsFilePreviewImage };
};

const render = async ({ dataFiles, live, aggregate }) => {
  const { resultsFileHTML, resultsFilePreviewImage } = await renderPage({ dataFiles, aggregate });
  if (!live) {
    open(fileUrl(resultsFileHTML));
    const createPreviewImage = (await import('./preview.mjs')).createPreviewImage;
    await createPreviewImage(resultsFileHTML, resultsFilePreviewImage);
  }
};

const main = async () => {
  const { _: dataFiles, live, aggregate } = minimist(process.argv.slice(2),
    { default: { aggregate: true } });
  await render({ dataFiles, live, aggregate: (aggregate === true) });
};

if (require.main === module) {
  main();
}

module.exports = { render, contentPage };
