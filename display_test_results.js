const run_and_display_all_tests = async function (testResultsDiv) {
  let results = await run_all_tests();
  console.log(results);
  for (let { expression, spoof_expression, actual_value, desired_value, passed }  of results) {
    const div = document.createElement("div");
    div.innerText = `${passed ? "PASS" : "FAIL"}: ${expression} [${actual_value}, ${desired_value}]`;
    div.setAttribute("class", passed ? "test_pass" : "test_fail");
    if (passed) {
      testResultsDiv.appendChild(div);
    } else {
      testResultsDiv.insertBefore(div, testResultsDiv.childNodes[0]);
    }
  }
};

run_and_display_all_tests(document.getElementById("test_results"));

