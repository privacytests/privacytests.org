const express = require('express');
const app = express();
const port = 3334;

app.get('/', (req, res) =>
  res.send(`
<html>
  <head>
    <title>Query parameter tests</title>
  </head>
 <body data-test-results=${JSON.stringify(req.query)} style="font-family: monospace; ">
<pre>
${JSON.stringify(req.query, null, 2)}
</code>
 </pre>
</html>`));

app.listen(port, () => console.log(`listening for search param requests on ${port}`));
