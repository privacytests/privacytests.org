self.addEventListener("fetch", event => {
  let url = new URL(event.request.url);
  if (url.pathname.startsWith("/test")) {
    event.respondWith(new Response("Hello from worker!"));
  }
});

