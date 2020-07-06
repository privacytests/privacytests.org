self.addEventListener('fetch', (event) => {
  let clientList = await clients.matchAll();
  for (let client of clientList) {
    client.postMessage("hello from service worker!");
  }
});

