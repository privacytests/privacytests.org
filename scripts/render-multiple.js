// Merge per-browser result JSON files from a directory and render the four
// desktop summary pages: index, private, nightly, nightly-private.
//
// Usage: node render-multiple --dir=../artifacts [--out-dir=..]

const fs = require('fs');
const path = require('node:path');
const minimist = require('minimist');
const { render } = require('./render');

const PAGE_NAMES = ['index', 'private', 'nightly', 'nightly-private'];

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

const pageForBasename = (basename) => {
  const isPrivate = basename.endsWith('-incognito') || basename.endsWith('-tor');
  const isNightly = basename.includes('nightly');
  if (isPrivate && isNightly) {
    return 'nightly-private';
  }
  if (isPrivate) {
    return 'private';
  }
  if (isNightly) {
    return 'nightly';
  }
  return 'index';
};

const bucketFiles = (jsonFiles) => {
  const buckets = Object.fromEntries(PAGE_NAMES.map(name => [name, []]));
  for (const filePath of jsonFiles) {
    const basename = path.basename(filePath, '.json');
    buckets[pageForBasename(basename)].push(filePath);
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

module.exports = { bucketFiles, pageForBasename, walkJsonFiles };
