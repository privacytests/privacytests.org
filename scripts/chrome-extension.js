// Install a Chrome Web Store extension into one --user-data-dir via
// External Extensions, then enable it once from chrome://extensions so
// Chrome records the acknowledgement for later launches of that profile.

const fsPromises = require('node:fs/promises');
const path = require('node:path');
const WebSocket = require('ws');
const { sleepMs } = require('./utils');

const EXTENSION_ID_RE = /^[a-p]{32}$/;
const STORE_UPDATE_URL = 'https://clients2.google.com/service/update2/crx';

const validateExtensionId = (extensionId) => {
  const id = String(extensionId || '').trim();
  if (!EXTENSION_ID_RE.test(id)) {
    throw new Error(
      `Invalid extension id "${extensionId}". Expected a 32-letter Chrome Web Store id.`);
  }
  return id;
};

// Chromium reads `<user-data-dir>/External Extensions/<id>.json` for this
// process only. Leave the file in place for every launch.
const writeExternalExtension = async (userDataDir, extensionId) => {
  const id = validateExtensionId(extensionId);
  const dir = path.join(userDataDir, 'External Extensions');
  await fsPromises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.json`);
  await fsPromises.writeFile(filePath, `${JSON.stringify({ external_update_url: STORE_UPDATE_URL })}\n`);
  console.log(`extension: external install pref ${filePath}`);
};

const waitForDevToolsEndpoint = async (userDataDir) => {
  const filePath = path.join(userDataDir, 'DevToolsActivePort');
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const [portLine, pathLine] = (await fsPromises.readFile(filePath, 'utf8')).split('\n');
      const port = Number(portLine);
      if (port && pathLine?.trim()) {
        return `ws://127.0.0.1:${port}${pathLine.trim()}`;
      }
    } catch (e) {
      // port file not ready yet
    }
    await sleepMs(250);
  }
  throw new Error('Chrome did not open a debugging port.');
};

const openWebSocket = (endpoint) => new Promise((resolve, reject) => {
  const ws = new WebSocket(endpoint);
  const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome.')), 10000);
  ws.addEventListener('open', () => {
    clearTimeout(timer);
    resolve(ws);
  });
  ws.addEventListener('error', () => {
    clearTimeout(timer);
    reject(new Error('Could not connect to Chrome\'s debugging port.'));
  });
});

const cdpClient = (ws) => {
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    const waiter = msg.id != null ? pending.get(msg.id) : null;
    if (!waiter) {
      return;
    }
    pending.delete(msg.id);
    if (msg.error) {
      waiter.reject(new Error(msg.error.message || 'CDP error'));
    } else {
      waiter.resolve(msg.result);
    }
  });
  return {
    send (method, params = {}, sessionId) {
      const id = ++nextId;
      const payload = { id, method, params };
      if (sessionId) {
        payload.sessionId = sessionId;
      }
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify(payload));
      });
    },
    close () {
      for (const { reject } of pending.values()) {
        reject(new Error('CDP closed'));
      }
      pending.clear();
      ws.close();
    }
  };
};

const connectDevTools = async (userDataDir) =>
  cdpClient(await openWebSocket(await waitForDevToolsEndpoint(userDataDir)));

const evaluate = async (cdp, sessionId, expression) => {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || result.exceptionDetails.exception?.description;
    throw new Error(text || 'chrome://extensions script failed');
  }
  return result.result?.value;
};

const getExtensionEnabled = (extensionId) => `(() => new Promise((resolve) => {
  chrome.management.get(${JSON.stringify(extensionId)}, (info) => {
    resolve(chrome.runtime.lastError || !info ? null : info.enabled);
  });
}))()`;

const setExtensionEnabled = (extensionId) => `(() => new Promise((resolve) => {
  chrome.management.setEnabled(${JSON.stringify(extensionId)}, true, () => {
    resolve(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'ok');
  });
}))()`;

// On chrome://extensions, call chrome.management.setEnabled so Chrome records
// the acknowledgement itself for later launches of this profile.
const enableInstalledExtension = async ({ userDataDir, extensionId }) => {
  const id = validateExtensionId(extensionId);
  const cdp = await connectDevTools(userDataDir);
  try {
    const { targetInfos } = await cdp.send('Target.getTargets');
    let targetId = targetInfos.find(target => (target.url || '').startsWith('chrome://extensions'))?.targetId;
    if (!targetId) {
      ({ targetId } = await cdp.send('Target.createTarget', { url: 'chrome://extensions' }));
    }
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    let enabled = null;
    const waitDeadline = Date.now() + 60000;
    while (Date.now() < waitDeadline) {
      enabled = await evaluate(cdp, sessionId, getExtensionEnabled(id));
      if (enabled !== null) {
        break;
      }
      await sleepMs(500);
    }
    if (enabled === null) {
      throw new Error(`Extension ${id} was not installed into the test profile.`);
    }
    if (!enabled) {
      const result = await evaluate(cdp, sessionId, setExtensionEnabled(id));
      if (result !== 'ok') {
        throw new Error(`chrome.management.setEnabled failed for ${id}: ${result}`);
      }
      enabled = await evaluate(cdp, sessionId, getExtensionEnabled(id));
      if (!enabled) {
        throw new Error(`Extension ${id} did not stay enabled after setEnabled.`);
      }
    }
    console.log(`extension: ${id} enabled in the test profile`);
  } finally {
    cdp.close();
  }
};

module.exports = {
  validateExtensionId,
  writeExternalExtension,
  enableInstalledExtension
};
