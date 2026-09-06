const CACHE_NAME = "bti-staff-shell-v1";
const OFFLINE_URL = "/staff";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([
          OFFLINE_URL,
          "/staff-icon.svg",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(
                  "bti-staff-shell-",
                ) && cacheName !== CACHE_NAME,
            )
            .map((cacheName) =>
              caches.delete(cacheName),
            ),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    request.mode !== "navigate"
  ) {
    return;
  }

  const requestUrl = new URL(request.url);

  if (
    requestUrl.origin !== self.location.origin ||
    !requestUrl.pathname.startsWith("/staff")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseCopy = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) =>
              cache.put(OFFLINE_URL, responseCopy),
            );
        }

        return response;
      })
      .catch(() => caches.match(OFFLINE_URL)),
  );
});
