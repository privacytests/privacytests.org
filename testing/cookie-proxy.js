const mockttp = require('mockttp');

let hostsThatLeak = {};

// Takes a cookie string and returns a map with key-values.
const parseCookies = (cookieString) => {
  if (!cookieString) {
    return {};
  }
  let result = {};
  const cookieKVs = cookieString.split(";");
  for (let cookieKV of cookieKVs) {
    let [key, val] = cookieKV.split("=");
    result[key.trim()] = val.trim();
  }
  return result;
};

const simulateTrackingCookies = async () => { 
  // Allows us to match requests to responses.
  let idToUrlMapping = new Map();
  // Create a proxy server with a self-signed HTTPS CA certificate:
  const server = mockttp.getLocal({
    https: {
      keyPath: '../../.pto_certs/key.pem',
      certPath: '../../.pto_certs/cert.pem'
    },
    cors: true
  });
  server.forAnyRequest().thenPassThrough({
    // Inject cookies for responses
    beforeResponse: (response) => {
      const url = idToUrlMapping.get(response.id);
      idToUrlMapping.delete(response.id);
      const searchParams = (new URL(url)).searchParams;
      const sessionId = searchParams.get("sessionId");
      const writeCookie = searchParams.get("pto_write_cookie") === "true";
      let headers;
      headers = response.headers;
      let setCookieHeader;
      if (writeCookie && sessionId) {
        setCookieHeader = `pto_cookie=${sessionId}; max-age=3600; Secure; SameSite=None`;
        headers["set-cookie"] = setCookieHeader;
        console.log({url, sessionId, writeCookie, setCookieHeader});
        return { headers }
      }
      return undefined;
    },
    // Look for cookies in requests
    beforeRequest: (request) => {
      const url = request.url;
      idToUrlMapping.set(request.id, request.url);
      const searchParams = (new URL(url)).searchParams;
      const sessionId = searchParams.get("sessionId");
      const readCookie = searchParams.get("pto_read_cookie") === "true";
      const hostname = (new URL(request.url)).hostname;
      const pto_cookie = parseCookies(request.headers.cookie)["pto_cookie"];
      if (readCookie && pto_cookie === sessionId) {
        // We have found cookie sharing.
        hostsThatLeak[sessionId] ??= new Set();
        hostsThatLeak[sessionId].add(hostname);
      }
      if (readCookie) {
        console.log({url, readCookie, sessionId, pto_cookie});
      }
    }
  });
  await server.start(9090);
  console.log(`Tracking cookie proxy running on port ${server.port}`);
};

const getLeakyHosts = (sessionId) => hostsThatLeak[sessionId];

if (require.main === module) {
  simulateTrackingCookies();
}

module.exports = { simulateTrackingCookies, getLeakyHosts };