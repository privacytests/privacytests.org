const https = require('https');
const url = require("url");
const fs = require('fs');

const options = {
  key: fs.readFileSync('/home/arthur/certs/h1.arthuredelstein.net/privkey.pem'),
  cert: fs.readFileSync('/home/arthur/certs/h1.arthuredelstein.net/cert.pem')
};

let socketTags = new Map();

// Create a secure HTTP1 server
// Exampleas:
// https://h1.arthuredelstein.net:8902/?mode=write&secret=123test
// https://h1.arthuredelstein.net:8902/?mode=read
const server = https.createServer(options, (request, response) => {
  let parsedURL = url.parse(request.path, true);
  let query = parsedURL.query;
  let socket = request.socket;
  if (query["mode"] === "write") {
    socketTags.set(socket, query["secret"]);
  }
  console.log("h1 request. socket tag found:", socketTags.get(socket));
  response.setHeader('Content-Type', 'text/plain');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.end(socketTags.get(socket));
});

server.listen(8902);
