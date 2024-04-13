const { parse } = require('node-html-parser');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { zipObject } = require('lodash');
const jsonDiff = require('json-diff');
const minimist = require('minimist');

const validURL = potentialUrl => {
  try {
    return new URL(potentialUrl);
  } catch (e) {
    return undefined;
  }
};

const slurp = async (pathOrURL) => {
  let content;
  const url = validURL(pathOrURL);
  if (url) {
    const response = await fetch(url);
    content = await response.text();
  } else {
    const fullPath = path.resolve(pathOrURL);
    const buffer = await fsPromises.readFile(fullPath);
    content = buffer.toString();
  }
  return content;
};

const readBrowserVersionsFromNodes = (pageNodes) =>
  Object.fromEntries(pageNodes.querySelectorAll('.comparison-table tr th.table-header')
    .slice(1)
    .map(x => {
      const chunks = x.innerText.trim().split(/\s+/);
      let name = chunks[0];
      const version = chunks[1];
      const windowType = chunks[2] ? chunks[2].toLowerCase() : undefined;
      if (windowType === "tor") {
        name += "-tor";
      }
      return [name, version];
    }));

const readIssueNumberFromNodes = (pageNodes) => {
  const elementText = pageNodes.querySelector('.left-heading').innerText;
  const numberString = elementText.replace('No. ', '');
  return parseInt(numberString);
};

const readResultsFromNodes = (pageNodes, browserNames) => {
  const rows = pageNodes.querySelectorAll('tr');
  let currentSubheading;
  const results = {};
  for (const row of rows) {
    const subheading = row.querySelector('th.subheading span.subheading-title');
    if (subheading) {
      currentSubheading = subheading.innerText;
      results[currentSubheading] = {};
    }
    const testTitle = row.querySelector('td.tooltipParent div');
    if (testTitle) {
      const rowResults = row.querySelectorAll('td img.dataPoint').map(node => node._attrs.class.replace('dataPoint', '').trim());
      if (browserNames.length !== rowResults.length) {
        throw new Error("browser names don't match result columns");
      }
      const resultObject = zipObject(browserNames, rowResults);
      results[currentSubheading][testTitle.innerText] = resultObject;
    }
  }
  return results;
};

const readDataFromPage = async (pathOrURL) => {
  const content = await slurp(pathOrURL);
  const nodes = parse(content);
  const issueNumber = readIssueNumberFromNodes(nodes);
  const browserVersions = readBrowserVersionsFromNodes(nodes);
  const browserNames = Object.keys(browserVersions);
  const results = readResultsFromNodes(nodes, browserNames);
  return { issueNumber, browserNames, results };
};

const comparePages = async (pathOrURL1, pathOrURL2) => {
  const [results1, results2] = await Promise.all([
    readDataFromPage(pathOrURL1), readDataFromPage(pathOrURL2)
  ]);
  return jsonDiff.diff(results1, results2);
};

const printComparison = async (inputFiles1, inputFiles2) => {
  const results = await comparePages(inputFiles1, inputFiles2);
  console.log(JSON.stringify(results, undefined, "  "));
};

const main = () => {
  const { _: inputFiles } = minimist(process.argv.slice(2));
  if (inputFiles[0] === undefined) {
    console.log("Please provide a path to check.");
  }
  if (inputFiles[1] === undefined) {
    inputFiles.unshift(`https://privacytests.org/${path.basename(inputFiles[0])}`);
  }
  printComparison(inputFiles[0], inputFiles[1]);
};

if (require.main === module) {
  main();
}

module.exports = { comparePages };
