/* Café Sobrado — Service Worker
 * Offline cache for the GitHub Pages project.
 */
const CACHE_NAME = 'cafe-sobrado-v2';

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./css/leaflet.css",
  "./css/L.Control.Layers.Tree.css",
  "./css/L.Control.Locate.min.css",
  "./css/qgis2web.css",
  "./css/fontawesome-all.min.css",
  "./css/leaflet.photon.css",
  "./css/leaflet-measure.css",
  "./js/qgis2web_expressions.js",
  "./js/leaflet.js",
  "./js/L.Control.Layers.Tree.min.js",
  "./js/L.Control.Locate.min.js",
  "./js/leaflet.rotatedMarker.js",
  "./js/leaflet.pattern.js",
  "./js/leaflet-hash.js",
  "./js/Autolinker.min.js",
  "./js/rbush.min.js",
  "./js/labelgun.min.js",
  "./js/labels.js",
  "./js/leaflet.photon.js",
  "./js/leaflet-measure.js",
  "./data/Mesclado_0.js",
  "./data/pontos_leve_2.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  // Navigation: use the network when available, otherwise the cached app.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets: cache first, then network and save a copy.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          try { cache.put(request, copy); } catch (e) {}
        });
        return response;
      });
    })
  );
});
