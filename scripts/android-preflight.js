/**
 * Android preflight: open Play Store → Manage apps & device → Update all,
 * then wait until updates finish (or confirm everything is already current).
 *
 * Usage: node android-preflight.js
 * Requires Appium on port 4723 with UiAutomator2 (same as android.js).
 */

const WebDriver = require('webdriver');
const { sleepMs } = require('./utils');

const PLAY_STORE = 'com.android.vending';
const PLAY_MAIN_ACTIVITY =
  'com.android.vending/com.google.android.finsky.activities.MainActivity';
const VIEW_MY_DOWNLOADS = 'com.google.android.finsky.VIEW_MY_DOWNLOADS';

const UP_TO_DATE = 'All apps up to date';
const UPDATE_ALL = 'Update all';
const UPDATING = ['Updating apps…', 'Updating apps...'];

// How long to wait for Play downloads/installs to finish.
const UPDATE_TIMEOUT_MS = 45 * 60 * 1000;
const POLL_MS = 5000;

const xpathText = (text) =>
  `//*[@text=${JSON.stringify(text)} or @content-desc=${JSON.stringify(text)}]`;

const findByText = async (client, text) => {
  try {
    const elementObject = await client.findElement('xpath', xpathText(text));
    return elementObject.ELEMENT;
  } catch (e) {
    return undefined;
  }
};

const clickIfPresent = async (client, text) => {
  const el = await findByText(client, text);
  if (!el) {
    return false;
  }
  await client.elementClick(el);
  await sleepMs(1500);
  return true;
};

/** @returns {'upToDate'|'updateAll'|'updating'|undefined} */
const findManageState = async (client) => {
  if (await findByText(client, UP_TO_DATE)) {
    return 'upToDate';
  }
  if (await findByText(client, UPDATE_ALL)) {
    return 'updateAll';
  }
  for (const text of UPDATING) {
    if (await findByText(client, text)) {
      return 'updating';
    }
  }
  return undefined;
};

const openManageAppsAndDevice = async (client) => {
  console.log('Opening Play Store Manage apps & device…');
  await client.executeScript('mobile: startActivity', [{
    wait: true,
    action: VIEW_MY_DOWNLOADS,
    component: PLAY_MAIN_ACTIVITY
  }]);
  await sleepMs(4000);

  const state = await findManageState(client);
  if (!state) {
    throw new Error(
      'Could not open Manage apps & device ' +
      `(expected "${UPDATE_ALL}", "${UPDATING[0]}", or "${UP_TO_DATE}")`);
  }
  return state;
};

const tapUpdateAll = async (client) => {
  const clicked = await clickIfPresent(client, UPDATE_ALL);
  if (!clicked) {
    throw new Error(`Expected "${UPDATE_ALL}" button but it was not present`);
  }
  return true;
};

const waitForUpdatesToFinish = async (client) => {
  const deadline = Date.now() + UPDATE_TIMEOUT_MS;
  let lastLog = 0;

  while (Date.now() < deadline) {
    const state = await findManageState(client);
    if (state === 'upToDate') {
      console.log('Play Store reports apps are up to date.');
      return;
    }
    if (state === 'updateAll') {
      console.log('Update all still present; tapping again…');
      await tapUpdateAll(client);
    } else if (state === 'updating') {
      // in progress
    } else if (!state) {
      // Transient UI between states — keep polling.
    }

    const now = Date.now();
    if (now - lastLog > 30000) {
      console.log('Still waiting for Play Store updates…');
      lastLog = now;
    }
    await sleepMs(POLL_MS);
  }

  throw new Error(
    `Timed out after ${UPDATE_TIMEOUT_MS / 60000} minutes waiting for Play updates`);
};

const createSession = () =>
  WebDriver.newSession({
    port: 4723,
    hostname: '0.0.0.0',
    path: '/wd/hub',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:newCommandTimeout': 600,
      'appium:uiautomator2ServerInstallTimeout': 90000,
      'appium:noReset': true,
      'appium:autoGrantPermissions': true
    }
  });

async function main () {
  const client = await createSession();
  try {
    const appState = await client.queryAppState(PLAY_STORE);
    if (appState >= 2) {
      await client.terminateApp(PLAY_STORE);
      await sleepMs(1000);
    }

    const state = await openManageAppsAndDevice(client);
    if (state === 'upToDate') {
      console.log('Apps already up to date.');
    } else {
      if (state === 'updateAll') {
        await tapUpdateAll(client);
        await sleepMs(5000);
      }
      await waitForUpdatesToFinish(client);
    }
    console.log('Android preflight complete: browsers/apps updated via Play Store.');
  } catch (e) {
    console.error('Android preflight failed:', e);
    try {
      console.log('UI hierarchy:\n', await client.getPageSource());
    } catch (dumpErr) {
      console.log('Failed to dump UI hierarchy:', dumpErr.message || dumpErr);
    }
    process.exitCode = 1;
  } finally {
    try {
      await client.terminateApp(PLAY_STORE);
    } catch (_) { /* ignore */ }
    try {
      await client.deleteSession();
    } catch (_) { /* ignore */ }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
