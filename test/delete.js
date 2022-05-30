const fs = require('fs');

// Main program. Usage:
// `node delete out/results/20220422/nightly.json brave 1.39`
const main = () => {
  const [inputFile, browser, shortVersion] = process.argv.slice(2);
  const inputObject = JSON.parse(fs.readFileSync(inputFile).toString());
  inputObject.all_tests = inputObject.all_tests.filter(test => !(test.browser === browser && test.reportedVersion.startsWith(shortVersion)));
  fs.copyFileSync(inputFile, inputFile + ".original");
  fs.writeFileSync(inputFile, JSON.stringify(inputObject));
};

main();