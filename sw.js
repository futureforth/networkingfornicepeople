/* NicePeople service worker — app-shell caching for install + offline resilience.
   No push, no background sync: this alpha stays zero-backend. */

var CACHE_NAME = "nicepeople-v1";
var APP_SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () {
        // if a shell file 404s (e.g. different deploy layout) don't block install
      });
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE_NAME;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  // Page navigations: try the network first (fresh content when online),
  // fall back to the cached app shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match("./index.html");
      })
    );
    return;
  }

  // Everything else (icons, manifest, and the CDN scripts for QR
  // generation/scanning): cache-first, then network — and cache whatever
  // we fetch so it works offline next time too.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req)
        .then(function (res) {
          if (res && (res.ok || res.type === "opaque")) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return cached;
        });
    })
  );
});
