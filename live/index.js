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
};
let resourceFiles = {
  "css": "stylesheet.css",
  "favicon": "favicon.png",
  "fetch": "page.html",
  "font": "font.woff",
  "image": "image.png",
  "page": "page.html",
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
  res.set({
    "Cache-Control": "public, max-age=604800, immutable"
  });
  res.sendFile(resourceFiles[type], { root: __dirname });
});
app.get('/count', (req, res) => {
  let { key, type } = req.query;
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


app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
