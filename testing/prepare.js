// Imports
const fs = require('fs');
const { execSync } = require('child_process');

// Constants
const allowedSuffixes = [".html", ".json", ".png"];

// Ensure a directory exists.
const createDir = (path) => {
  if (!fs.existsSync(path)) {
    console.log(`creating directory ${path}`);
    fs.mkdirSync(path, {options: {recursive: true}});
  } else {
    console.log(`directory found: ${path}`);
  }
};

// Copy files with given suffixes from src to dest.
const copyDirFiles = (src, dest, suffixes) => {
  const files = fs.readdirSync(src);
  for (let file of files) {
    if (suffixes.some(suffix => file.endsWith(suffix))) {
      fs.copyFileSync(`${src}/${file}`, `${dest}/${file}`);
      console.log(`copied ${src}/${file} to ${dest}/${file}`);
    }
  }
};

// Copy files to archive and main directory for publishing.
const copyPublishableFiles = ({indexPath, archivePath, resultsPath}) => {
};

// Add files in path with given suffixes to git (but don't commit yet)
const gitAddFiles = (path, suffixes) => {
  const wildcards = ["",...suffixes].join(" *");
  const command = `git add ${wildcards}`;
  console.log(`In directory ${path}:`, command);
  execSync(command, {cwd: path});
};

// The main function. Copy publishable files, and add them to git.
const main = () => {
  const indexPath = "out";
  const versionNumber = fs.readFileSync("issue-number").toString().trim();
  console.log("version found:", versionNumber);
  const archivePath = `out/archive/issue${versionNumber}`;
  createDir(archivePath);
  const date = process.argv[2]
  const resultsPath = `out/results/${date}`;
  copyDirFiles(resultsPath, archivePath, allowedSuffixes);
  copyDirFiles(resultsPath, indexPath, allowedSuffixes);  
  gitAddFiles(resultsPath, allowedSuffixes);
  gitAddFiles(archivePath, allowedSuffixes);
  gitAddFiles(indexPath, allowedSuffixes);
};

main();
