# DuoTick

Two alternating timers for work and rest, served as a static web app.

The two timers — **WORK** and **REST** — run side by side, but only one of
them runs at a time. Each counts **up**: the number on the card is the time
elapsed in the current round, and a countdown underneath it only tells you
that the time is up. Nothing switches by itself; you decide when the phase
changes, so the routine stays flexible. The app is a single page with no
build step and no dependencies, so it can be hosted by any static file
server.

## Features

- Two alternating timers — work and rest — with independent durations
- The active timer counts up; the countdown only informs
- Audio cues: a short beep on every action, two high beeps in the last
  two seconds of a round, and a longer low beep when the round ends
- Session total across both phases
- History of completed rounds, with work and rest side by side and the
  actual time on top of the planned time
- The active phase is highlighted with a pulsing glow
- Installable as a PWA, with an icon on the home screen
- Shows the app version in the footer
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
duotick-manifest.json    PWA manifest
icon-192.png             app icons
icon-512.png
icon-512-maskable.png
```

`index.html` must stay named `index.html`: the app is served from a
subdirectory, and the directory index is what the service worker's scope
resolves to.

## Version

The version is shown in the footer of the app. It is defined once, as
`version` in `duotick-manifest.json`, and should be bumped on any
change to the app. The page reads it from the manifest.

## Deployment

### GitHub Pages

The repository is published to GitHub Pages by a workflow in
`.github/workflows/pages.yml`. Every push to `master` deploys the
repository as the site, so the app is served from:

```
https://<user>.github.io/<repo>/
```

To set it up:

1. Push the repository to GitHub.
2. In the repository settings, under **Pages**, set **Build and
   deployment → Source** to **GitHub Actions**.
3. Push, or run the **Deploy to GitHub Pages** workflow manually from the
   Actions tab.

The app is written to work under a subpath: every URL is relative to the
page, the service worker registers with the scope `./`, and the manifest
points at `./`. The `.nojekyll` file makes sure the files are served
exactly as they are in the repository.

Note that GitHub Pages serves over HTTPS, which the service worker
requires.

### Other servers

Copy the files into the directory the server publishes, and make sure
`index.html` is the directory index.

The app is served as static files with directory listings enabled, so it
can live as a sibling of other static apps:

```
static-apps/
  duotick/       <- this app
  other-app/     <- another app
```

### Service worker and updates

The service worker fetches the app shell (`index.html` and the directory
index) from the network first and only falls back to the cache when
offline. The icons are served from the cache first, since they do not
change between releases. The manifest is fetched from the network as
well, because the page reads the version from it.

**No manual step is needed to push a new version to clients.** The worker
compares the copy of `index.html` on the server with the one in the cache
and replaces the cached copy when they differ. The shell is cached under
two URLs, the directory index and `index.html` itself, and both are
refreshed, since a visit to the scope root is served from the former. The
check runs:

- when the worker activates
- when the app is brought back to the foreground
- every 30 minutes while the app is open

So a phone that has the app installed picks up a new deploy on its next
visit, without a console and without reinstalling.

The server must not cache `sw.js` or `index.html` aggressively, or the
browser will keep using the old worker. The nginx config for this app
sets `Cache-Control: no-cache, no-store, must-revalidate` on `sw.js` and
`no-cache, must-revalidate` on `index.html`.

To force an immediate update while developing, unregister the worker and
clear the caches from the browser console:

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
