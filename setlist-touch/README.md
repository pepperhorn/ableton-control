# Setlist Touch

A touch-first song/scene launcher for Ableton Live 12 Suite on Windows, served by a Max for Live MIDI Effect. Browsing songs never launches them. Playback and queued state come from the last regular track in the set; its timing clips must mirror the music's follow actions.

## Install and open

1. Copy the **entire `setlist-touch/device` folder** to the laptop, keeping `lib/`, `web/`, fonts and scripts beside `SetlistTouch.amxd`. Do not copy only the `.amxd`; this is an unfrozen device with external files.
2. Drop `SetlistTouch.amxd` on a MIDI track. Use **one instance per laptop** (one server and shared Max dictionary). MIDI passes through unchanged. Node for Max starts with the device; Max supplies `max-api`, so there is no npm install.
3. The rack panel shows a LAN address. Click **Open** for the resizable 1200×800 jweb window. The window uses presentation mode; the embedded page resizes with it. Max manages saved window geometry when the set/device is saved; cross-session geometry retention still needs verification on Windows.
4. In a laptop browser open `http://localhost:8765/#settings` and set a username/password before connecting other devices. The Settings page includes a **Touch diagnostic** link, which also works inside jweb.
5. On a phone connected to the same Tailscale network, open `http://<tailscale-name>:8765` and enter those credentials. LAN devices can use the address on the panel. Allow the chosen TCP port through Windows Firewall on the intended networks.

The port defaults to 8765. Settings are stored in `%USERPROFILE%\Documents\SetlistTouch\config.json` (`~/Documents/SetlistTouch/config.json` elsewhere). A port change binds the new port before saving; an occupied port leaves the old server/config intact. Open browser clients must use the new port. The embedded window is given the new URL automatically. If the default port is already in use at startup, edit config.json to a free port and reload the device; check the Max console for the error. Settings are available only from a loopback connection.

LAN access is **plain HTTP**: Basic-auth credentials are not encrypted in transit. Tailscale encrypts traffic between tailnet devices. With an empty password, all non-loopback clients receive 403 (rather than a password prompt). Authentication protects every route including fonts and SSE.

### Windows touch verification and fallback

Windows/jweb finger events have **not been verified** in this environment. Use Settings → Touch diagnostic inside the embedded window, or send `url http://localhost:8765/touch-test.html` to its jweb in the Max patch editor. A clean tap should highlight the target; a drag, long hold or two-finger gesture must not. Inspect pointer type and IDs. Record the result before relying on the device at a gig.

If jweb touch is unreliable, use Edge as the main laptop surface:

```bat
msedge --app=http://localhost:8765/ --start-fullscreen
```

The embedded window remains available as a convenience. The browser and embedded surfaces share playback but browse independently. Save window changes in Live if you want Max to retain them.

## Scene naming

| Scene name pattern | Meaning |
| --- | --- |
| `* [[ NAME ]]` | **Category** heading (e.g. `* [[ DINNER ]]`). Contains every song after it until the next category. |
| `* Title` (any other `* ` prefix, star + space) | **Song title** scene (white, no audio). E.g. `* RISE >>`, `* GIVING YOU THE BEST THAT I'VE GOT` |
| anything else | A **section scene** belonging to the most recent song title |
| empty name | Spacer. Songs end with one or more of these before the next title. |

Only the leading `* ` is removed from song titles. Section names, tags, punctuation and colours are preserved. Empty or whitespace-only rows show `■ End`. The first trailing empty row is kept and subsequent trailing empties are hidden; mid-song empties stay tappable. Categories and titles are never launch targets. Scenes before the first song are ignored. `{EMPTY}` is a named section in the supplied screenshot and remains displayed as `{EMPTY}`.

Tags such as `[V4]`, `[N32]`, and `[S]` are only labels. This device never edits clips or follow actions. The final regular track (not a return or Master) provides loop lengths and playing/fired slot indexes. A scene's enabled time signature takes precedence over the set's; 6/8 is three quarter-note beats per bar. Invalid/missing loops have no progress. Scenes without timing clips can still launch but never show playing/queued outlines. Empty End scenes typically hit the user's stop buttons.

## Touch and browsing

- A launch requires down/up on the same row, travel under 10px and a hold under 500ms. A second pointer anywhere cancels both taps; scrolling and cancellation do not launch. Enter/Space also launch a focused row.
- Lock applies to that browser only. Connection loss disables launches until a fresh set/play snapshot arrives. The UI shows “Reconnecting…”.
- Choosing a song or category, stepping prev/next and opening/hiding the sidebar never launch scenes. A different playing song appears in a “Now playing” banner; tap it to navigate explicitly.
- Sidebar, category filter and lock persist per browser in localStorage. The current song is preserved across set edits by title and duplicate occurrence. Deletion chooses the nearest surviving following song, otherwise the preceding song.
- Re-tapping a playing scene calls Live's normal `fire`, including its quantisation/restart behaviour. Requests carry the row index and exact name; a changed or removed row returns 409 and requires a new tap.

## Development and validation

Runtime uses only Node built-ins and Max-provided `max-api`, targets Node 16+, and has no npm runtime dependencies. Classic `lom.js` and the window helper are ES5. Browser files are ES modules with no build step. Poppins 400/600/700 WOFF2 files and their SIL OFL licence are bundled locally.

```sh
cd setlist-touch
npm test                         # use current Node with node --test support
python3 device/build_device.py   # deterministic .maxpat and .amxd
node device/dev.js               # fake set, bound to 0.0.0.0:8765
# If 8765 is occupied (development override only):
SETLIST_TOUCH_PORT=18765 node device/dev.js
curl -N http://localhost:18765/api/events
```

The fake set is a screenshot-derived approximation, not a read of the real Live set. It simulates `[N32] AA` at 100 BPM, logs launches and queues each launch for one bar. Real LiveAPI quantisation and follow actions are verified only in Live. The fixture has **11 RISE rows**: ten named sections (including `{EMPTY}`), plus the first trailing blank. All 11 fit at 1280×800 in the local browser check.

Metadata observers debounce rebuilds by 200ms; a 5s poll catches clip/loop edits. Track/scene changes rebind observers; scene signature changes are also observed. Position comes directly from Live's clip position and is sent at most every 50ms, without browser free-running interpolation. The Node-ready handshake requests another snapshot so startup message order does not lose the initial set. A 15s SSE ping keeps connections active; reconnect sends a full snapshot.

Official API references used for the implementation: [Scene](https://docs.cycling74.com/apiref/lom/scene/), [Track](https://docs.cycling74.com/apiref/lom/track/), [Clip](https://docs.cycling74.com/apiref/lom/clip/), [classic LiveAPI](https://docs.cycling74.com/legacy/max8/vignettes/jsliveapi), and [Node for Max](https://docs.cycling74.com/legacy/max8/vignettes/07_n4m_maxapi).

## Pending Windows acceptance

Neither automated tests nor the browser fixture establish real Ableton behaviour, Windows jweb touch, firewall reachability, phone authentication or performance with the complete Live set. Run both user checklists in the implementation report before gig use. At the end of implementation, the original Task 4 placeholder has been replaced by the completed UI.

Optional browser integration checks live in `scripts/browser-check.cjs`. Install Playwright **outside the device/repository runtime** and set `PLAYWRIGHT_MODULE` to its module path; set `CHROMIUM_PATH` if using an existing Chromium binary, and optionally `ARTIFACT_DIR` for screenshots. The script starts its own fixture server on `0.0.0.0` and checks desktop fit, moving progress, browsing/filtering, clean tap versus drag/multitouch/lock, 409 feedback, set-edit reconciliation, settings, touch diagnostics, phone width, and reconnect after a server restart. It does not drive Ableton.
