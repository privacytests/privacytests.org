const https = require('https');
const url = require("url");
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/h1.privacytests2.org/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/h1.privacytests2.org/fullchain.pem')
};

let socketTags = new Map();

// Create a secure HTTP1 server
// Examples:
// https://h1.privacytests2.org:8901/?mode=write&secret=123test
// https://h1.privacytests2.org:8901/?mode=read
const server = https.createServer(options, (request, response) => {
  console.log(request.url);
  let parsedURL = url.parse(request.url, true);
  let query = parsedURL.query;
  let socket = request.socket;
  //console.log(socket);
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Connection', 'Keep-Alive');
  response.setHeader('Keep-Alive', 'timeout=300, max=1000');
  if (query["mode"] === "write") {
    socketTags.set(socket, query["secret"]);
    response.end();
  } else if (query["mode"] === "read") {
    let tagFound = socketTags.get(socket);
    console.log("h1 read request. socket tag found:", tagFound);
    response.end(tagFound);
  } else if (query["mode"] === "ip") {
    response.end(socket.remoteAddress);
  } else {
    response.end();
  }
});

server.keepAliveTimeout = 300000;
console.log("server.keepAliveTimeout:", server.keepAliveTimeout);

server.listen(8901);
console.log("listening for h1 connections on 8901");
