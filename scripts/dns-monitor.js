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

const domainRegex = /\s([a-z0-9\-]+\.privacytests3\.org)[\s.]/;

export const observeDomains = async () => {
  const socket = await createSocket();
  socket.on('data', (data) => {
    const text = data.toString();
    const match = text.match(domainRegex);
    if (match) {
      domainsSeen.add(match[1]);
    }
  });
};

export const hasSeenDomain = (domain) => {
  return domainsSeen.has(domain);
};
