// Download a Chrome Web Store extension and read a short display name
// and icon for results-table headers.

const fs = require('fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const datauri = require('datauri/sync');

const EXTENSION_ID_RE = /^[a-p]{32}$/;
const STORE_CRX_URL = (extensionId, prodVersion = '131.0.0.0') =>
  'https://clients2.google.com/service/update2/crx' +
  `?response=redirect&prodversion=${prodVersion}` +
  '&acceptformat=crx2,crx3' +
  `&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;

const cacheRoot = () =>
  path.join(os.tmpdir(), 'privacytests.org', 'extension-render');

const validateExtensionId = (extensionId) => {
  const id = String(extensionId || '').trim();
  if (!EXTENSION_ID_RE.test(id)) {
    throw new Error(
      `Invalid extension id "${extensionId}". Expected a 32-letter Chrome Web Store id.`);
  }
  return id;
};

// CRX2/CRX3 = magic "Cr24" + header, then a ZIP payload.
const crxToZipBuffer = (crxBuffer) => {
  if (crxBuffer.length < 16 || crxBuffer.toString('utf8', 0, 4) !== 'Cr24') {
    if (crxBuffer.toString('utf8', 0, 2) === 'PK') {
      return crxBuffer;
    }
    throw new Error('Downloaded file is not a CRX or ZIP');
  }
  const version = crxBuffer.readUInt32LE(4);
  let zipStart;
  if (version === 2) {
    const pubKeyLen = crxBuffer.readUInt32LE(8);
    const sigLen = crxBuffer.readUInt32LE(12);
    zipStart = 16 + pubKeyLen + sigLen;
  } else if (version === 3) {
    const headerSize = crxBuffer.readUInt32LE(8);
    zipStart = 12 + headerSize;
  } else {
    throw new Error(`Unsupported CRX version: ${version}`);
  }
  return crxBuffer.subarray(zipStart);
};

const unpackDir = (extensionId) =>
  path.join(cacheRoot(), extensionId, 'unpacked');

const downloadAndUnpack = async (extensionId) => {
  const id = validateExtensionId(extensionId);
  const dir = unpackDir(id);
  const manifestPath = path.join(dir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    return dir;
  }

  await fsPromises.mkdir(path.dirname(dir), { recursive: true });
  console.log(`extension-render: downloading ${id}`);
  const response = await fetch(STORE_CRX_URL(id), { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download extension ${id}: HTTP ${response.status}`);
  }
  const zipBuffer = crxToZipBuffer(Buffer.from(await response.arrayBuffer()));
  const zipPath = path.join(path.dirname(dir), `${id}.zip`);
  await fsPromises.writeFile(zipPath, zipBuffer);
  await fsPromises.rm(dir, { recursive: true, force: true });
  await fsPromises.mkdir(dir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', dir]);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Unpacked extension missing manifest.json at ${dir}`);
  }
  return dir;
};

const readLocaleMessage = (unpacked, messageName, locale = 'en_US') => {
  const candidates = [
    path.join(unpacked, '_locales', locale, 'messages.json'),
    path.join(unpacked, '_locales', 'en', 'messages.json'),
    path.join(unpacked, '_locales', 'en_GB', 'messages.json')
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entry = messages[messageName];
    if (entry?.message) {
      return entry.message;
    }
  }
  return null;
};

const resolveManifestString = (unpacked, value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.match(/^__MSG_([A-Za-z0-9_]+)__$/);
  if (!match) {
    return value;
  }
  return readLocaleMessage(unpacked, match[1]) || value;
};

// Prefer an explicit short_name; otherwise use the store name and drop a
// long subtitle after " - " / " – " / ":".
const shortDisplayName = (name, shortName) => {
  const preferred = (shortName || name || '').trim();
  if (!preferred) {
    return 'Extension';
  }
  const cut = preferred.split(/\s+[–—:|-]\s+/)[0].trim();
  return cut || preferred;
};

const iconCandidates = (manifest) => {
  const paths = [];
  if (manifest.icons && typeof manifest.icons === 'object') {
    const sizes = Object.keys(manifest.icons)
      .map(Number)
      .filter(n => !Number.isNaN(n))
      .sort((a, b) => b - a);
    for (const size of sizes) {
      paths.push(manifest.icons[String(size)]);
    }
  }
  const actionIcons = manifest.action?.default_icon || manifest.browser_action?.default_icon;
  if (typeof actionIcons === 'string') {
    paths.push(actionIcons);
  } else if (actionIcons && typeof actionIcons === 'object') {
    for (const size of Object.keys(actionIcons).map(Number).sort((a, b) => b - a)) {
      paths.push(actionIcons[String(size)]);
    }
  }
  return [...new Set(paths.filter(Boolean))];
};

const displayCache = new Map();

const buildDisplayInfo = (unpacked) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(unpacked, 'manifest.json'), 'utf8'));
  const name = resolveManifestString(unpacked, manifest.name);
  const shortName = resolveManifestString(unpacked, manifest.short_name);
  const displayName = shortDisplayName(name, shortName);

  let logoDataUri = null;
  for (const relative of iconCandidates(manifest)) {
    const iconPath = path.join(unpacked, relative);
    if (!fs.existsSync(iconPath)) {
      continue;
    }
    try {
      logoDataUri = datauri(iconPath).content;
      break;
    } catch (e) {
      // try next icon
    }
  }

  return {
    shortName: displayName,
    version: String(manifest.version || '').trim() || null,
    logoDataUri
  };
};

const getExtensionDisplayInfo = async (extensionId) => {
  const id = validateExtensionId(extensionId);
  if (displayCache.has(id)) {
    return displayCache.get(id);
  }
  const unpacked = await downloadAndUnpack(id);
  const info = buildDisplayInfo(unpacked);
  displayCache.set(id, info);
  console.log(`extension-render: ${id} -> ${info.shortName}`);
  return info;
};

// Warm the cache for every extension id present in a results set.
const preloadExtensionDisplay = async (allTests) => {
  const ids = [...new Set(
    (allTests || []).map(test => test.extension).filter(Boolean))];
  await Promise.all(ids.map(id => getExtensionDisplayInfo(id)));
};

// Sync lookup after preloadExtensionDisplay (or a prior getExtensionDisplayInfo).
const extensionDisplayInfoSync = (extensionId) => {
  const id = validateExtensionId(extensionId);
  return displayCache.get(id) || { shortName: id, version: null, logoDataUri: null };
};

module.exports = {
  validateExtensionId,
  getExtensionDisplayInfo,
  preloadExtensionDisplay,
  extensionDisplayInfoSync
};
