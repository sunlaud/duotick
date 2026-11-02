const CACHE_NAME = 'sport-clock-v4';

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
      // Fetch with a cache-busting query so the install always pulls fresh
      // copies from the server instead of reusing entries from the HTTP
      // cache or from a previous version of this cache.
      //
      // URLs are resolved against the worker scope, so they are absolute
      // here: relative URLs are matched by the Cache API against the
      // scope, which makes the clean and cache-busted entries disagree.
      const scope = new URL('./', self.location.href);
      const urls = PRECACHE.map(function (url) {
        return new URL(url, scope).href + '?update=' + Date.now();
      });
      return cache.addAll(urls).then(function () {
        // Store the shell under its clean URL too, so it can be served from
        // the cache while offline.
        return Promise.all(urls.map(function (url) {
          const clean = url.split('?')[0];
          return cache.match(url).then(function (response) {
            return cache.put(clean, response);
          });
        }));
      });
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
    }).then(function () {
      // A newly activated worker may still carry a stale app shell from an
      // older release, so sync it as soon as the worker takes over.
      return updateShell();
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

// Re-fetch the app shell from the network and replace the cached copy if it
// changed. This is what lets a client pick up a new deploy without any
// manual version bump: the worker compares the server's index.html with the
// cached one and updates the cache when they differ.
function updateShell() {
  const scope = new URL('./', self.location.href);
  const shellUrl = new URL('./index.html', scope).href;
  return fetch(shellUrl, { cache: 'no-cache' }).then(function (response) {
    if (!response || !response.ok) return Promise.resolve(false);
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(shellUrl).then(function (cached) {
        if (!cached) {
          return cache.put(shellUrl, response.clone()).then(function () {
            return true;
          });
        }
        // Compare the bodies to find out whether the app changed.
        return Promise.all([cached.clone().text(), response.clone().text()]).then(function (texts) {
          if (texts[0] === texts[1]) return false;
          return cache.put(shellUrl, response.clone()).then(function () {
            return true;
          });
        });
      });
    });
  }).catch(function () {
    // Offline: nothing to update.
    return false;
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

// Check for a newer deploy in the background. Chrome fires this for
// installed PWAs, and it lets a client that has been left open pick up a
// change without a manual reload.
self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'check-update') {
    event.waitUntil(updateShell());
  }
});

// Poll for updates while the app is open, so a long-lived tab still picks up
// a new deploy. This covers browsers that do not support periodicsync.
self.addEventListener('message', function (event) {
  if (event.data === 'check-update') {
    event.waitUntil(updateShell());
  }
});

setInterval(function () {
  updateShell();
}, 30 * 60 * 1000);
