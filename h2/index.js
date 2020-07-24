const http2 = require('http2');
const url = require("url");
const fs = require('fs');

const options = {
  key: fs.readFileSync('/home/arthur/certs/h2.arthuredelstein.net/privkey.pem'),
  cert: fs.readFileSync('/home/arthur/certs/h2.arthuredelstein.net/cert.pem')
};
// Create a secure HTTP/2 server
const server = http2.createSecureServer(options);

let sessionTags = new Map();

// Exampleas:
// https://h2.arthuredelstein.net:8901/?mode=write&secret=123test
// https://h2.arthuredelstein.net:8901/?mode=read
server.on('request', (request, response) => {
  let path = request.headers[":path"];
  let parsedURL = url.parse(path, true);
  let query = parsedURL.query;
  if (query["mode"] === "write") {
    sessionTags.set(request.session, query["secret"]);
  }
  response.setHeader('Content-Type', 'text/plain');
  response.end(sessionTags.get(request.session));
});
server.listen(8901);
