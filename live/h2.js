const http2 = require('http2');
const url = require("url");
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/h2.privacytests2.org/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/h2.privacytests2.org/fullchain.pem')
};

// Create a secure HTTP/2 server
const server = http2.createSecureServer(options);

let sessionTags = new Map();

// Exampleas:
// https://h2.privacytests2.org:8902/?mode=write&secret=123test
// https://h2.privacytests2.org:8902/?mode=read
server.on('request', (request, response) => {
  let path = request.headers[":path"];
  let parsedURL = url.parse(path, true);
  let query = parsedURL.query;
  let session = request.stream.session;
  if (query["mode"] === "write") {
    sessionTags.set(session, query["secret"]);
  }
  console.log("h2 request. session tag found:",sessionTags.get(session));
  response.setHeader('Content-Type', 'text/plain');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (query["mode"] === "ip") {
    response.end(request.socket.remoteAddress);
  } else {
    response.end(sessionTags.get(session));
  }
});

server.timeout = 300000;
server.listen(8902);
console.log("listening for h2 connections on 8902");
