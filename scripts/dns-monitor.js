const net = require('node:net');

const domainsSeen = new Set();

const createSocket = () => new Promise((resolve, reject) => {
  try {
    const socket = net.createConnection(
      { path: '/tmp/monitor-do53-socket' },
      () => resolve(socket));
  } catch (e) {
    reject(e);
  }
});

const domainRegex = /\s([a-z0-9\-]+\.privacytests3\.org)[\s.]/g;

export const observeDomains = async () => {
  const socket = await createSocket();
  socket.on('data', (data) => {
    const text = data.toString();
    const matches = [...text.matchAll(domainRegex)];
    for (const match of matches) {
      const domain = match[1];
      domainsSeen.add(domain);
      console.log(`${Date.now()}-- observed domain: ${domain}`);
    }
  });
};

export const hasSeenDomain = (domain) => {
  console.log(`${Date.now()}-- reporting ${domain}: ${domainsSeen.has(domain)}`);
  return domainsSeen.has(domain);
};
