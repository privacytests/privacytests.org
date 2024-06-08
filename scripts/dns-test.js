const systemNetworkSettings = require('./system-network-settings');
const { sleepMs } = require('./utils');
const domainCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
const net = require('node:net');

const domainsSeen = new Set();

const createSocket = (port) => new Promise((resolve, reject) => {
  const socket = net.createConnection(
    port,
    () => resolve(socket));
  socket.on("error", (err) => {
    reject(err);
  });
});

const domainRegex = /\s([a-z0-9\-]+\.privacytests3\.org)[\s.]/g;

let isObserving = false;

const observeDomains = async () => {
  if (isObserving) {
    // We are already observing.
    return;
  }
  const socket = await createSocket(9999);
  socket.on('data', (data) => {
    const text = data.toString();
    const matches = [...text.matchAll(domainRegex)];
    for (const match of matches) {
      const domain = match[1];
      if (!domainsSeen.has(domain)) {
        domainsSeen.add(domain);
        console.log(`${Date.now()}-- observed domain: ${domain}`);
      }
    }
  });
  isObserving = true;
};

const hasSeenDomain = (domain) => {
  console.log(`${Date.now()}-- reporting ${domain}: ${domainsSeen.has(domain)}`);
  return domainsSeen.has(domain);
};

const generateRandomTestDomain = () => {
  let subdomain = '';
  for (let i = 0; i < 32; ++i) {
    const n = Math.floor(domainCharacters.length * Math.random());
    subdomain += domainCharacters[n];
  }
  return `${subdomain}.privacytests3.org`;
};

// const enableVpn = () => execAsync('mullvad connect');

// const disableVpn = () => execAsync('mullvad disconnect');

const setCountry = (browserSessions, countryCode) =>
  Promise.allSettled(browserSessions.map(async (browserSession) => {
    const browser = browserSession.browser;
    // Right now we override the Firefox country. Other browsers
    // don't seem to have locale-based settings, so we do nothing
    // for those.
    if (browser._defaults.basedOn === 'firefox') {
      await browser.setPref('doh-rollout.home-region', countryCode.toUpperCase());
    }
    if (browser._defaults.basedOn === 'chromium') {
      // Set kCFLocaleCountryCode somehow
    }
  }));

// execAsync(`mullvad relay set location ${countryCode}`);

const ispDescription = (name) => `
  Checks whether the browser decides to use
  encrypted DNS if the operating system's default DNS provider is ${name}.`;

const ispDefinition = (isp, ip) =>
  ({
    name: `OS DNS: ${isp}`,
    ip,
    description: ispDescription(isp)
  });

const locationDescription = (name) => `
  Checks whether the browser decides to use
  encrypted DNS if the computer is located in ${name}.`;

const locationDefinition = (countryName, countryCode) =>
  ({
    name: `Location: ${countryName}`,
    country: countryCode,
    description: locationDescription(countryName)
  });

const dnsTestDefinitions = [
  //ispDefinition('Comcast', '75.75.75.75'),
  //ispDefinition('Spectrum (Charter)', '209.18.47.61'),
  //ispDefinition('AT&T', '68.94.156.1'),
  //ispDefinition('Verizon', '8.238.64.14'),
  //ispDefinition('Cox', '68.105.28.11'),
  //ispDefinition('Orange', '80.10.246.2'),
  //ispDefinition('BT', '62.6.40.178'),
  ispDefinition('Cloudflare', '1.1.1.1'),
  ispDefinition('Google', '8.8.8.8'),
  ispDefinition('Quad9', '9.9.9.9'),
  ispDefinition('Comodo', '8.26.56.26'),
  locationDefinition('Brazil', 'br'),
  locationDefinition('China', 'cn'),
  locationDefinition('Germany', 'de'),
  locationDefinition('India', 'in'),
  locationDefinition('Nigeria', 'ng'),
  locationDefinition('Russia', 'ru'),
  locationDefinition('United States', 'us')
];

const checkForSecureDns = async (browserSession) => {
  await sleepMs(20000);  // Wait enough time for browsers to enable DoH.
  const testDomain = generateRandomTestDomain();
  console.log(`${Date.now()} -- opening ${testDomain}`);
  browserSession.browser.openUrl(`http://${testDomain}/`);
  await sleepMs(2000);
  const unencrypted = hasSeenDomain(testDomain);
  return !unencrypted;
};

const testIfDnsIsEncrypted = async (browserSessions, { ip, country }) => {
  await Promise.all(browserSessions.map(session => session.browser.kill()));
  const preferredNetworkService = systemNetworkSettings.getPreferredNetworkService();
  await systemNetworkSettings.setDNS(preferredNetworkService, ip ?? '162.243.184.122');
  await setCountry(browserSessions, country ?? 'aq'); // Antarctica by default
  await sleepMs(2000);
  await Promise.all(browserSessions.map(session => session.browser.launch(false)));
  return await Promise.all(browserSessions.map(checkForSecureDns));
};

const runDnsTests = async (browserSessions) => {
  await observeDomains();
  const preferredNetworkService = systemNetworkSettings.getPreferredNetworkService();
  const originalDnsIps = systemNetworkSettings.getDNS(preferredNetworkService);
  // Start all browsers with a fresh profile:
  await Promise.all(browserSessions.map(session => session.browser.launch(true)));
  await sleepMs(4000);
  const results = [];
  for (const testDef of dnsTestDefinitions) {
    const passedList = await testIfDnsIsEncrypted(browserSessions, testDef);
    const n = passedList.length;
    for (let i = 0; i < n; ++i) {
      const passed = passedList[i];
      results[i] ??= { dns: {} };
      results[i].dns[testDef.name] = { passed, description: testDef.description, 'leak detected': !passed };
    }
  }
  systemNetworkSettings.setDNS(preferredNetworkService, []);
  // Kill all the browsers
  await Promise.all(browserSessions.map(session => session.browser.kill()));
  return results;
};

module.exports = { observeDomains, runDnsTests };
