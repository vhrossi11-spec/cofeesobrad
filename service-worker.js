const CACHE_NAME = 'cafe-sobrado-v1';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/leaflet.css',
  './css/L.Control.Layers.Tree.css',
  './css/L.Control.Locate.min.css',
  './css/qgis2web.css',
  './css/fontawesome-all.min.css',
  './css/leaflet.photon.css',
  './css/leaflet-measure.css',
  './js/qgis2web_expressions.js',
  './js/leaflet.js',
  './js/L.Control.Layers.Tree.min.js',
  './js/L.Control.Locate.min.js',
  './js/leaflet.rotatedMarker.js',
  './js/leaflet.pattern.js',
  './js/leaflet-hash.js',
  './js/Autolinker.min.js',
  './js/rbush.min.js',
  './js/labelgun.min.js',
  './js/labels.js',
  './js/leaflet.photon.js',
  './js/leaflet-measure.js',
  './data/Mesclado_0.js',
  './data/pontos_leve_2.js',
  './data/ortoleve_1.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './webfonts/fa-solid-900.ttf',
  './webfonts/fa-solid-900.woff2'
];
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(LOCAL_ASSETS);
    for (const url of EXTERNAL_ASSETS) {
      try {
        const response = await fetch(url, { mode: 'no-cors' });
        await cache.put(url, response);
      } catch (e) {
        console.warn('Não foi possível pré-cachear:', url, e);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (e) {
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
