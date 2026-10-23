// Merge per-browser result JSON files from a directory and render summary pages.
//
// Results are named:
//   <browser>[-private]-<repetition>.json
//   android-<browser>-<repetition>.json
//   ios-<browser>-<repetition>.json
//   chrome[-<extension-slug>]-<repetition>.json   (extensions page)
//
// Desktop examples:
//   tor-nightly-1.json          -> nightly
//   tor-nightly-private-1.json  -> nightly-private
//   brave-1.json                -> index
//   brave-private-1.json        -> private
//
// Extensions (all files -> one page):
//   node render-multiple --dir=../artifacts --pages=extensions --out-dir=..
//
// Usage: node render-multiple --dir=../artifacts [--out-dir=..] [--pages=...]

const fs = require('fs');
const path = require('node:path');
const minimist = require('minimist');
const { groupBy, maxBy } = require('lodash');
const { render } = require('./render');

const PAGE_NAMES = [
  'index',
  'private',
  'nightly',
  'nightly-private',
  'android',
  'ios'
];

const walkJsonFiles = (dir) => {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJsonFiles(fullPath));
    } else if (entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
};

// Parse "<optional-platform-><browser>[-private]-<rep>" into a summary page name.
const pageFromBasename = (basename) => {
  if (basename.startsWith('android-')) {
    return 'android';
  }
  if (basename.startsWith('ios-')) {
    return 'ios';
  }
  // Strip trailing repetition: brave-private-1 -> brave-private
  let browser = basename.replace(/-\d+$/, '');
  const isPrivate = browser.endsWith('-private');
  if (isPrivate) {
    browser = browser.slice(0, -'-private'.length);
  }
  const isNightly = browser.includes('nightly');
  if (isPrivate) {
    return isNightly ? 'nightly-private' : 'private';
  }
  return isNightly ? 'nightly' : 'index';
};

const bucketFiles = (jsonFiles) => {
  const buckets = Object.fromEntries(PAGE_NAMES.map(name => [name, []]));
  for (const filePath of jsonFiles) {
    const page = pageFromBasename(path.basename(filePath, '.json'));
    if (page) {
      buckets[page].push(filePath);
    }
  }
  return buckets;
};

const mergeResultsFiles = (files) => {
  const items = files.map(filePath => JSON.parse(fs.readFileSync(filePath, 'utf8')));
  const merged = items[0];
  for (const item of items.slice(1)) {
    merged.all_tests = merged.all_tests.concat(item.all_tests);
  }
  return merged;
};

// Per browser, keep only the most common reportedVersion (drops mid-run updates).
const removeMinorityVersions = (files) => {
  const parsed = files.map(filePath => {
    const test = JSON.parse(fs.readFileSync(filePath, 'utf8')).all_tests[0];
    return {
      filePath,
      key: [
        test.browser,
        test.tor ? 'tor' : '',
        test.extension || ''
      ].filter(Boolean).join('-'),
      version: test.reportedVersion
    };
  });
  return Object.values(groupBy(parsed, 'key')).flatMap(entries => {
    const byVersion = groupBy(entries, 'version');
    const best = maxBy(Object.keys(byVersion), v => byVersion[v].length);
    if (Object.keys(byVersion).length > 1) {
      console.log(`removeMinorityVersions ${entries[0].key}: keeping ${byVersion[best].length}× ${best}`);
    }
    return byVersion[best].map(e => e.filePath);
  });
};

const renderPageFromFiles = async ({ name, files, outDir, aggregate }) => {
  if (files.length === 0) {
    throw new Error(`No JSON files found for ${name}`);
  }
  console.log(`Rendering ${name} from ${files.length} file(s)`);
  const outJson = path.join(outDir, `${name}.json`);
  fs.writeFileSync(outJson, JSON.stringify(mergeResultsFiles(files)));
  await render({ dataFiles: [outJson], aggregate });
};

const main = async () => {
  const { dir, 'out-dir': outDir, aggregate, pages } = minimist(process.argv.slice(2), {
    default: { 'out-dir': '..', aggregate: true },
    string: ['dir', 'out-dir', 'pages']
  });
  if (!dir) {
    throw new Error('Required: --dir=path/to/artifacts');
  }
  // Extensions workflow: every result file goes on one comparison page.
  if (pages === 'extensions') {
    await renderPageFromFiles({
      name: 'extensions',
      files: removeMinorityVersions(walkJsonFiles(dir)),
      outDir,
      aggregate: aggregate === true
    });
    return;
  }
  const buckets = bucketFiles(walkJsonFiles(dir));
  for (const name of PAGE_NAMES) {
    if (buckets[name].length === 0) {
      console.log(`Skipping ${name}: no result files`);
      continue;
    }
    await renderPageFromFiles({
      name,
      files: removeMinorityVersions(buckets[name]),
      outDir,
      aggregate: aggregate === true
    });
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { bucketFiles, pageFromBasename, walkJsonFiles, removeMinorityVersions, PAGE_NAMES };
