const express = require('express')
const app = express()
const port = 3333

let countMap = {};

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/count', (req, res) => {
  let key = req.query.key;
  if (countMap[key]) {
    countMap[key] = countMap[key] + 1;
  } else {
    countMap[key] = 1;
  }
  res.set({
    "Cache-Control": "public, max-age=604800, immutable"
  });
  res.send(`${countMap[key]}`);
});


app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
