const {Builder, By, Key, until} = require('selenium-webdriver');

(async function example() {
  let driver = await new Builder()
      .forBrowser('firefox')
      .build();
  try {
    await driver.get('https://arthuredelstein.github.io/resist-fingerprinting-js/test_unprotected.html');
//    await driver.get('file:///home/arthur/resist-fingerprinting-js/test_unprotected.html');
    let body = await driver.findElement(By.tagName('body'));
    let testResultsString = await driver.wait(async () => {
      return await body.getAttribute("data-test-results");
    });
    let testResultsObject = JSON.parse(testResultsString);
    console.log(testResultsObject);
    console.log(`${testResultsObject.length} items found.`);
  } finally {
    await driver.quit();
  }
})();
