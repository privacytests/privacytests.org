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
  [`Navigator.prototype.__lookupGetter__("hardwareConcurrency")
   .call(navigator)`, 2],
  [`navigator.language`, `"en-US"`],
  [`Navigator.prototype.__lookupGetter__("language").call(navigator)`,
   `"en-US"`],
  [`navigator.languages.toString()`, `"en-US,en"`],
  [`Navigator.prototype.__lookupGetter__("languages")
   .call(navigator).toString()`,
   `"en-US,en"`],
  [`navigator.mimeTypes.length`, 0],
  [`navigator.plugins.length`, 0],
  [`Object.keys(navigator.mimeTypes).length`, 0],
  [`Object.keys(navigator.plugins).length`, 0],
  [`navigator.mimeTypes[0]`, undefined],
  [`navigator.plugins[0]`, undefined],
  [`Navigator.prototype.__lookupGetter__("plugins").call(navigator).length`,
   0],
  [`Navigator.prototype.__lookupGetter__("mimeTypes").call(navigator).length`,
   0],
];

let date = new Date();

const date_tests = [
  [`date.getDate()`, `date.getUTCDate()`],
];

const test_pairs = function (pairs) {
  for (let [expression, desired_result] of pairs) {
    const expression_value = eval(expression);
    const desired_value = eval(desired_result);
    const pass = expression_value === desired_value;
    if (pass) {
      console.log(`PASS: ${expression} --> ${desired_result}`);
    } else {
      console.log(`FAIL: ${expression} [${expression_value}] is not ${desired_result} [${desired_value}]`);
    }
  }
};

const test_performance = function () {
  const now = performance.now();
  is_rounded_time(now, "performance.now() is rounded to nearest 100 ms.");
  const now2 = Performance.prototype.now.apply(performance);
  is_rounded_time(now2, "performance.now() via prototype is rounded to nearest 100 ms.");
};

const test_window_properties = function () {
  is(window.screenX, 0, "screenX is 0.");
  is(window.screenY, 0, "screenY is 0.");
  is(window.outerWidth, window.innerWidth,
     "window.outerWidth spoofed to innerWidth");
  is(window.outerHeight, window.innerHeight,
     "window.outerHeight spoofed to innerHeight");
  is(window.devicePixelRatio, 1, "devicePixelRatio spoofed to 1");
};

const test_mouse_event = function () {
  const clientX = 10, clientY = 20;
  const event = new MouseEvent("click", { clientX, clientY });
  is(event.screenX, clientX, "MouseEvent.screenX matches .clientX");
  is(event.screenY, clientY, "MouseEvent.screenY matches .clientY");
  is_rounded_time(event.timeStamp, "MouseEvent.timeStamp is rounded");
};

const test_navigator = function () {
  is(navigator.buildID, "20100101", "spoof navigator.buildID");
  is(navigator.getBattery, undefined, "No battery API available.");
  try {
    navigator.getBattery()
    is(true, false, "Battery API found.");
  } catch (e) {
    is(true, true, "No battery API available.");
  }
  is(navigator.hardwareConcurrency, 2, "hardwareConcurrency spoofed.");
  is(navigator.language, "en-US", "spoof navigator.language");
  is(navigator.languages, "en-US,en", "spoof navigator.languages");
};

const test_mimeTypes = function () {
  is(navigator.mimeTypes.length, 0, "mimeTypes is empty");
  is(navigator.plugins.length, 0, "plugins is empty");
  is(Object.keys(navigator.mimeTypes).length, 0, "mimeTypes has zero keys");
  is(Object.keys(navigator.plugins).length, 0, "plugins has zero keys");
  is(navigator.mimeTypes[0], undefined,
     "no element found at index 0 of mimeTypes");
  is(navigator.plugins[0], undefined,
     "no element found at index 0 of plugins");
};

const testResultsDiv = document.getElementById("test_results");

const is = function(a, b, description) {
  const div = document.createElement("div");
  const pass = (a === b);
  div.innerText = `${pass ? "PASS" : "FAIL"}: ${description} ${JSON.stringify([a, b])}`;
  div.setAttribute("class", pass ? "test_pass" : "test_fail");
  if (pass) {
    testResultsDiv.appendChild(div);
  } else {
    testResultsDiv.insertBefore(div, testResultsDiv.childNodes[0]);
  }
}

const is_rounded_time = function (t, description) {
  is(100 * Math.round(t/100), t, description);
};

const run_tests = async function () {
  test_pairs(window_property_tests);
  test_pairs(navigator_tests);
  test_pairs(screen_tests);
  test_pairs(performance_timing_tests);
  test_pairs(date_tests);
  test_performance();
  test_window_properties();
  test_mouse_event();
  test_navigator();
  test_mimeTypes();
};



run_tests();

