// Imports
const fs = require('fs');
const path = require('node:path');
const { execSync } = require('child_process');
const { compareAndCheck } = require('./check.js');
const minimist = require('minimist');

// Constants
const allowedSuffixes = ['.html', '.json', '.png'];

// Ensure a directory exists.
const createDir = (path) => {
  if (!fs.existsSync(path)) {
    console.log(`creating directory ${path}`);
    fs.mkdirSync(path, { options: { recursive: true } });
  } else {
    console.log(`directory found: ${path}`);
  }
};

// Copy a file from src dir to dest dir.
const copyFile = (src, dest, file) => {
  fs.copyFileSync(`${src}/${file}`, `${dest}/${file}`);
  console.log(`copied ${src}/${file} to ${dest}/${file}`);
};

// `git add` a file in given directory.
const gitAdd = (dir, filename) => {
  const command = `git add ${filename}`;
  execSync(command, { cwd: dir });
  console.log(command);
};

// Copy files with given suffixes from src dir to dest dir
// and `git add` them.
const copyDirFilesAndGitAdd = (src, dest, suffixes) => {
  const files = fs.readdirSync(src);
  for (const file of files) {
    if (suffixes.some(suffix => file.endsWith(suffix))) {
      copyFile(src, dest, file);
      gitAdd(dest, file);
    }
  }
};

const shortVersion = (version) =>
  version.split('.').slice(0, 2).join('.');

const titleCase = (str) => str.replace(/(^|\s)\S/g, t => t.toUpperCase());

const readBrowserVersions = (issueNumber) => {
  const platformToDataFile = {
    desktop: 'index.json',
    ios: 'ios.json',
    android: 'android.json'
  };
  const browserVersions = {};
  for (const platform of Object.keys(platformToDataFile)) {
    const file = platformToDataFile[platform];
    const data = JSON.parse(fs.readFileSync(`../website/archive/issue${issueNumber}/${file}`));
    browserVersions[platform] = {};
    for (const test of data.all_tests) {
      if (test && test.browser !== undefined) {
        browserVersions[platform][test.browser] = shortVersion(test.reportedVersion);
      }
    }
  }
  return browserVersions;
};

const diffBrowserVersions = (issueNumber1, issueNumber2) => {
  const versions1 = readBrowserVersions(issueNumber1);
  const versions2 = readBrowserVersions(issueNumber2);
  console.log(versions1, versions2);
  const finalDiff = {};
  for (const platform of Object.keys(versions1)) {
    const newVersions = {};
    const results1 = versions1[platform];
    const results2 = versions2[platform];
    for (const browser of Object.keys(results2)) {
      if (results2[browser] !== results1[browser]) {
        newVersions[browser] = results2[browser];
      }
    }
    finalDiff[platform] = newVersions;
  }
  return finalDiff;
};

const diffBrowserLists = (issueNumber1, issueNumber2) => {
  const diffBrowsers = diffBrowserVersions(issueNumber1, issueNumber2);
  const results = {};
  for (const platform of ['desktop', 'ios', 'android']) {
    let lines = '';
    for (const browser of Object.keys(diffBrowsers[platform]).sort()) {
      lines += `* ${titleCase(browser)} ${diffBrowsers[platform][browser]}\n`;
    }
    results[platform] = lines;
  }
  return results;
};

const latestNews = ({ issueNumber, date, desktop, ios, android }) => {
  const formattedDate =
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  let latestNewsString = `## [Issue ${issueNumber}](/archive/issue${issueNumber}): ${formattedDate}\n\n`;
  if (desktop.length > 0 || android.length > 0 || ios.length > 0) {
    latestNewsString += '### New browser versions\n\n';
  }
  if (desktop.length > 0) {
    latestNewsString += `On Desktop:\n${desktop}\n`;
  }
  if (ios.length > 0) {
    latestNewsString += `On iOS:\n${ios}\n`;
  }
  if (android.length > 0) {
    latestNewsString += `On Android:\n${android}\n`;
  }
  return latestNewsString;
};

const getLastIssueNumber = (newsCopy) => {
  const re = /## \[Issue (\S+)\]/g;
  const results = [...newsCopy.matchAll(re)];
  return results.map(r => r[1])[0];
};

const updateNewsCopy = ({ issueNumber, date }) => {
  const newsCopyFile = path.join(__dirname, '/../assets/copy/news.md');
  const newsCopy = fs.readFileSync(newsCopyFile).toString();
  const lastIssueNumber = getLastIssueNumber(newsCopy);
  console.log({ issueNumber, lastIssueNumber });
  if (lastIssueNumber === issueNumber) {
    // We already have an entry for this issue; don't add anything.
    return;
  }
  const { desktop, android, ios } = diffBrowserLists(lastIssueNumber, issueNumber);
  const newNewsCopy = newsCopy.replace('# News\n', '# News\n' + latestNews({ issueNumber, date, desktop, android, ios }));
  fs.writeFileSync(newsCopyFile, newNewsCopy);
};

// The main function. Copy publishable files, and add them to git.
const main = async () => {
  const { _: mainArguments, force } = minimist(process.argv.slice(2));
  const date = mainArguments[0].toString();
  if (date === undefined) {
    throw new Error("please enter a date");
  }
  await compareAndCheck(date, force);
  const indexPath = '../website';
  const issueNumber = fs.readFileSync('issue-number').toString().trim();
  const archivePath = `../website/archive/issue${issueNumber}`;
  createDir(archivePath);
  const resultsPath = `../results/${date}`;
  copyDirFilesAndGitAdd(resultsPath, archivePath, allowedSuffixes);
  copyDirFilesAndGitAdd(resultsPath, indexPath, allowedSuffixes);
  updateNewsCopy({ issueNumber, date });
};

if (require.main === module) {
  main();
}