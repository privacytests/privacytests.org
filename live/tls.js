const https = require('https');
const fs = require('fs');


const START_SESSION_ID = 16;
const START_MASTER_KEY = 50;

let parseSession = (buf) => ({
  sessionId: buf.slice(START_SESSION_ID, START_SESSION_ID+32).toString('hex'),
  masterKey: buf.slice(START_MASTER_KEY, START_MASTER_KEY+48).toString('hex')
});

const options = {
  key: fs.readFileSync('/home/arthur/certs/tls.arthuredelstein.net/privkey.pem'),
  cert: fs.readFileSync('/home/arthur/certs/tls.arthuredelstein.net/cert.pem')
};

let lastRequest = null;

let theServer = https.createServer(options, function (req, res) {
  let result = { isSessionReused: req.socket.isSessionReused(),
                 sessionId: parseSession(req.socket.getSession()).sessionId };
  res.writeHead(200, { 'Content-Type': 'application/json',
                       'Cache-Control': 'no-store',
                       'Access-Control-Allow-Origin': '*'});
  res.end(JSON.stringify(result));
  console.log("response sent");
  req.socket.destroy();
//  console.log(req);
  lastRequest = req;
});

console.log("eventNames", theServer.eventNames());

theServer.on('keylog', (line, tlsSocket) => {
//  console.log(line.toString());
});

theServer.on('newSession', (sessionId, sessionData, callback) => {
  let results = { sessionId: sessionId.toString("hex"),
                  sessionData: sessionData.toString("hex")};
//  console.log(results);
  callback();
});

theServer.on('secureConnection', (tlsSocket) => {
  let session = tlsSocket.getSession();
  console.log(tlsSocket.isSessionReused(), parseSession(session));
//  console.log(buffer, buffer.length);
//  console.log(tlsSocket.getTLSTicket());
});

theServer.listen(8900);
console.log("listening for tls connections on 8900");
