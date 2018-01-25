// TODO: Let's do the following:
// 1. Write each test such that the test can be printed in a string, which
//    is then evaluated and checked against a predicted value.
// 2. Have a single runAllTests() function that returns the results in JSON.
// 3. Create a separate script that takes the results and
//    displays them on test.html or test_browser.html.
//
//  The tests can be written first, such that they define the
//  fingerprinting vectors we are trying to mitigate. "TDD". The tests
//  can be useful for browser makers to patch their browsers. Also
//  we can potentially make an automated scorecard using browserstack.com.

const prelude = `
  window.mouseEvent = new MouseEvent("click", { clientX: 10, clientY: 20 });
  window.roundTime = t => Math.round(t / 100) * 100;
`;

const window_property_tests = [
  [`screenX`, 0],
  [`screenY`, 0],
  [`outerWidth`, `innerWidth`],
  [`outerHeight`, `innerHeight`],
  [`devicePixelRatio`, 1]
];

const performance_timing_tests = [
  [`performance.timing.connectEnd`, 0],
  [`performance.timing.connectStart`, 0],
  [`performance.timing.domComplete`, 0],
  [`performance.timing.domContentLoadedEventEnd`, 0],
  [`performance.timing.domContentLoadedEventStart`, 0],
  [`performance.timing.domInteractive`, 0],
  [`performance.timing.domLoading`, 0],
  [`performance.timing.domainLookupEnd`, 0],
  [`performance.timing.domainLookupStart`, 0],
  [`performance.timing.fetchStart`, 0],
  [`performance.timing.loadEventEnd`, 0],
  [`performance.timing.loadEventStart`, 0],
  [`performance.timing.navigationStart`, 0],
  [`performance.timing.redirectEnd`, 0],
  [`performance.timing.redirectStart`, 0],
  [`performance.timing.requestStart`, 0],
  [`performance.timing.responseEnd`, 0],
  [`performance.timing.responseStart`, 0],
  [`performance.timing.secureConnectionStart`, 0],
  [`performance.timing.unloadEventEnd`, 0],
  [`performance.timing.unloadEventStart`, 0],
];

const performance_now_tests = [
  [`performance.now()`,
   `Math.floor(performance.now() / 100) * 100`],
  [`Performance.prototype.now.apply(performance)`,
   `Math.floor(performance.now() / 100) * 100`],
];

const screen_tests = [
  [`screen.width`, `innerWidth`],
  [`screen.height`, `innerHeight`],
  [`Screen.prototype.__lookupGetter__("width").apply(screen)`,
   `innerWidth`],
  [`Screen.prototype.__lookupGetter__("height").apply(screen)`,
   `innerHeight`],
];

const navigator_tests = [
  [`navigator.buildID`, `"20100101"`],
  [`navigator.getBattery`, undefined],
  [`try {
      navigator.getBattery();
      true;
    } catch (e) {
      false;
   }`,
   `false`],
  [`navigator.hardwareConcurrency`, 2],
  [`navigator.language`, `"en-US"`],
  [`navigator.languages.toString()`, `"en-US,en"`],
  [`navigator.mimeTypes.length`, 0],
  [`navigator.plugins.length`, 0],
  [`Object.keys(navigator.mimeTypes).length`, 0],
  [`Object.keys(navigator.plugins).length`, 0],
  [`navigator.mimeTypes[0]`, undefined],
  [`navigator.plugins[0]`, undefined],
  [`Navigator.prototype.__lookupGetter__("plugins").call(navigator).length`, 0],
  [`Navigator.prototype.__lookupGetter__("mimeTypes").call(navigator).length`, 0],
];

// ## Date object

const date = new Date();
const date_tests = [
  [`date.getDate()`, `date.getUTCDate()`],
  [`date.getDay()`, `date.getUTCDay()`],
  [`date.getFullYear()`, `date.getUTCFullYear()`],
  [`date.getHours()`, `date.getUTCHours()`],
  [`date.getMilliseconds()`, `date.getUTCMilliseconds()`],
  [`date.getMinutes()`, `date.getUTCMinutes()`],
  [`date.getMonth()`, `date.getUTCMonth()`],
  [`date.getSeconds()`, `date.getUTCSeconds()`],
  [`Date.prototype.getDate.call(date)`, `date.getUTCDate()`],
  [`Date.prototype.getDay.call(date)`, `date.getUTCDay()`],
  [`Date.prototype.getFullYear.call(date)`, `date.getUTCFullYear()`],
  [`Date.prototype.getHours.call(date)`, `date.getUTCHours()`],
  [`Date.prototype.getMilliseconds.call(date)`, `date.getUTCMilliseconds()`],
  [`Date.prototype.getMinutes.call(date)`, `date.getUTCMinutes()`],
  [`Date.prototype.getMonth.call(date)`, `date.getUTCMonth()`],
  [`Date.prototype.getSeconds.call(date)`, `date.getUTCSeconds()`],
];

const mouse_event_tests = [
  [`mouseEvent.screenX`, `mouseEvent.clientX`],
  [`mouseEvent.screenY`, `mouseEvent.clientY`],
  [`mouseEvent.timeStamp`, `roundTime(mouseEvent.timeStamp)`],
];

const test_pairs = (pairs) => pairs.map(
  ([expression, spoof_expression]) => {
    const actual_value = eval(expression);
    const desired_value = eval(spoof_expression);
    const passed = actual_value === desired_value;
    return { expression, spoof_expression, actual_value, desired_value, passed };
  });

const testResultsDiv = document.getElementById("test_results");

const run_tests = async function () {
  eval(prelude);
  return [].concat(
    test_pairs(window_property_tests),
    test_pairs(navigator_tests),
    test_pairs(screen_tests),
    test_pairs(performance_now_tests),
    test_pairs(performance_timing_tests),
    test_pairs(date_tests),
    test_pairs(mouse_event_tests),
  );
};

const run_and_display_tests = async function () {
  let results = await run_tests();
  console.log(results);
  for (let { expression, spoof_expression, actual_value, desired_value, passed }  of results) {
    const div = document.createElement("div");
    div.innerText = `${passed ? "PASS" : "FAIL"}: ${expression} ${JSON.stringify([actual_value, desired_value])}`;
    div.setAttribute("class", passed ? "test_pass" : "test_fail");
    if (passed) {
      testResultsDiv.appendChild(div);
    } else {
      testResultsDiv.insertBefore(div, testResultsDiv.childNodes[0]);
    }
  }
};



run_and_display_tests();

