# Sport Clock

A work/rest interval timer for gym use, served as a static web app.

Two timers — **WORK** and **REST** — run side by side. Each shows its
current round time, a countdown to the end of the round, and the total
time accumulated in that phase. The app is a single page with no build
step and no dependencies, so it can be hosted by any static file server.

## Features

- Separate work and rest timers with independent durations
- Countdown per round plus a running total per phase
- Audio cues: a short beep on every action, two high beeps in the last
  two seconds of a round, and a longer low beep when the round ends
- Session total across both phases
- History of completed rounds, split into work and rest columns
- The active phase is highlighted with a pulsing glow
- Installable as a PWA, with an icon on the home screen
- Works offline once loaded, and keeps running if the tab is backgrounded
- State survives a reload or a browser restart

## Usage

| Action | Result |
|---|---|
| Click the **WORK** or **REST** card | Starts that phase |
| Click the **active** card | Pauses the timer |
| Click the **other** card | Switches phase and records the finished round in the history |
| Press **Space** | Same as clicking the active card |
| Click a preset button | Sets that phase's duration |
| **Скинути все** | Resets timers, history and session total |

Durations are set in seconds through the number field in each card. The
three buttons next to it are quick presets; the most recently used
duration is kept and the list holds the three most recent values.

## Files

```
index.html               the app: markup, styles and logic in one file
sw.js                    service worker (offline support, update handling)
sport-clock-manifest.json  PWA manifest
icon-192.png             app icons
icon-512.png
icon-512-maskable.png
```

`index.html` must stay named `index.html`: the app is served from a
subdirectory, and the directory index is what the service worker's scope
resolves to.

## Deployment

Copy the files into the directory the server publishes, and make sure
`index.html` is the directory index.

The app is served as static files with directory listings enabled, so it
can live as a sibling of other static apps:

```
static-apps/
  sport-clock/     <- this app
  other-app/       <- another app
```

### Service worker and updates

The service worker fetches the app shell (`index.html` and the directory
index) from the network first and only falls back to the cache when
offline, so a new deploy is picked up on the next visit. Icons and the
manifest are served from the cache first, since they do not change
between releases.

**Bump `VERSION` in `sw.js` whenever `index.html` changes.** The
precache stores each asset under a `?v=VERSION` query string, so a new
version is required for the install to pick up changed files:

```js
const VERSION = '2026-11-02';
```

Skipping this step leaves clients on the previous release until the
cache is cleared manually.

After changing the worker itself, browsers pick up the new version on
their own. To force it immediately, unregister the worker and clear the
caches from the browser console:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
```

## Requirements

Any modern browser. The service worker requires HTTPS, or `localhost`
during development. Audio cues need the browser to allow autoplay
policy for the Web Audio API, which is satisfied by the user gesture
that starts a timer.

## Development

There is nothing to build or install. To work on the app locally, serve
the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. A service worker needs a secure
context, so `localhost` works but a plain LAN IP address does not.

To check that the service worker and the inline script parse cleanly:

```bash
node --check sw.js
```
