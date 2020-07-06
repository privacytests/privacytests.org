self.addEventListener('activate', function(event) {
  console.log('Claiming control');
  return self.clients.claim();
});

const scope = self.registration.scope;
let secret = undefined;

self.addEventListener("fetch", async (event) => {
  let shortPath = event.request.url.split(scope)[1];
  if (shortPath.startsWith("serviceworker-write?")) {
    secret = (new URL(event.request.url)).searchParams.get("secret");
    event.respondWith(new Response(""));
  } else if (shortPath === "serviceworker-read") {
    event.respondWith(new Response(secret));
  }
});

