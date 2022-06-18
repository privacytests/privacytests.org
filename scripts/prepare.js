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

// Copy a file from src dir to dest dir.
const copyFile = (src, dest, file) => {
  fs.copyFileSync(`${src}/${file}`, `${dest}/${file}`);
  console.log(`copied ${src}/${file} to ${dest}/${file}`);
};

// `git add` a file in given directory.
const gitAdd = (dir, filename) => {
  const command = `git add ${filename}`;
  execSync(command, {cwd: dir});
  console.log(command);
}

// Copy files with given suffixes from src dir to dest dir
// and `git add` them.
const copyDirFilesAndGitAdd = (src, dest, suffixes) => {
  const files = fs.readdirSync(src);
  for (let file of files) {
    if (suffixes.some(suffix => file.endsWith(suffix))) {
      copyFile(src, dest, file);
      gitAdd(dest, file);
    }
  }
};

// The main function. Copy publishable files, and add them to git.
const main = () => {
  const indexPath = "../website";
  const versionNumber = fs.readFileSync("issue-number").toString().trim();
  console.log("version found:", versionNumber);
  const archivePath = `../website/archive/issue${versionNumber}`;
  createDir(archivePath);
  const date = process.argv[2]
  const resultsPath = `../results/${date}`;
  copyDirFilesAndGitAdd(resultsPath, archivePath, allowedSuffixes);
  copyDirFilesAndGitAdd(resultsPath, indexPath, allowedSuffixes);
};

main();
