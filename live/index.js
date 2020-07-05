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
  "prefetch": {},
};
let resourceFiles = {
  "css": "stylesheet.css",
  "favicon": "favicon.png",
  "fetch": "page.html",
  "font": "font.woff",
  "image": "image.png",
  "page": "page.html",
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
  console.log(key, type, countMap[key]);
  res.set({
    "Cache-Control": "public, max-age=604800, immutable"
  });
  res.sendFile(resourceFiles[type], { root: __dirname });
});
app.get('/count', (req, res) => {
  let { key, type } = req.query;
  console.log(type, key, "count:", countMaps[type][key]);
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
  let { key, type } = req.query;
  res.set({ "Cache-Control": "max-age=0" });
  if (type === "request") {
    ifNoneMatchValues[key] = req.headers['if-none-match'];
    res.send(`etag test: ${key}`);
  } else if (type === "value") {
    res.send(`${ifNoneMatchValues[key]}`);
  }
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

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
