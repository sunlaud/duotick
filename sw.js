const CACHE_NAME = 'sport-clock-v3';

// Version is bumped on deploy to bust the precache. Update it whenever the
// app shell changes so clients pick up the new version on the next visit.
const VERSION = '2026-11-02';

const PRECACHE = [
  './',
  './index.html',
  './sport-clock-manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// The app shell must always be fetched from the network first, otherwise a
// new deploy is never picked up: the cached copy would be served forever.
const SHELL = ['./', './index.html'];

// Immutable assets can be served from the cache first.
const CACHE_FIRST = ['./sport-clock-manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cache-bust the precache so the install always pulls fresh copies
      // instead of reusing entries from a previous cache version.
      const urls = PRECACHE.map(function (url) {
        return url + '?v=' + VERSION;
      });
      return cache.addAll(urls);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return Promise.resolve(false);
      }));
    }).then(function () {
      // Take over open tabs immediately so a new version is used without
      // requiring the user to close every tab first.
      return self.clients.claim();
    })
  );
});

function isShell(url) {
  return SHELL.some(function (path) {
    return url.pathname.endsWith(path.replace('./', '/')) ||
           url.pathname === path.replace('./', '/');
  });
}

function isCacheFirst(url) {
  return CACHE_FIRST.some(function (path) {
    return url.pathname.endsWith(path.replace('./', '/'));
  });
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: network-first, fall back to cache when offline.
  if (isShell(url)) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Versioned assets: cache-first, refresh in the background.
  if (isCacheFirst(url)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        const network = fetch(request).then(function (response) {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return response;
        });
        return cached || network;
      })
    );
    return;
  }

  // Everything else: network-first with cache fallback.
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
