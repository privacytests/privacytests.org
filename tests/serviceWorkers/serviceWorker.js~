self.addEventListener("fetch", async (event) => {
  console.log("fetch received:", event);
  let clientList = await self.clients.matchAll();
  for (let client of clients) {
    client.postMessage("Hello from service worker!");
  }
  event.respondWith(new Response("Hi there from service worker!"));
});

