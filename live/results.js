

const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors = require('cors');

const app = express();
const { WebSocketServer } = require('ws');


let websockets = {};

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => res.send('Hello World!'));

app.post('/post', (req, res) => {
  console.log("post received.");
  let { sessionId, data } = req.body;
  if (!sessionId || !websockets[sessionId]) {
    // We don't recognized this as an existing sessionId.
    console.log(`Unknown sessionId '${sessionId}'; Sending 404.`);
    res.sendStatus(404);
  } else {
    // We received some data for a valid session. Forward
    // that data to the websocket assigned to the same sessionId.
    const message = JSON.stringify({sessionId, data});
    console.log("received posted data. sending to ws:", message.substr(0, 100) + "...");
    websockets[sessionId].send(message);
    // Send an acknowledgment to the client that posted.
    res.send({sent: true, sessionId});
  }
});

app.listen(3335, () => console.log(`listening for data submissions`));

const wss = new WebSocketServer({ port: 3336 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      console.log('received: %s', JSON.parse(message));
    } catch (e) {
      console.log(e, message);
    }
  });

  // A new session. Create a sessionId and send it to the websocket client.
  const sessionId = uuidv4();
  const message = JSON.stringify({sessionId, "connected": true});
  console.log("sending to ws:", message);
  websockets[sessionId] = ws;
  ws.send(message);
});

