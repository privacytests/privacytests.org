var secret;

onconnect = function(e) {
  var port = e.ports[0];

  port.onmessage = function(e) {
    if (e.data === "request") {
      port.postMessage(secret);
    } else {
      secret = e.data;
    }
  }
}
