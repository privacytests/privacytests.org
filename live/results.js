
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors = require('cors');
const { contentPage } = require('../scripts/render.js');

const app = express();
const { WebSocketServer } = require('ws');
const ExpiryMap = require('expiry-map');

const oneHourInMilliseconds = 3600000;

// Map from sessionID to websocket
const websockets = new ExpiryMap(oneHourInMilliseconds);

// Map from sessionId to results.
const sessionResults = new ExpiryMap(oneHourInMilliseconds);

// We use two domains for supercookies and navigation tests.
// The "same" domain is the one that is used for simluated third-party tracker
// and one of the two first parties. The "different" domain is the other
// first party we use.
const first_party_root_same = 'https://test-pages.privacytests2.org';
const first_party_root_different = 'https://test-pages.privacytests.org';

// Borrowed from https://github.com/brave/brave-core/blob/50df76971db6a6023b3db9aead0827606162dc9c/browser/net/brave_site_hacks_network_delegate_helper.cc#L29
// and https://github.com/jparise/chrome-utm-stripper:
const TRACKING_QUERY_PARAMETERS = {
  // https://github.com/brave/brave-browser/issues/4239
  fbclid: 'Facebook Click Identifier',
  gclid: 'Google Click Identifier',
  msclkid: 'Microsoft Click ID',
  mc_eid: "Mailchimp Email ID (email recipient's address)",
  // https://github.com/brave/brave-browser/issues/9879
  dclid: 'DoubleClick Click ID (Google)',
  // https://github.com/brave/brave-browser/issues/13644
  oly_anon_id: "Omeda marketing 'anonymous' customer id",
  oly_enc_id: "Omeda marketing 'known' customer id",
  // https://github.com/brave/brave-browser/issues/11579
  _openstat: 'Yandex tracking parameter',
  // https://github.com/brave/brave-browser/issues/11817
  vero_conv: 'Vero tracking parameter',
  vero_id: 'Vero tracking parameter',
  // https://github.com/brave/brave-browser/issues/13647
  wickedid: 'Wicked Reports e-commerce tracking',
  // https://github.com/brave/brave-browser/issues/11578
  yclid: 'Yandex Click ID',
  // https://github.com/brave/brave-browser/issues/8975
  __s: 'Drip.com email address tracking parameter',
  // https://github.com/brave/brave-browser/issues/17451
  rb_clickid: 'Unknown high-entropy tracking parameter',
  // https://github.com/brave/brave-browser/issues/17452
  s_cid: 'Adobe Site Catalyst tracking parameter',
  // https://github.com/brave/brave-browser/issues/17507
  ml_subscriber: 'MailerLite email tracking',
  ml_subscriber_hash: 'MailerLite email tracking',
  // https://github.com/brave/brave-browser/issues/9019
  _hsenc: 'HubSpot tracking parameter',
  __hssc: 'HubSpot tracking parameter',
  __hstc: 'HubSpot tracking parameter',
  __hsfp: 'HubSpot tracking parameter',
  hsCtaTracking: 'HubSpot tracking parameter',
  // https://github.com/jparise/chrome-utm-stripper
  mkt_tok: 'Adobe Marketo tracking parameter'
};

// Map sessionId to the step.
const stepCounters = {};

// Generate the test URL for our tracking query parameter tests.
// Takes each of the parameters in the form { k1: v1, ... } and
// return a string URL with query string.
const queryParameterTestUrl = (parameters) => {
  const secret = Math.random().toString().slice(2);
  const baseURL = `${first_party_root_different}/query.html`;
  let queryString = '?controlParam=controlValue';
  for (const param of Object.keys(parameters)) {
    queryString += `&${param}=${secret}`;
  }
  return baseURL + queryString;
};

// Figure out the next step index for the given session.
const getNextStepIndex = (sessionId) => {
  if (stepCounters[sessionId] === undefined) {
    stepCounters[sessionId] = 0;
  }
  ++stepCounters[sessionId];
  return stepCounters[sessionId];
};

const pageSequence = [
  `${first_party_root_same}/supercookies.html?mode=write&thirdparty=same`,
  `${first_party_root_same}/supercookies.html?mode=read&thirdparty=same`,
  `${first_party_root_different}/supercookies.html?mode=read&thirdparty=different`,
  `${first_party_root_same}/navigation.html?mode=write&thirdparty=same`,
  `${first_party_root_same}/navigation.html?mode=read&thirdparty=same`,
  `${first_party_root_different}/navigation.html?mode=read&thirdparty=different`,
  `${first_party_root_same}/fingerprinting.html`,
  `${first_party_root_same}/tracking_content.html`,
  `${first_party_root_same}/misc.html`,
  queryParameterTestUrl(TRACKING_QUERY_PARAMETERS),
  `${first_party_root_same}/https.html`,
  'http://upgradable.privacytests2.org/upgradable.html?source=hyperlink',
  //  `http://insecure.privacytests2.org/insecure.html`,
  `${first_party_root_same}/done.html`
];

const round = (x, digits) => {
  const factor = Math.pow(10, digits);
  return Math.round(x * factor) / factor;
};

const nextUrl = (sessionId, nextStepIndex) => {
  if (nextStepIndex >= pageSequence.length) {
    return undefined;
  }
  const rawUrl = pageSequence[nextStepIndex];
  const urlObject = new URL(rawUrl);
  urlObject.searchParams.set('sessionId', sessionId);
  urlObject.searchParams.set('progress', round(nextStepIndex / (pageSequence.length - 1), 3).toString());
  return urlObject.toString();
};

// Store the result data for a particular category.
const accumulateResultData = (sessionId, category, data) => {
  if (sessionResults.get(sessionId) === undefined) {
    sessionResults.set(sessionId, {});
  }
  sessionResults.get(sessionId)[category] = data;
};

// Takes the results of supercookie or navigation tests
const getJointResult = (writeResults, readResultsSameFirstParty, readResultsDifferentFirstParty) => {
  console.log({ jointResults: { writeResults, readResultsSameFirstParty, readResultsDifferentFirstParty } });
  const jointResult = {};
  for (const test in readResultsDifferentFirstParty) {
    const { write, read, description, result: readDifferentFirstParty } = readResultsDifferentFirstParty[test];
    const { result: readSameFirstParty } = readResultsSameFirstParty[test];
    const { result: writeResult } = writeResults[test];
    let unsupported = (writeResult === 'Error: Unsupported') || (readSameFirstParty === 'Error: Unsupported');
    const readSameFirstPartyFailedToFetch = readSameFirstParty ? readSameFirstParty.startsWith('Error: Failed to fetch') : false;
    const readDifferentFirstPartyFailedToFetch = readDifferentFirstParty ? readDifferentFirstParty.startsWith('Error: Failed to fetch') : false;
    unsupported = unsupported || (readSameFirstParty ? readSameFirstParty.startsWith('Error: No requests received') : false);
    unsupported = unsupported || (readSameFirstParty ? readSameFirstParty.startsWith('Error: image load failed') : false);
    const testFailed = !unsupported && (!readSameFirstParty || (readSameFirstParty.startsWith('Error:') && !readSameFirstPartyFailedToFetch));
    const passed = (testFailed || unsupported)
      ? undefined
      : (readSameFirstParty !== readDifferentFirstParty) ||
      (readSameFirstPartyFailedToFetch && readDifferentFirstPartyFailedToFetch);
    jointResult[test] = { write, read, unsupported, readSameFirstParty, readDifferentFirstParty, passed, testFailed, description };
  }
  return jointResult;
};

const processQueryResults = (queryParametersRaw) => {
  console.log(queryParametersRaw);
  const queryParameters = {};
  for (const param of Object.keys(TRACKING_QUERY_PARAMETERS)) {
    console.log(queryParametersRaw[param]);
    queryParameters[param] = {
      value: queryParametersRaw[param],
      passed: (queryParametersRaw[param] === undefined),
      description: TRACKING_QUERY_PARAMETERS[param]
    };
  }
  return queryParameters;
};

// Move a test from a source map to a destination map. (Mutates both maps.)
const moveTestBetweenCategories = (testName, src, dest) => {
  dest[testName] = src[testName];
  delete src[testName];
};

const processResults = (rawResults) => {
  try {
    const {
      misc, https, upgradable_hyperlink, fingerprinting, query, trackers,
      navigation_write_same, navigation_read_same, navigation_read_different,
      supercookies_write_same, supercookies_read_same, supercookies_read_different
    } = rawResults;
    const supercookies = getJointResult(supercookies_write_same, supercookies_read_same, supercookies_read_different);
    const navigation = getJointResult(navigation_write_same, navigation_read_same, navigation_read_different);
    moveTestBetweenCategories('ServiceWorker', navigation, supercookies);
    moveTestBetweenCategories('CSS cache', navigation, supercookies);
    moveTestBetweenCategories('font cache', navigation, supercookies);
    moveTestBetweenCategories('image cache', navigation, supercookies);
    moveTestBetweenCategories('script cache', navigation, supercookies);
    moveTestBetweenCategories('prefetch cache', navigation, supercookies);
    moveTestBetweenCategories('Alt-Svc', navigation, supercookies);
    moveTestBetweenCategories('Stream isolation', supercookies, misc);
    return {
      misc,
      query: processQueryResults(query),
      https: Object.assign({}, https, upgradable_hyperlink),
      fingerprinting,
      navigation,
      supercookies,
      trackers
    };
  } catch (e) {
    console.log(e);
  }
};

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/results', (req, res) => {
  const { raw, sessionId } = req.query;
  if (raw) {
    res.json(sessionResults.get(sessionId));
  } else {
    res.json(processResults(sessionResults.get(sessionId)));
  }
});

app.get('/step', (req, res) => {
  const { sessionId } = req.query;
  console.log(stepCounters);
  res.json({ step: stepCounters[sessionId] ?? 0, length: pageSequence.length });
});

app.get('/me', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const testResults = processResults(sessionResults.get(sessionId));
    const data = { all_tests: [{ browser: 'mine', incognito: false, nightly: false, testResults }], git: 'fake_git_string' };
    const page = await contentPage({
      results: data,
      title: 'PrivacyTests.org: my browser',
      basename: 'basename',
      previewImageUrl: null,
      tableTitle: 'my browser',
      nightly: false,
      incognito: false,
      testMyBrowser: true
    });
    console.log(page);
    res.send(page);
  } catch (e) {
    res.send('not found');
  }
});

const websocketSend = (sessionId, data) => {
  if (!websockets.get(sessionId)) {
    throw new Error(`no websocket exists for sessionId=${sessionId}`);
  }
  const payload = JSON.stringify({ sessionId, data }, null, "  ");
  console.log('sending payload:', payload);
  websockets.get(sessionId).send(payload);
};

app.post('/post', (req, res) => {
  console.log('post received.');
  // console.log(req.body);
  const { sessionId, data, category } = req.body;
  console.log('RECEIVED: ', category);
  if (false) { // (!sessionId || !websockets.get(sessionId)) {
    // We don't recognized this as an existing sessionId.
    console.log(`Unknown sessionId '${sessionId}'; Sending 404.`);
    res.sendStatus(404);
  } else if (['supplementary', 'insecure', 'upgradable_address', 'toplevel',
    'nothing', 'hsts', 'hsts2', 'tracking_cookies',
    'session_read_3p', 'session_write_3p',
    'session_read_1p', 'session_write_1p'].includes(category)) {
    try {
      websocketSend(sessionId, data);
    } catch (e) {
      console.log(e);
    }
    res.json({}); // No instructions for page
  } else {
    // We received some data for a valid session. Forward
    // that data to the websocket assigned to the same sessionId.
    // const message = JSON.stringify({sessionId, data});
    // console.log("received posted data. ", message.substr(0, 100) + "...");
    // Send an acknowledgment to the client that posted, and instructions
    // for the next step.
    if (data !== undefined) {
      accumulateResultData(sessionId, category, data);
    }
    const nextStepIndex = getNextStepIndex(sessionId);
    console.log({ nextStepIndex, pageSequenceLength: pageSequence.length });
    if (nextStepIndex === pageSequence.length - 1) {
      if (websockets.get(sessionId)) {
        websocketSend(sessionId, processResults(sessionResults.get(sessionId)));
      }
    }
    if (nextStepIndex === 1) {
      if (websockets.get(sessionId)) {
        websocketSend(sessionId, { supercookie_write_finished: true });
      }
    }
    res.json({ received: true, sessionId, navigateUrl: nextUrl(sessionId, nextStepIndex) });
  }
});

app.listen(3335, () => console.log('listening for data submissions'));

const wss = new WebSocketServer({ port: 3336 });

wss.on('connection', function connection (ws) {
  ws.on('message', function incoming (message) {
    try {
      console.log('received: %s', JSON.parse(message));
    } catch (e) {
      console.log(e, message);
    }
  });

  // A new session. Create a sessionId and send it to the websocket client.
  const sessionId = uuidv4();
  const message = JSON.stringify({ sessionId, connected: true });
  console.log('sending to ws:', message);
  websockets.set(sessionId, ws);
  ws.send(message);
});
