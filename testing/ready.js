// Imports
const fs = require('fs');
const { execSync } = require('child_process');

// Constants
const allowedSuffixes = [".html", ".json", ".png"];
const indexPath = "out/";

// Ensure a directory exists.
const createDir = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {options: {recursive: true}});
  }
};

// Copy files with given suffixes from src to dest.
const copyDirFiles = (src, dest, suffixes) => {
  const files = fs.readdirSync(src);
  for (let file of files) {
    if (suffixes.some(suffix => file.endsWith(suffix))) {
      fs.copyFileSync(`${src}/${file}`, `${dest}/${file}`);
    }
  }
};

// Copy files to archive and main directory for publishing.
const copyPublishableFiles = (resultsPath) => {
  const versionNumber = fs.readFileSync("issue-number").toString().trim();
  const archivePath = `out/archive/issue${versionNumber}`;
  console.log(versionNumber);
  createDir(archivePath);
  const files = fs.readdirSync(resultsPath);
  copyDirFiles(resultsPath, archivePath, allowedSuffixes);
  copyDirFiles(resultsPath, indexPath, allowedSuffixes);
};

// Add files in path with given suffixes to git (but don't commit yet)
const gitAddFiles = (path, suffixes) => {
  const wildcards = ["",...suffixes].join(" *");

  execSync(`git add ${wildcards}`, {cwd: path});
};

// The main function. Copy publishable files, and add them to git.
const main = () => {
  const resultsPath = "out/results/20220422";
  copyPublishableFiles(resultsPath);
  gitAddFiles(resultsPath, allowedSuffixes);
  gitAddFiles(indexPath, allowedSuffixes);
};

main();