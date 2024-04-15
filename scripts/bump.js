const { readCurrentIssueNumber} = require('./check.js');
const fs = require('node:fs/promises');

const maybeBumpIssueNumber = async () => {
  const publishedIssueNumber = (await readCurrentIssueNumber()).toString();
  const issueNumberFileContents = (await fs.readFile('issue-number')).toString().trim();
  console.log(`Published issue number: ${publishedIssueNumber}\nLocal issue number: ${issueNumberFileContents}`);
  if (publishedIssueNumber === issueNumberFileContents) {
    const lastIssueNumberInteger = parseInt(publishedIssueNumber);
    const newIssueNumber = (lastIssueNumberInteger + 1).toString();
    fs.writeFile('issue-number', `${newIssueNumber}\n`);
    console.log(`Bumped local issue number from ${issueNumberFileContents} to ${newIssueNumber}`)
  }
};

if (require.main === module) {
  maybeBumpIssueNumber();
}
