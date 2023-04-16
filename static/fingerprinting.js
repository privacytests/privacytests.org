/* eslint-disable camelcase */
/* eslint-env browser */

// TODO: Let's do the following:
// 1. Write each test such that the test can be printed in a string, which
//    is then evaluated and checked against a predicted value.
// 2. Have a single run_all_tests() function that returns the results in JSON.
// 3. Create a separate script that takes the results and
//    displays them on test.html or test_browser.html.
//
//  The tests can be written first, such that they define the
//  fingerprinting vectors we are trying to mitigate. "TDD". The tests
//  can be useful for browser makers to patch their browsers. Also
//  we can potentially make an automated scorecard using browserstack.com.

/* jshint evil: true */

const dual_tests = function dual_tests () {
  const performance_now_tests = [
    //  [`performance.now()`,
    //   `Math.floor(performance.now() / 100) * 100`],
  ];

  // ## Intl object

  const dual_navigator_tests = [
    //  [`navigator.hardwareConcurrency`, 2],
  ];

  const event_tests = [
    //  [`new Event("test").timeStamp % 100`, `0`],
  ];

  const evaluate = (script) => {
    if (typeof script === 'function') {
      return script();
    } else {
      return eval(script); // eslint-disable-line no-eval
    }
  };

  const test_pairs = (pairs) => pairs.map(
    ({
      name, expression, desired_expression, description,
      desired_min, desired_max
    }) => {
      let actual_value, desired_value;
      let failure = false;
      let passed = false;
      let desired_min_value;
      let desired_max_value;
      try {
        actual_value = evaluate(expression);
      } catch (e) {
        actual_value = e.message;
        failure = true;
        console.log(e);
      }
      if (desired_value !== undefined) {
        try {
          desired_value = evaluate(desired_expression);
        } catch (e) {
          desired_value = e.message;
          failure = true;
          console.log(e);
        }
        passed = !failure && (actual_value === desired_value);
      } else if (desired_min !== undefined && desired_max !== undefined) {
        try {
          desired_min_value = evaluate(desired_min);
          desired_max_value = evaluate(desired_max);
          passed = actual_value >= desired_min_value &&
                          actual_value <= desired_max_value;
        } catch (e) {
          desired_value = e.message;
          failure = true;
          console.log(e);
        }
      }
      return {
        name,
        expression,
        desired_expression,
        actual_value,
        desired_value,
        desired_min,
        desired_max,
        passed,
        description,
        desired_min_value,
        desired_max_value
      };
    });

  const run_all_tests = function () {
    return [].concat(
      test_pairs(dual_navigator_tests),
      test_pairs(performance_now_tests),
      test_pairs(event_tests)
    );
  };

  // end dual_tests function
  return {
    test_results: run_all_tests(),
    test_pairs: self.Window ? test_pairs : undefined
  };
};

const window_property_tests = [
  {
    description: 'Position, in pixels, of the left edge of the browser window on screen.',
    expression: 'screenX',
    desired_min: 0,
    desired_max: 10
  },
  {
    description: 'Position, in pixels, of the top edge of the browser window on screen.',
    expression: 'screenY',
    desired_min: 0,
    desired_max: 10
  },
  {
    description: 'Height of the browser window in pixels, including browser chrome.',
    expression: 'outerHeight',
    desired_min: 'innerHeight - 10',
    desired_max: 'innerHeight + 10'
  }
];

const integerFromMediaQuery = (key, unit, maxValue) => {
  for (let i = 0; i <= maxValue; ++i) {
    if (window.matchMedia(`(${key}: ${i}${unit})`).matches) {
      return i;
    }
  }
  return undefined;
};

const screen_tests = [
  {
    description: "Width of the user's screen, in pixels.",
    expression: 'screen.width',
    desired_min: 'innerWidth - 10',
    desired_max: 'innerWidth + 10'
  },
  {
    description: "Height of the user's screen, in pixels.",
    expression: 'screen.height',
    desired_min: 'innerHeight - 10',
    desired_max: 'innerHeight + 10'
  },
  {
    description: "Width of the user's screen in pixels.",
    name: 'Media query screen width',
    expression: () => integerFromMediaQuery('device-width', 'px', 5000),
    desired_min: 'innerWidth - 10',
    desired_max: 'innerWidth + 10'
  },
  {
    description: "Height of the user's screen in pixels.",
    name: 'Media query screen height',
    expression: () => integerFromMediaQuery('device-height', 'px', 5000),
    desired_min: 'innerHeight - 10',
    desired_max: 'innerHeight + 10'
  }
];

const navigator_tests = [
//  [`navigator.buildID === undefined || navigator.buildID === "20181001000000"`, true],
//  [`navigator.getBattery`, undefined],
/*  [`try {
      navigator.getBattery();
      true;
    } catch (e) {
      false;
   }`,
   `false`], */
//  [`navigator.mimeTypes.length`, 0],
//  [`navigator.plugins.length`, 0],
];

const mouse_event_tests = [
//  [`mouseEvent.screenX`, `mouseEvent.clientX`],
//  [`mouseEvent.screenY`, `mouseEvent.clientY`],
//  [`mouseEvent.timeStamp % 100`, `0`],
];

const run_in_worker = function (aFunction) {
  return new Promise(resolve => {
    const worker = new Worker(
      URL.createObjectURL(
        new Blob([
          `postMessage((${aFunction.toString()})())`
        ])
      )
    );
    worker.onmessage = msg => resolve(msg.data);
  });
};

const list_to_map = (list, keyFn) => {
  const obj = {};
  for (const item of list) {
    const key = keyFn(item);
    obj[key] = item;
  }
  return obj;
};

const run_all_tests = async function () {
  // window.mouseEvent = await new Promise((resolve, reject) => document.addEventListener("click", resolve, {once:true}));

  const { test_pairs, test_results } = dual_tests();
  const { test_results: test_results_worker } = await run_in_worker(dual_tests);
  test_results_worker.map(t => Object.assign(t, { worker: true }));
  // eval(prelude);
  const all_tests = test_results.concat(
    ...test_results_worker,
    test_pairs(window_property_tests),
    test_pairs(navigator_tests),
    test_pairs(screen_tests),
    test_pairs(mouse_event_tests)
  );
  return list_to_map(all_tests,
    x => x.name ?? (x.expression + (x.worker ? ' [Worker]' : '')));
};
