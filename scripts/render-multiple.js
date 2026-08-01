// Merge per-browser result JSON files from a directory and render summary pages.
//
// Results are named:
//   <browser>[-private]-<repetition>.json
//   android-<browser>-<repetition>.json
//   ios-<browser>-<repetition>.json
//
// Desktop examples:
//   tor-nightly-1.json          -> nightly
//   tor-nightly-private-1.json  -> nightly-private
//   brave-1.json                -> index
//   brave-private-1.json        -> private
//
// Usage: node render-multiple --dir=../artifacts [--out-dir=..]

const fs = require('fs');
const path = require('node:path');
const minimist = require('minimist');
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
  if (basename.startsWith('android-'))
    return 'android';
  }
  if (basename.startsWith('ios-')) {
    return 'ios';
  }
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
  const { dir, 'out-dir': outDir, aggregate } = minimist(process.argv.slice(2), {
    default: { 'out-dir': '..', aggregate: true },
    string: ['dir', 'out-dir']
  });
  if (!dir) {
    throw new Error('Required: --dir=path/to/artifacts');
  }
  const buckets = bucketFiles(walkJsonFiles(dir));
  for (const name of PAGE_NAMES) {
    if (buckets[name].length === 0) {
      console.log(`Skipping ${name}: no result files`);
      continue;
    }
    await renderPageFromFiles({
      name,
      files: buckets[name],
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

module.exports = { bucketFiles, pageFromBasename, walkJsonFiles, PAGE_NAMES };
