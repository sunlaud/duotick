# DuoTick

A work timer, a rest timer, and nothing that switches them for you.

One static page, installable as an app, free of accounts and data
collection.

**Try it:** <https://sunlaud.github.io/duotick/>

The two timers sit side by side, but only one of them runs at a time.
Each counts **up**: the number on the card is the time elapsed in the
current round, and the countdown underneath only tells you that the
time is up. You decide when the phase changes, so the routine stays
flexible.

Installed, the app opens full-screen and works offline, and still picks
up a new version on its next visit.

The interface speaks Ukrainian and English. It follows the browser
language on the first visit, and two flags in the footer (🇺🇦 and 🇬🇧)
switch it; the choice is remembered in local storage.

## Features

- Two timers — work and rest — side by side, with independent durations
- Audio cues: a short beep on every action, two high beeps in the last
  two seconds of a round, and a longer low beep when the round ends
- Session total across both phases
- History of completed rounds, with work and rest side by side and the
  actual time on top of the planned time
- The active phase is highlighted with a pulsing glow
- Shows the app version in the footer
- Works offline once loaded, and keeps running if the tab is backgrounded
- State survives a reload or a browser restart

## Usage

| Action | Result |
|---|---|
| Click the **РОБОТА**/**WORK** or **ВІДПОЧИНОК**/**REST** card | Starts that phase |
| Click the **active** card | Pauses the timer |
| Click the **other** card | Switches phase and records the finished round in the history |
| Press **Space** | Same as clicking the active card |
| Click a preset button | Sets that phase's duration |
| **Скинути все**/**Reset all** | Resets timers, history and session total |

Durations are set in seconds through the number field in each card. The
three buttons next to it are quick presets; the most recently used
duration is kept and the list holds the three most recent values.

On a narrow screen the two timers stack vertically, while the history
keeps work and rest side by side.

## Requirements

Any modern browser. The service worker requires HTTPS, or `localhost`
during development. Audio cues need the browser to allow autoplay
policy for the Web Audio API, which is satisfied by the user gesture
that starts a timer.

Everything is stored on the device in `localStorage`, under the `dt_*`
keys: durations, the chosen language and the whole session (timers,
history, round numbers). Clearing the site data resets the app
completely; nothing is sent to a server.

## Updates

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

To force an immediate update while developing, unregister the worker and
clear the caches from the browser console:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
```

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

Being a single page with no build step and no dependencies, it runs
from any static file server: copy the files into the directory the
server publishes, and make sure `index.html` is the directory index.

The app is served as static files with directory listings enabled, so it
can live as a sibling of other static apps:

```
static-apps/
  duotick/       <- this app
  other-app/     <- another app
```

The server must not cache `sw.js` or `index.html` aggressively, or the
browser will keep using an old version. For nginx:

```
Cache-Control: no-cache, no-store, must-revalidate   on sw.js
Cache-Control: no-cache, must-revalidate             on index.html
```

## Development

There is nothing to build or install. For a quick look no server is
needed at all: a plain double-click on `index.html` opens the working
app, and local storage keeps working. What `file://` cannot do is the
service worker with its offline mode, the installation and the manifest
fetch — so a local copy is fully usable, yet it cannot be installed,
and the footer shows no version. Serve over HTTP for those:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. A service worker needs a secure
context, so `localhost` works but a plain LAN IP address does not.

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

The version is shown in the footer of the app. It is defined once, as
`version` in `duotick-manifest.json`, and should be bumped on any change
to the app. The page reads it from the manifest.

To check that the service worker and the inline script parse cleanly:

```bash
node --check sw.js
awk '/<script>/{f=1; next} /<\/script>/{f=0} f' index.html > /tmp/duotick-inline.js
node --check /tmp/duotick-inline.js
```

## License

MIT — see [LICENSE](LICENSE).
