/* eslint-disable camelcase */

const mockttp = require('mockttp');
const fs = require('fs');
const cert = require('./cert');
let server;
const hostsThatLeak = {};

// Takes a cookie string and returns a map with key-values.
const parseCookies = (cookieString) => {
  if (!cookieString) {
    return {};
  }
  const result = {};
  const cookieKVs = cookieString.split(';');
  for (const cookieKV of cookieKVs) {
    const [key, val] = cookieKV.split('=');
    if (val === undefined) {
      throw new Error('no key/val pairs found');
    }
    result[key.trim()] = val.trim();
  }
  return result;
};

// Start the simulation of tracking cookies by launching a proxy
// that reads and writes third-party cookies. Injects a tracking
// cookie if URL has "pto_write_cookie" query parameter; looks
// for a cookie if URL has "pto_read_cookie" query parameter.
const simulateTrackingCookies = async (port, debug = false) => {
  console.log('simulateTrackingCookies');
  // Allows us to match requests to responses.
  const idToUrlMapping = new Map();
  const certPaths = await cert.setupCertificate();
  // Create a proxy server with a self-signed HTTPS CA certificate:
  server = mockttp.getLocal({
    https: certPaths,
    cors: true
  });
  const certFile = fs.readFileSync(certPaths.certPath).toString();
  server.forGet('http://p.test').thenReply(200, '<html><body><h1><a href="ca">Download Certificate</a></h1></body></html>');
  server.forGet('http://p.test/ca').thenReply(200, certFile,
    {
      'content-type': 'application/x-x509-ca-cert',
      'content-disposition': 'inline; filename=rootCA.pem'
    });
  server.forAnyRequest().thenPassThrough({
    // Inject cookies for responses
    beforeResponse: (response) => {
      const url = idToUrlMapping.get(response.id);
      if (debug) {
        console.log(url, response.headers);
      }
      idToUrlMapping.delete(response.id);
      const searchParams = (new URL(url)).searchParams;
      const sessionId = searchParams.get('sessionId');
      const writeCookie = searchParams.get('pto_write_cookie') === 'true';
      const headers = response.headers;
      let setCookieHeader;
      if (writeCookie && sessionId) {
        setCookieHeader = `pto_cookie=${sessionId}; max-age=3600; Secure; SameSite=None`;
        headers['set-cookie'] = setCookieHeader;
        const time = new Date().toUTCString();
        console.log({ time, url, sessionId, writeCookie, setCookieHeader });
        return { headers };
      }
      return undefined;
    },
    // Look for cookies in requests
    beforeRequest: (request) => {
      const url = request.url;
      idToUrlMapping.set(request.id, request.url);
      const searchParams = (new URL(url)).searchParams;
      const sessionId = searchParams.get('sessionId');
      const readCookie = searchParams.get('pto_read_cookie') === 'true';
      const hostname = (new URL(request.url)).hostname;
      const pto_cookie = parseCookies(request.headers.cookie).pto_cookie;
      if (readCookie && pto_cookie === sessionId) {
        // We have found cookie sharing.
        hostsThatLeak[sessionId] ??= new Set();
        hostsThatLeak[sessionId].add(hostname);
      }
      if (readCookie) {
        const time = new Date().toUTCString();
        console.log({ time, url, readCookie, sessionId, pto_cookie });
      }
    }
  });
  await server.start(port);
  console.log(`Tracking cookie proxy running on port ${server.port}`);
};

// Returns the list of leaky hosts.
const getLeakyHosts = (sessionId) => hostsThatLeak[sessionId];

// Stop the tracking cookie simulation.
const stopTrackingCookieSimulation = () => {
  server.stop();
};

if (require.main === module) {
  simulateTrackingCookies(9090, true);
  // console.log(getLeakyHosts());
  // stopTrackingCookieSimulation();
}

module.exports = { simulateTrackingCookies, getLeakyHosts, stopTrackingCookieSimulation };
