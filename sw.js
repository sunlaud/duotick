const CACHE_NAME = 'sport-clock-v5';

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

function absolute(path) {
  return new URL(path, new URL('./', self.location.href)).href;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // The URLs are resolved against the worker scope, so the entries are
      // stored under the same keys the fetch handler looks them up with.
      const urls = PRECACHE.map(absolute);
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
    }).then(function () {
      // A newly activated worker may still carry a stale app shell from an
      // older release, so sync it as soon as the worker takes over.
      return updateShell();
    })
  );
});

function isShell(url) {
  return SHELL.some(function (path) {
    const pathname = new URL(absolute(path)).pathname;
    return url.pathname === pathname;
  });
}

function isCacheFirst(url) {
  return CACHE_FIRST.some(function (path) {
    return url.pathname === new URL(absolute(path)).pathname;
  });
}

// Re-fetch the app shell from the network and replace the cached copies if
// it changed. This is what lets a client pick up a new deploy without any
// manual version bump.
//
// The shell is cached under more than one URL: the directory index, which
// is what a visit to the scope root loads, and index.html itself. Both
// have to be refreshed, otherwise the copy that is actually served stays
// stale even though the worker noticed the change.
function updateShell() {
  const indexUrl = absolute('./index.html');
  const rootUrl = absolute('./');

  return fetch(indexUrl, { cache: 'no-cache' }).then(function (response) {
    if (!response || !response.ok) return Promise.resolve(false);
    return response.text().then(function (body) {
      return caches.open(CACHE_NAME).then(function (cache) {
        return cache.keys().then(function (requests) {
          // Refresh every cached copy of the shell that differs from the
          // copy on the server.
          const stale = requests.filter(function (request) {
            const path = new URL(request.url).pathname;
            return path === new URL(indexUrl).pathname || path === new URL(rootUrl).pathname;
          });
          return Promise.all(stale.map(function (request) {
            return cache.match(request).then(function (cached) {
              if (!cached) return Promise.resolve(false);
              return cached.text().then(function (text) {
                if (text === body) return Promise.resolve(false);
                return cache.put(request, new Response(body, {
                  headers: response.headers
                })).then(function () {
                  return true;
                });
              });
            });
          })).then(function (results) {
            return results.some(Boolean);
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
          return cached || caches.match(absolute('./index.html'));
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
        return cached || caches.match(absolute('./index.html'));
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

// Check for a newer deploy on request from the page, which covers browsers
// without periodicsync support.
self.addEventListener('message', function (event) {
  if (event.data === 'check-update') {
    event.waitUntil(updateShell());
  }
});

// Poll for updates while the app is open, so a long-lived tab still picks up
// a new deploy.
setInterval(function () {
  updateShell();
}, 30 * 60 * 1000);
