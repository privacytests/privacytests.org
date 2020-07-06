self.addEventListener('activate', function(event) {
  console.log('Claiming control');
  return self.clients.claim();
});

self.addEventListener("fetch", async (event) => {
  console.log("fetch received:", event);
  event.respondWith(new Response("Hi there from service worker!"));
});

