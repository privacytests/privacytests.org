const fs = require('fs');
const marked = require("marked");
const htmlUtils = require('./html-utils.js');

const wrapCopy = (content) => `
  <div class="copy">${content}</div>
`;

const generateFile = (filename) => {
  const copy = fs.readFileSync(`copy/${filename}`, "utf8");
  const newFilename = filename.replace(".md", ".html");
  const htmlOutput = htmlUtils.htmlPage( {
    title: "PrivacyTests.org",
    content: wrapCopy(marked(copy))
  });
  console.log(htmlOutput);
  fs.writeFileSync(`out/${newFilename}`, htmlOutput, "utf8");
};

const main = async () => {
  generateFile("about.md");
};

main();