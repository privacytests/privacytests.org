// Run privacy tests for a list of browsers with repeats, then merge
// results and render a single platform HTML page.
//
// Usage (from scripts/):
//   node run-batch --ios
//   node run-batch --android --browsers=chrome,firefox --repeats=5
//   node run-batch --browsers=chrome,firefox,safari --out-dir=../artifacts/desktop
//   node run-batch --ios --out-dir=../artifacts/ios --skip-render
//
// Mobile requires Appium on port 4723 and a connected device.

const fs = require('fs');
const path = require('node:path');
const { spawnSync } = require('child_process');
const minimist = require('minimist');
const { render } = require('./render');
const { macOSdefaultBrowserSettings } = require('./desktop-constants');

const DEFAULT_BROWSERS = {
  ios: [
    'brave',
    'chrome',
    'duckduckgo',
    'edge',
    'firefox',
    'focus',
    'safari',
    'vivaldi',
    'onion'
  ],
  android: [
    'brave',
    'chrome',
    'duckduckgo',
    'edge',
    'firefox',
    'focus',
    'opera',
    'samsung',
    'tor',
    'vivaldi',
    'yandex'
  ],
  desktop: Object.keys(macOSdefaultBrowserSettings)
};

const PASSTHROUGH_FLAGS = [
  'categories', 'skip', 'hurry', 'debug', 'incognito', 'nightly', 'browserstack', 'app-dir'
];

const KNOWN_FLAGS = new Set([
  'ios', 'android', 'browsers', 'repeats', 'out-dir', 'skip-render',
  ...PASSTHROUGH_FLAGS
]);

const parseArgs = () => {
  const args = minimist(process.argv.slice(2), {
    default: {
      repeats: 5,
      'skip-render': false
    },
    string: ['browsers', 'out-dir', 'categories', 'skip', 'app-dir'],
    boolean: [
      'ios', 'android', 'skip-render', 'hurry', 'debug', 'incognito', 'nightly', 'browserstack'
    ]
  });
  if (args._.length > 0) {
    throw new Error(`Unexpected argument: ${args._[0]}. Use flags only.`);
  }
  const unknownFlags = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key));
  if (unknownFlags.length > 0) {
    console.error(`Unknown flag(s): ${unknownFlags.map((f) => `--${f}`).join(', ')}`);
    process.exit(1);
  }
  if (args.ios && args.android) {
    throw new Error('Use only one of --ios or --android (omit both for desktop).');
  }

  const platform = args.ios ? 'ios' : (args.android ? 'android' : 'desktop');
  const platformFlag = args.ios ? '--ios' : (args.android ? '--android' : null);
  const outDir = args['out-dir'] || path.join('..', 'artifacts', platform);

  const browsers = args.browsers
    ? String(args.browsers).split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_BROWSERS[platform];
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
    platform,
    platformFlag,
    browsers,
    repeats,
    outDir,
    skipRender: args['skip-render'] === true,
    extraFlags
  };
};

const runOne = ({ browser, outPath, platformFlag, extraFlags }) => {
  const cmdArgs = [
    'test',
    ...(platformFlag ? [platformFlag] : []),
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
    throw new Error('No result JSON files found to merge');
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
  const {
    platform, platformFlag, browsers, repeats, outDir, skipRender, extraFlags
  } = parseArgs();
  fs.mkdirSync(outDir, { recursive: true });

  const failures = [];
  const writtenFiles = [];
  for (const browser of browsers) {
    for (let i = 1; i <= repeats; i++) {
      const outPath = path.join(outDir, `${browser}-${i}.json`);
      const ok = runOne({ browser, outPath, platformFlag, extraFlags });
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

  const mergedPath = path.join(outDir, `${platform}.json`);
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
  console.log(`\nDone. ${platform}: ${browsers.length} browser(s) × ${repeats} repeat(s).`);
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, parseArgs, DEFAULT_BROWSERS };
