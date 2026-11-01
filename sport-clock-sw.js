const CACHE_NAME = 'sport-clock-v1';
const ASSETS = [
  'sport-clock.html',
  'sport-clock-manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];
self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(ASSETS); }));
});
self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) { return Promise.all(keys.map(function(k) { return k !== CACHE_NAME ? caches.delete(k); }); }); }));
});
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(function(c) { c.put(event.request, copy); }); }
        return response;
      }).catch(function() { return caches.match(event.request).then(function(f) { return f || caches.match('sport-clock.html'); }); });
    })
  );
});
