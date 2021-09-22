const https = require('https');
const url = require("url");
const fs = require('fs');

const options = {
  key: fs.readFileSync('/home/arthur/certs/h1.arthuredelstein.net/privkey1.pem'),
  cert: fs.readFileSync('/home/arthur/certs/h1.arthuredelstein.net/cert1.pem')
};

let socketTags = new Map();

// Create a secure HTTP1 server
// Exampleas:
// https://h1.arthuredelstein.net:8901/?mode=write&secret=123test
// https://h1.arthuredelstein.net:8901/?mode=read
const server = https.createServer(options, (request, response) => {
  console.log(request.url);
  let parsedURL = url.parse(request.url, true);
  let query = parsedURL.query;
  let socket = request.socket;
  //console.log(socket);
  if (query["mode"] === "write") {
    socketTags.set(socket, query["secret"]);
    response.end();
  } else {
    let tagFound = socketTags.get(socket);
    console.log("h1 read request. socket tag found:", tagFound);
    response.setHeader('Content-Type', 'text/plain');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Connection', 'Keep-Alive');
    response.setHeader('Keep-Alive', 'timeout=300, max=1000');
    response.end(tagFound);
  }
});

server.listen(8901);
console.log("listening for h1 connections on 8901");
