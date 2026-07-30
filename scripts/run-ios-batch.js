// Run iOS privacy tests for a list of browsers with repeats, then merge
// results and render a single ios.html page.
//
// Usage (from scripts/):
//   node run-ios-batch
//   node run-ios-batch --browsers=safari,chrome,firefox --repeats=5
//   node run-ios-batch --out-dir=../artifacts/ios --skip-render
//
// Requires Appium on port 4723 and a connected iOS device.

const fs = require('fs');
const path = require('node:path');
const { spawnSync } = require('child_process');
const minimist = require('minimist');
const { render } = require('./render');

const DEFAULT_BROWSERS = [
  'brave',
  'chrome',
  'duckduckgo',
  'edge',
  'firefox',
  'focus',
  'safari',
  'vivaldi',
  'onion'
];

const PASSTHROUGH_FLAGS = ['categories', 'skip', 'hurry', 'debug', 'incognito'];

const parseArgs = () => {
  const args = minimist(process.argv.slice(2), {
    default: {
      repeats: 5,
      'out-dir': '../artifacts/ios',
      'skip-render': false
    },
    string: ['browsers', 'out-dir', 'categories', 'skip'],
    boolean: ['skip-render', 'hurry', 'debug', 'incognito']
  });
  if (args._.length > 0) {
    throw new Error(`Unexpected argument: ${args._[0]}. Use flags only.`);
  }
  const browsers = args.browsers
    ? String(args.browsers).split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_BROWSERS;
  const repeats = Number(args.repeats);
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error('--repeats must be a positive integer');
  }
  const extraFlags = [];
  for (const key of PASSTHROUGH_FLAGS) {
    const value = args[key];
    if (value === true) {
      extraFlags.push(`--${key}`);
    } else if (typeof value === 'string' && value.length > 0) {
      extraFlags.push(`--${key}=${value}`);
    }
  }
  return {
    browsers,
    repeats,
    outDir: args['out-dir'],
    skipRender: args['skip-render'] === true,
    extraFlags
  };
};

const runOne = ({ browser, outPath, extraFlags }) => {
  const cmdArgs = [
    'test',
    '--ios',
    `--browser=${browser}`,
    `--out=${outPath}`,
    ...extraFlags
  ];
  console.log(`\n=== ${browser} -> ${outPath} ===`);
  const result = spawnSync(process.execPath, cmdArgs, {
    cwd: __dirname,
    stdio: 'inherit'
  });
  return result.status === 0;
};

const mergeResultsFiles = (files, outPath) => {
  if (files.length === 0) {
    throw new Error(`No result JSON files found to merge`);
  }
  const merged = JSON.parse(fs.readFileSync(files[0], 'utf8'));
  for (const filePath of files.slice(1)) {
    const item = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    merged.all_tests = merged.all_tests.concat(item.all_tests);
  }
  fs.writeFileSync(outPath, JSON.stringify(merged));
  console.log(`Merged ${files.length} file(s), ${merged.all_tests.length} trial(s) -> ${outPath}`);
  return outPath;
};

const main = async () => {
  const { browsers, repeats, outDir, skipRender, extraFlags } = parseArgs();
  fs.mkdirSync(outDir, { recursive: true });

  const failures = [];
  const writtenFiles = [];
  for (const browser of browsers) {
    for (let i = 1; i <= repeats; i++) {
      const outPath = path.join(outDir, `${browser}-${i}.json`);
      const ok = runOne({ browser, outPath, extraFlags });
      if (!ok) {
        failures.push(`${browser} repeat ${i}`);
        console.error(`FAILED: ${browser} repeat ${i}`);
      } else if (fs.existsSync(outPath)) {
        writtenFiles.push(outPath);
      }
    }
  }

  if (writtenFiles.length === 0) {
    throw new Error('No successful result files written; nothing to render.');
  }

  const mergedPath = path.join(outDir, 'ios.json');
  mergeResultsFiles(writtenFiles, mergedPath);

  if (!skipRender) {
    await render({ dataFiles: [mergedPath], aggregate: true });
  }

  if (failures.length > 0) {
    console.error(`\nCompleted with ${failures.length} failure(s):`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log(`\nDone. ${browsers.length} browser(s) × ${repeats} repeat(s).`);
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
