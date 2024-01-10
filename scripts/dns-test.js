const systemNetworkSettings = require('./system-network-settings');
const { sleepMs, execAsync } = require('./utils');
const domainCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
const net = require('node:net');

const domainsSeen = new Set();

const createSocket = (port) => new Promise((resolve, reject) => {
  try {
    const socket = net.createConnection(
      port,
      () => resolve(socket));
  } catch (e) {
    reject(e);
  }
});

const domainRegex = /\s([a-z0-9\-]+\.privacytests3\.org)[\s.]/g;

const observeDomains = async () => {
  const socket = await createSocket(9999);
  socket.on('data', (data) => {
    const text = data.toString();
    const matches = [...text.matchAll(domainRegex)];
    for (const match of matches) {
      const domain = match[1];
      domainsSeen.add(domain);
      console.log(`${Date.now()}-- observed domain: ${domain}`);
    }
  });
  const stop = () => {
    socket.destroy();
    domainsSeen.clear();
  };
  return stop;
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
  }));

// execAsync(`mullvad relay set location ${countryCode}`);

const dnsTestDefinitions = [
  {
    name: 'OS DNS = Comcast',
    ip: '75.75.75.75'
  },
  {
    name: 'OS DNS = Comodo',
    ip: '8.26.56.26'
  },
  {
    name: 'OS DNS = Cox',
    ip: '68.105.28.11'
  },
  {
    name: 'OS DNS = Cloudflare',
    ip: '1.1.1.1'
  },
  {
    name: 'OS DNS = Google',
    ip: '8.8.8.8'
  },
  {
    name: 'OS DNS = Quad9',
    ip: '9.9.9.9'
  },
  {
    name: 'Brazil',
    country: 'br'
  },
  {
    name: 'China',
    country: 'cn'
  },
  {
    name: 'Germany',
    country: 'de'
  },
  {
    name: 'India',
    country: 'in'
  },
  {
    name: 'Indonesia',
    country: 'id'
  },
  {
    name: 'Nigeria',
    country: 'ng'
  },
  {
    name: 'Russia',
    country: 'ru'
  },
  {
    name: 'United States',
    country: 'us'
  }
];

const checkForSecureDns = async (browserSession) => {
  await sleepMs(60000);
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
  await setCountry(browserSessions, country ?? 'us');
  await sleepMs(2000);
  await Promise.all(browserSessions.map(session => session.browser.launch(false)));
  return await Promise.all(browserSessions.map(checkForSecureDns));
};

const runDnsTests = async (browserSessions) => {
  const stopObserving = await observeDomains();
  const preferredNetworkService = systemNetworkSettings.getPreferredNetworkService();
  const originalDnsIps = systemNetworkSettings.getDNS(preferredNetworkService);
  const results = [];
  for (const testDef of dnsTestDefinitions) {
    const passed = await testIfDnsIsEncrypted(browserSessions, testDef);
    results.push({ ...testDef, passed });
  }
  systemNetworkSettings.setDNS(preferredNetworkService, originalDnsIps);
  stopObserving();
  return results;
};

module.exports = { runDnsTests };
