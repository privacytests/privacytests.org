const { execSync } = require('child_process');
const { _: { memoize } } = require('lodash');

/*
const exampleOutput = `
An asterisk (*) denotes that a network service is disabled.
(1) Ethernet
(Hardware Port: Ethernet, Device: en0)

(2) FireWire
(Hardware Port: FireWire, Device: fw0)

(3) Wi-Fi
(Hardware Port: Wi-Fi, Device: en1)
`;
*/

const run = (...args) => execSync(...args).toString();

const getPreferredDevice = () => {
  const result = run('/sbin/route get example.com | /usr/bin/grep interface');
  return result.split(':')[1].trim();
};

const parseNetworkServiceList = (text) => {
  const groups = text.split('\n\n');
  const result = {};
  for (const group of groups) {
    const lines = group.split('\n');
    let hardwarePort, device;
    for (const line of lines) {
      const chunks = line.split(': ');
      if (chunks[0] === 'Hardware Port') {
        hardwarePort = chunks[1];
      } else if (chunks[0] === 'Device') {
        device = chunks[1];
      }
    }
    if (device && hardwarePort) {
      result[device] = hardwarePort;
    }
  }
  return result;
};

const getNetworkServices = () => {
  const result = run('/usr/sbin/networksetup -listallhardwareports');
  return parseNetworkServiceList(result);
};

const getPreferredNetworkService = memoize(() => {
  const preferredNetworkService = getNetworkServices()[getPreferredDevice()];
  if (preferredNetworkService === undefined) {
    throw new Error('Preferred network service not found. Is a VPN running?');
  }
  return preferredNetworkService;
});

const getDNS = (networkService) => {
  const response = run(`networksetup -getdnsservers "${networkService}"`);
  if (response.trim() === 'There aren\'t any DNS Servers set on Wi-Fi.') {
    return [];
  } else {
    return response.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }
};

const setDNS = (networkService, dnsAddresses) => {
  console.log(`setting DNS addresses on ${networkService} to ${dnsAddresses}`)
  let addressCommands;
  if (dnsAddresses === undefined || (dnsAddresses && dnsAddresses.length === 0)) {
    addressCommands = '"Empty"';
  } else if (dnsAddresses.map === undefined) {
    addressCommands = `${dnsAddresses}`;
  } else {
    addressCommands = dnsAddresses.map(address => `"${address}"`).join(' ');
  }
  const command = `networksetup -setdnsservers "${networkService}" ${addressCommands}`;
  run(command);
};

const setProxyState = (networkService, type, enabled) => {
  const state = enabled ? 'on' : 'off';
  return run(`/usr/sbin/networksetup -set${type}proxystate "${networkService}" "${state}"`);
};

const setProxy = (networkService, type, { enabled, domain, port, authenticated, username, password }) => {
  // console.log(networkService, type, { enabled, domain, port, authenticated, username, password });
  const authenticatedString = authenticated === undefined ? '' : (authenticated ? 'on' : 'off');
  const usernameString = username === undefined ? '' : username;
  const passwordString = password === undefined ? '' : password;
  if (domain !== undefined && port !== undefined) {
    let command = `/usr/sbin/networksetup -set${type}proxy "${networkService}" "${domain}" "${port}"`;
    if (authenticatedString) {
      command += ` "${authenticatedString}" "${usernameString} ${passwordString}"`;
    }
    run(command);
  }
  if (enabled !== undefined) {
    setProxyState(networkService, type, enabled);
  }
};

const parseGetterResult = raw => {
  const lines = raw.split('\n');
  const rawMap = {};
  for (const line of lines) {
    const [key, val] = line.split(':').map(s => s.trim());
    if (key.length > 0) {
      rawMap[key] = val;
    }
  }
  const result = {};
  result.enabled = rawMap.Enabled === 'Yes';
  const server = rawMap.Server;
  result.domain = server === '0' ? undefined : server;
  const port = rawMap.Port;
  result.port = port === '0' ? undefined : port;
  result.authenticated = { 0: false, 1: true }[rawMap['Authenticated Proxy Enabled']];
  return result;
};

const getProxy = (networkService, type) => {
  const raw = run(`/usr/sbin/networksetup -get${type}proxy "${networkService}"`);
  return parseGetterResult(raw);
};

const setProxies = (networkService, settings) => {
  for (const type in settings) {
    setProxy(networkService, type, settings[type]);
  }
};

const getProxies = (networkService) => {
  const types = ['ftp', 'web', 'secureweb', 'streaming', 'gopher', 'socksfirewall'];
  const result = {};
  for (const type of types) {
    result[type] = getProxy(networkService, type);
  }
  return result;
};

const runTests = () => {
  const networkService = getPreferredNetworkService();
  console.log(networkService);
  const oldSettings = getProxies(networkService);
  console.log(oldSettings);
  setProxies(networkService, {
    web: { enabled: true, domain: '127.0.0.1', port: 8080 },
    secureweb: { enabled: true, domain: '127.0.0.1', port: 8080 }
  });
  console.log(getProxies(networkService));
  setTimeout(() => {
    setProxies(networkService, oldSettings);
    console.log(getProxies(networkService));
  }, 5000);
};

if (require.main === module) {
  runTests();
}

module.exports = {
  setProxies,
  getProxies,
  getNetworkServices,
  getPreferredNetworkService,
  setDNS,
  getDNS
};
