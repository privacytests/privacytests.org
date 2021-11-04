const { execSync } = require('child_process');

const exampleOutput = `
An asterisk (*) denotes that a network service is disabled.
(1) Ethernet
(Hardware Port: Ethernet, Device: en0)

(2) FireWire
(Hardware Port: FireWire, Device: fw0)

(3) Wi-Fi
(Hardware Port: Wi-Fi, Device: en1)
`;

const run = (...args) => execSync(...args).toString();

const parseNetworkServiceList = (text) =>
  [...text.matchAll(/\(\d+?\)\s+?(.+)$/mg)]
        .map(m => m[1]);

const getNetworkServices = () => {
  const result = run("networksetup -listnetworkserviceorder");
  return parseNetworkServiceList(result);
};

const setProxyState = (networkService, type, enabled) => {
  const state = enabled ? "on" : "off";
  return run(`networksetup -set${type}proxystate ${networkService} ${state}`);
};

const setProxy = (networkService, type, { enabled = undefined, domain = undefined, port = undefined,
                                          authenticated = undefined, username = "", password = ""}) => {
  let authenticatedString = authenticated === undefined ? "" : (authenticated ? "on" : "off");
  if (domain !== undefined && port !== undefined) {
    run(`networksetup -set${type}proxy ${networkService} ${domain} ${port} ${authenticatedString} ${username} ${password}`);
  }
  if (enabled !== undefined) {
    setProxyState(networkService, type, enabled);
  }
};

const parseGetterResult = raw => {
  const lines = raw.split("\n");
  let rawMap = {};
  for (const line of lines) {
    const [key, val] = line.split(":").map(s => s.trim());
    if (key.length > 0) {
      rawMap[key] = val;
    }
  }
  let result = {};
  result["enabled"] = rawMap["Enabled"] === 'Yes';
  const server = rawMap["Server"];
  result["domain"] = server === "0" ? undefined : server;
  const port = rawMap["Port"];
  result["port"] = port === "0" ? undefined : port;
  result["authenticated"] = {"0": false, "1": true}[rawMap["Authenticated Proxy Enabled"]];
  return result;
};

const getProxy = (networkService, type) => {
  const raw = run(`networksetup -get${type}proxy ${networkService}`);
  return parseGetterResult(raw);
};

const setProxies = (networkService, settings) => {
  for (let type in settings) {
    setProxy(networkService, type, settings[type]);
  }
};

const getProxies = (networkService) => {
  const types = ["ftp", "web", "secureweb", "streaming", "gopher", "socksfirewall"];
  let result = {};
  for (let type of types) {
    result[type] = getProxy(networkService, type);
  }
  return result;
};

const runTests = () => {
  console.log("Fake:", parseNetworkServiceList(exampleOutput));
  let networkServices = getNetworkServices();
  console.log(networkServices);
  for (const networkService of networkServices) {
    let oldSettings = getProxies(networkService);
    console.log(oldSettings);
    setProxies(networkService, {"web": { enabled: true, domain: "127.0.0.1", port: 8080 },
                                "secureweb": { enabled: true, domain: "127.0.0.1", port: 8080 }});
    console.log(getProxies(networkService));
    setTimeout(() => {
      setProxies(networkService, oldSettings);
      console.log(getProxies(networkService));
    }, 5000);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { setProxies, getProxies, getNetworkServices };
