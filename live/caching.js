const express = require('express')
const app = express()
const port = 3333

let countMaps = {
  "css": {},
  "favicon": {},
  "fetch": {},
  "font": {},
  "image": {},
  "page": {},
  "preload": {},
  "prefetch": {},
};
let resourceFiles = {
  "css": "stylesheet.css",
  "favicon": "favicon.png",
  "fetch": "page.html",
  "font": "font.woff",
  "image": "image.png",
  "page": "page.html",
  "preload": "page.html",
  "prefetch": "page.html",
};

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/resource', (req, res) => {
  let { key, type } = req.query;
  let countMap = countMaps[type];
  if (countMap[key]) {
    countMap[key] = countMap[key] + 1;
  } else {
    countMap[key] = 1;
  }
  console.log(`Requested: ${req.url} ; Count: ${countMap[key]}`);
  res.set({
    "Cache-Control": "public, max-age=604800, immutable"
  });
  res.sendFile(resourceFiles[type], { root: __dirname });
});
app.get('/ctr', (req, res) => {
  let { key, type } = req.query;
  console.log(`                                                         Count checked for ${type}, ${key}: ${countMaps[type][key]}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(`${countMaps[type][key] || 0}`);
});
app.get('/altsvc', (req, res) => {
  res.set({
    "Alt-Svc": "h2=\"torpat.ch:443\"; ma=2592000;"
  })
  res.send("Alt-Svc");
});

let ifNoneMatchValues = {};

app.get('/etag', (req, res) => {
  console.log(req.url);
  let { key } = req.query;
  requestIfNoneMatch = req.headers["if-none-match"];
  console.log("requestIfNoneMatch:", requestIfNoneMatch);
  if (requestIfNoneMatch) {
    res.set( { "x-received-if-none-match": requestIfNoneMatch } );
  }
  res.set( {"Cache-Control": "max-age=0" });
  res.send(key);
});

app.get('/set_hsts.png', (req, res) => {
  res.set({ "Strict-Transport-Security": "max-age=20" });
  res.sendFile("image.png", { root: __dirname });
});

app.get('/test_hsts.png', (req, res) => {
  res.sendFile("image.png", { root: __dirname });
});

let passwordCounts = {};

// HTTP Basic Auth (not used for now)
app.get('/auth', (req, res) => {
  let auth = req.get("authorization");
  console.log(auth);
  if (auth) {
    let decodedAuth = Buffer.from(auth.split("Basic ")[1], 'base64')
        .toString('utf-8');
    let [username, password] = decodedAuth.split(":");
    if (passwordCounts[password]) {
      passwordCounts[password] = passwordCounts[password] + 1;
    } else {
      passwordCounts[password] = 1;
    }
    let results = { username, password, count: passwordCounts[password] };
    res.status(200)
    res.send(JSON.stringify(results));
  } else {
    res.set({
      'WWW-Authenticate': 'Basic realm="User Visible Realm", charset="UTF-8"',
      "Cache-Control": "max-age=0"
    })
    res.status(401)
    res.send("empty");
  }
});

app.get('/headers', (req, res) => {
  console.log("/headers requested: sending", JSON.stringify(req.headers, null, 2));
  res.json(req.headers);
});

app.listen(port, () => console.log(`listening for file requests on ${port}`));

app.set("etag", true);
