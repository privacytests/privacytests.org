const fs = require('fs');

// Main program. Usage:
// `node delete out/results/20220422/nightly.json brave 1.39`
const main = () => {
  const [inputFile, indexString] = process.argv.slice(2);
  const inputObject = JSON.parse(fs.readFileSync(inputFile).toString());
  delete inputObject.all_tests[parseInt(indexString)];
  inputObject.all_tests = inputObject.all_tests.filter(test => test);
  fs.copyFileSync(inputFile, inputFile + '.original');
  fs.writeFileSync(inputFile, JSON.stringify(inputObject));
};

main();
