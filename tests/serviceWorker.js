self.addEventListener('activate', function(event) {
  console.log('Claiming control');
  return self.clients.claim();
});

self.addEventListener("fetch", async (event) => {
  let scope = event.registration.scope;
  let path = event.request.url.split(scope)[1];
  console.log("fetch received:", path);
  event.respondWith(new Response("Hi there from service worker!"));
});

