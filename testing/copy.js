const fs = require('fs');
const marked = require("marked");
const template = require('./template.js');

// Wraps content in a div element.
const wrapCopy = (content) => `
  <div class="copy">${content}</div>
`;

// Takes a Markdown filename in the "copy" directory
// and generates an HTML file in the "out" directory.
const generateHtmlFile = (filename) => {
  const copy = fs.readFileSync(`copy/${filename}`, "utf8");
  const newFilename = filename.replace(".md", ".html");
  const htmlOutput = template.htmlPage( {
    title: "Browser Privacy Tests",
    content: wrapCopy(marked(copy)),
    cssFiles: ["template.css"]
  });
//  console.log(htmlOutput);
  fs.writeFileSync(`out/${newFilename}`, htmlOutput, "utf8");
};

// The main program. Read all the Markdown files in the "copy" directory and
// generate an html file for each of them in the "out" directory.
const main = async () => {
  const filenames = fs.readdirSync("copy").filter(x => x.endsWith(".md"));
  for (let filename of filenames) {
    generateHtmlFile(filename);
  }
};

main();