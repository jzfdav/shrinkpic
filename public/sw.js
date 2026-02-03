const CACHE_NAME = "shrinkpic-v1.3.2";
const baseUrl = new URL(self.registration.scope);
const CORE_ASSETS = [
  new URL(".", baseUrl).pathname,
  new URL("index.html", baseUrl).pathname,
  new URL("manifest.json", baseUrl).pathname,
  new URL("icon.svg", baseUrl).pathname,
  new URL("worker.js", baseUrl).pathname,
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (
          response &&
          response.status === 200 &&
          event.request.url.startsWith(self.location.origin) &&
          event.request.url.startsWith(baseUrl.origin + baseUrl.pathname)
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});
