const net = require('net');
const { exec } = require('node:child_process');

const clients = new Set();

const setupServer = () => {
  const unixServer = net.createServer(function (client) {
    // Allow local connections only
    if (!['::1', '127.0.0.1', 'localhost', '::ffff:127.0.0.1'].includes(client.remoteAddress)) {
      client.destroy();
      console.log(`Rejected connection from ${client.remoteAddress}.`)
      return;
    }
    client.on('data', () => {
      // ignore any incoming data
    });
    client.on('close', (e) => {
      clients.delete(client);
    });
    clients.add(client);
  });
  unixServer.listen(9999);
  return unixServer;
};

const runTcpDump = () => {
  const proc = exec('tcpdump -l udp port 53');
  proc.stdout.on('data', data => clients.forEach(client => {
    console.log(data);
    try {
      client.write(data);
    } catch (e) {
      console.log(e);
    }
  }));
  proc.on('exit', () => {
    runTcpDump();
  });
  return proc;
};

const main = () => {
  setupServer();
  runTcpDump();
};

if (require.main === module) {
  main();
}
