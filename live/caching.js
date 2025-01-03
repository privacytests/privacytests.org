const express = require('express');
const app = express();
const port = 3333;
const path = require('node:path');
const { Readable } = require( "stream" );

const resourceFiles = {
  favicon: 'favicon.png',
  fetch: 'page.html',
  font: 'font.woff',
  image: 'image.png',
  page: 'page.html',
  preload: 'page.html',
  prefetch: 'page.html',
  script: 'test.js',
  xhr: 'page.html'
};

const fileGenerators = {
  css: () => `#css { font-family: fake_${Math.random().toString().slice(2)}; }`
};

const mimeTypes = {
  favicon: 'image/png',
  fetch: 'text/html',
  font: 'font/woff',
  image: 'image/png',
  page: 'text/html',
  preload: 'text/html',
  prefetch: 'text/html',
  css: 'text/css',
  script: 'application/javascript',
  xhr: 'text/html'
};


const countMaps = {
  css: {},
  favicon: {},
  fetch: {},
  font: {},
  image: {},
  page: {},
  preload: {},
  prefetch: {},
  script: {},
  xhr: {}
};

const blobs = {

};

const ipAddresses = {

};

const getIpAddress = (req) => req.header('x-forwarded-for') || req.connection.remoteAddress;

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  next();
});

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/resource', (req, res) => {
  const ip = getIpAddress(req);
  const { key, type } = req.query;
  ipAddresses[key] ||= {};
  ipAddresses[key][type] = ip;
  console.log({ip, key, type});
  const countMap = countMaps[type];
  if (countMap[key]) {
    countMap[key] = countMap[key] + 1;
  } else {
    countMap[key] = 1;
  }
  console.log(`Requested: ${req.url} ; Count: ${countMap[key]}`);
  res.set({
    'Cache-Control': 'public, max-age=604800, immutable'
  });
  res.setHeader('content-type', mimeTypes[type]);
  const file = resourceFiles[type];
  if (file) {
    res.sendFile(file, { root: __dirname });
  } else {
    res.send(fileGenerators[type]());
  }
});
app.get('/ctr', (req, res) => {
  const { key, type } = req.query;
  console.log(`                                                         Count checked for ${type}, ${key}: ${countMaps[type][key]}`);
  res.send(`${countMaps[type][key] || 0}`);
});

app.get('/ips', (req, res) => {
  const { key } = req.query;
  res.send(`${JSON.stringify(ipAddresses[key] || {})}`);
});

app.get('/etag', (req, res) => {
  console.log(req.url);
  const { key } = req.query;
  const requestIfNoneMatch = req.headers['if-none-match'];
  console.log('requestIfNoneMatch:', requestIfNoneMatch);
  if (requestIfNoneMatch) {
    res.set({ 'x-received-if-none-match': requestIfNoneMatch });
  }
  res.set({ 'Cache-Control': 'max-age=0' });
  res.send(key);
});

// ## HSTS cache tests

app.get('/set_hsts.html|/test_hsts.html|/clear_hsts.html|/set_hsts2.html|/test_hsts2.html|/clear_hsts2.html|/hsts.js|/hsts2.js|/post_data.js|/test.css|/set_hsts.js|/test_hsts.js|/clear_hsts.js',
        (req, res) => {
          const headers = {
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          };
          res.sendFile(path.normalize(__dirname + '/../static' + req.path), { headers });
        });

app.get('/set_hsts.png', (req, res) => {
  const headers = {
    'Strict-Transport-Security': 'max-age=30',
    'Cache-Control': 'max-age=0'
  };
  res.sendFile('image.png', { root: __dirname, headers });
});

app.get('/test_hsts.png', (req, res) => {
  const headers = { 'Cache-Control': 'max-age=0' };
  res.sendFile('image.png', { root: __dirname, headers });
});

app.get('/clear_hsts.png', (req, res) => {
  const headers = {
    'Strict-Transport-Security': 'max-age=0',
    'Cache-Control': 'max-age=0'
  };
  res.sendFile('image.png', { root: __dirname, headers });
});

app.get('/set_hsts2_file.html', (req, res) => {
  const headers = {
    'Strict-Transport-Security': 'max-age=30',
    'Cache-Control': 'max-age=0'
  };
  res.sendFile('page.html', { root: __dirname, headers });
});

app.get('/test_hsts2_file.html', (req, res) => {
  const headers = { 'Cache-Control': 'max-age=0',
                    'Content-Type': 'text/html'};
  res.sendFile('page.html', { root: __dirname, headers });
});

app.get('/clear_hsts2_file.html', (req, res) => {
  const headers = {
    'Strict-Transport-Security': 'max-age=0',
    'Cache-Control': 'max-age=0'
  };
  res.sendFile('page.html', { root: __dirname, headers });
});

app.get('/headers', (req, res) => {
  console.log('/headers requested: sending', JSON.stringify(req.headers, null, 2));
  res.json(req.headers);
});

app.get('/cookie', (req, res) => {
  const secret = req.query.secret;
  const cookieHeader = `secret=${secret}; HTTPOnly; max-age=3600; SameSite=None; Secure`;
  res.set({
    'set-cookie': cookieHeader
  });
  res.send(`<!DOCTYPE html><html><body><pre>set-cookie: ${cookieHeader}</pre></body></html>`);
});

app.get('/blob', (req, res) => {
  const { key, mode, blobUrl } = req.query;
  console.log('hi from /blob', { key, mode, blobUrl });
  if (mode === 'write') {
    blobs[key] = blobUrl;
  }
  res.json({ blobUrl: blobs[key] });
});

const pageTemplate = (contents) =>
`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8">
    <link rel="shortcut icon" href="data:image/x-icon;," type="image/x-icon">
  </head>
  <body>
${contents}
  </body>
</html>`;

app.get('/toplevel.html', (req, res) => {
  const ip = getIpAddress(req);
  const gpcHeaderValue = req.header('Sec-GPC');
  console.log(ip);
  console.log({ gpcHeaderValue });
  res.setHeader('content-type', 'text/html');
  res.send(pageTemplate(`
    <script src="https://test-pages.privacytests2.org/post_data.js"></script>
    <script>
      const results = {
        "IP address leak": {
          "ipAddress": "${ip}",
          "description": "IP addresses can be used to uniquely identify a large percentage of users. A proxy, VPN, or Tor can mask a user's IP address."
        },
        "GPC enabled first-party": {
          "header value": "${gpcHeaderValue}",
          "description": "The Global Privacy Control is an HTTP header that can be sent by a browser to instruct a website not to sell the user's personal data to third parties. This test checks to see if the GPC header is sent by default to the top-level website.",
          "passed": ${gpcHeaderValue === '1'}
        }
      };
      postData(results, "toplevel");
    </script>
`));
});

// A list of Client Hints header names:
const clientHints = [
  'Sec-CH-UA',
  'Sec-CH-UA-Arch',
  'Sec-CH-UA-Bitness',
  'Sec-CH-UA-Full-Version-List',
  'Sec-CH-UA-Full-Version',
  'Sec-CH-UA-Mobile',
  'Sec-CH-UA-Model',
  'Sec-CH-UA-Platform',
  'Sec-CH-UA-Platform-Version',
  'Sec-CH-Prefers-Reduced-Motion',
  'Sec-CH-Prefers-Color-Scheme',
  'Device-Memory',
  'DPR, Width',
  'Viewport-Width',
  'Save-Data',
  'Downlink',
  'ECT',
  'RTT'
];

const clientHintsHeaders = (req) => {
  const results = {};
  const clientHintsLower = clientHints.map(h => h.toLowerCase());
  for (const [k, v] of Object.entries(req.headers)) {
    if (clientHintsLower.includes(k.toLowerCase())) {
      results[k] = v;
    }
  }
  return results;
};

app.get('/client_hints.html', (req, res) => {
  console.log(req.headers);
  res.setHeader('content-type', 'text/html');
  res.setHeader('Accept-CH', clientHints.join(', '));
  const isIframe = req.query.iframe === 'true';
  res.send(pageTemplate(
    isIframe
      ? JSON.stringify(clientHintsHeaders(req))
      : '<iframe width="100%" height="100%" src=\'/live/client_hints.html?iframe=true\'></iframe>'));
});

app.get('/torbulkexitlist', async (req, res) => {
  const fetchResponse = await fetch('https://check.torproject.org/torbulkexitlist');
  Readable.fromWeb(fetchResponse.body).pipe(res);
});

app.listen(port, () => console.log(`listening for file requests on ${port}`));

app.set('etag', true);
