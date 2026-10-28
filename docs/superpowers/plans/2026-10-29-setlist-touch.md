# Setlist Touch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Max for Live device that serves a large, touch-first song/scene launcher (with setlist sidebar and bar-accurate progress) to an in-Live window and to browsers on localhost, LAN and Tailscale.

**Architecture:** A Max `js` script (`lom.js`) observes the Live set through LiveAPI and fires scenes. It talks to a Node for Max script (`setlist-server.js`) that parses the set, runs an HTTP server (static UI + Server-Sent Events + a POST to fire), and enforces basic auth. The UI is plain HTML/CSS/ES modules with no build step, shown in a `jweb` window inside the device and in any browser.

**Tech Stack:** Max for Live (Live 12 Suite), Max `js` (ES5), Node for Max (`node.script`, `max-api`), Node `http` with no npm runtime dependencies, vanilla ES modules, `node --test`, Python 3 to generate the `.amxd`.

**Spec:** `docs/superpowers/specs/2026-10-29-setlist-touch-design.md`

## Global Constraints

- Everything lives under `setlist-touch/`. Work on branch `feat/setlist-touch`, never `main`.
- Server runtime code is CommonJS and must run on **Node 16+** (Node for Max in Max 8.6). Only Node built-ins may be used, with **zero npm runtime dependencies**. `node:test` is used only in tests.
- `lom.js` is classic Max `js`, which is **ES5** (`var`, no arrow functions, no `let`/`const`, no template literals).
- Web code is ES modules for current Chromium (jweb/Edge) and Safari/Chrome on phones. There is no bundler.
- Scene names are displayed exactly as they are in Live. Song titles have only the leading `* ` stripped.
- Category: `/^\*\s*\[\[\s*(.*?)\s*\]\]\s*$/`. Song title: `/^\*\s/` and not a category. Empty: `name.trim() === ""`.
- Of a song's trailing empty scenes, **keep the first** (`isEnd: true`) and drop the rest. Empty scenes in the middle of a song are kept (`isEnd: true`). Empty rows render as grey rows labelled `■ End`.
- The timing track is the **last item in `live_set tracks`**. Beats per bar = `numerator * 4 / denominator`, taken from the scene's time signature if the scene has it enabled, otherwise from the song's.
- Clean tap: same row, movement **< 10 px**, held **< 500 ms**, and no second pointer seen during the gesture.
- Minimum row height **44 px**, gap **6 px**. Bar lines are thin each bar and thick every **4** bars. The progress overlay is `rgba(0,0,0,.28)`. Playing rows get a solid 3 px white outline and queued rows a dashed one.
- Network: the server binds `0.0.0.0`. Loopback clients need no auth. Every other client must pass HTTP Basic auth. If no password is set, non-loopback clients get **403**. Settings can only be viewed and changed from loopback.
- Config file: `<homedir>/Documents/SetlistTouch/config.json`. Defaults are `{ "port": 8765, "username": "band", "password": "" }`.
- Font: Poppins (400/600/700), bundled as local woff2 with its OFL licence. No remote font URLs.
- Every UI element gets a contextual class name (e.g. `scene-row`, `setlist-sidebar`, `filter-pill`).

## Review Focus

1. **Scenes inserted, deleted or renamed above the song on screen.** The view must stay on the same song (matched by title and occurrence), not jump. Tested in Task 5 (`reconcile keeps song after insert above`).
2. **Duplicate song titles.** Matching uses `(title, occurrence)`, so the second "RISE" stays the second. Tested in Task 5.
3. **The set changed between render and tap.** The client sends `{sceneIndex, name}` and the server returns 409 if the name at that index doesn't match. The scene never fires. Tested in Task 3.
4. **A phone drops off Wi-Fi or the laptop sleeps.** SSE reconnects, and the server sends a full snapshot on connect. While disconnected the UI shows a "Reconnecting…" bar and `canLaunch` is false. Tested in Tasks 3 and 5.
5. **Odd clip lengths and signatures** (6 beats in 4/4, 6/8, a zero or missing loop). There is no divide-by-zero, partial bars render, and 6/8 gives 3 beats per bar. Tested in Task 2.

---

## File Structure

```
setlist-touch/
  package.json                 # "test": "node --test"
  device/
    build_device.py            # generates SetlistTouch.amxd (+ .maxpat)
    lom.js                     # Max js: LiveAPI observe + fire (ES5)
    setlist-server.js          # node.script entry: max-api bridge -> createApp
    lib/
      parse-set.js             # raw scenes -> ParsedSet (pure)
      progress.js              # beats/bars maths (pure)
      auth.js                  # loopback check, basic auth (pure)
      config.js                # load/save config file
      app.js                   # HTTP server: static, SSE, /api/*
      fake-bridge.js           # fixture-driven bridge for dev + tests
      fixture-rise.json        # scenes from the user's screenshot
    dev.js                     # run the server without Live (fake bridge)
    web/
      package.json             # {"type":"module"}
      index.html
      style.css
      fonts/                   # poppins-latin-{400,600,700}-normal.woff2, OFL.txt
      js/
        tap.js                 # clean-tap detector (pure)
        layout.js              # row height fitting (pure)
        view-state.js          # per-screen state reducer + selectors (pure)
        render.js              # DOM rendering
        app.js                 # wiring: SSE, events, localStorage
  test/
    parse-set.test.js
    progress.test.js
    auth.test.js
    app.test.js
    tap.test.mjs
    layout.test.mjs
    view-state.test.mjs
```

## Shared types (referenced by every task)

```
RawScene   = { index, name, color /* 0xRRGGBB int */, loopBeats /* number|null */, beatsPerBar }
Row        = { sceneIndex, name, color, loopBeats, beatsPerBar, isEnd }
Song       = { id /* title scene index */, title, occurrence /* 1-based among same title */, category /* string|null */, rows: Row[] }
ParsedSet  = { categories: string[], songs: Song[], sceneToSong: { [sceneIndex]: songId } }
Play       = { playing /* sceneIndex|-1 */, fired /* sceneIndex|-1 */, playingSongId /* id|null */ }
Pos        = { scene, bar /* 1-based */, bars /* float */, fraction /* 0..1 */ }
Bridge     = EventEmitter emitting 'scenes'(RawScene[]), 'play'({playing, fired}),
             'pos'({scene, position, loopStart, loopEnd, beatsPerBar}); method fire(sceneIndex)
```

---

### Task 1: Scaffold + set parser

**Files:**
- Create: `setlist-touch/package.json`, `setlist-touch/device/lib/parse-set.js`, `setlist-touch/device/lib/fixture-rise.json`
- Test: `setlist-touch/test/parse-set.test.js`

**Interfaces:**
- Produces: `parseSet(rawScenes: RawScene[]) -> ParsedSet` (CommonJS `module.exports = { parseSet }`). Also `fixture-rise.json`: a RawScene[] covering everything from "GIVING YOU THE BEST THAT I'VE GOT" to "SUN GODDESS" in the screenshot, with `* [[ DINNER ]]` and two trailing empties after RISE. Approximate colours: pink `0xE8649A`, yellow `0xF1E46A`, green `0x22D44A`, teal `0x1ED6A0`, red `0xFF4B2E`, white `0xFFFFFF`, grey `0x9A9A9A`. Loop beats are `[V4]`→16, `[N32]`→128, `[N16]`→64, `[S]`→4, and null for titles and empties. All `beatsPerBar` are 4.

- [x] **Step 1: Create the branch and `package.json`** (`{"name":"setlist-touch","private":true,"scripts":{"test":"node --test"}}`), then write the failing tests:

```js
const { parseSet } = require('../device/lib/parse-set');
const S = (index, name, extra = {}) => ({ index, name, color: 0, loopBeats: null, beatsPerBar: 4, ...extra });

test('songs, categories and stripped titles', () => {
  const p = parseSet([S(0,'* [[ DINNER ]]'), S(1,'* RISE >>'), S(2,'READY'), S(3,'[N32] AA'), S(4,''), S(5,''), S(6,'* HOW DEEP >>'), S(7,'COUNT IN')]);
  assert.deepEqual(p.categories, ['DINNER']);
  assert.deepEqual(p.songs.map(s => [s.id, s.title, s.category]), [[1,'RISE >>','DINNER'],[6,'HOW DEEP >>','DINNER']]);
  assert.deepEqual(p.songs[0].rows.map(r => [r.sceneIndex, r.isEnd]), [[2,false],[3,false],[4,true]]); // second trailing empty dropped
  assert.equal(p.sceneToSong[3], 1); assert.equal(p.sceneToSong[5], undefined);
});
test('mid-song empty kept', () => { /* '* A', 'X', '', 'Y' -> rows X, '' (isEnd), Y */ });
test('scenes before first song ignored; songs before first category have category null', () => {});
test('category scene ends the current song', () => {});
test('duplicate titles get occurrence 1 and 2', () => {});
test('whitespace-only name counts as empty; "*NoSpace" is a section, not a title', () => {});
test('fixture-rise parses to 4 songs incl. RISE with 10 rows ending in isEnd', () => {});
```

- [x] **Step 2:** Run `cd setlist-touch && npm test`. Expected: FAIL, `Cannot find module '../device/lib/parse-set'`.
- [x] **Step 3:** Implement `parseSet` as a single pass. A category regex hit sets the current category and closes the current song. A song regex hit opens a song. Any other scene is appended to the open song as a row. When a song closes, drop every trailing empty row after the first one. Scenes with no open song are ignored.
- [x] **Step 4:** Run `npm test`. Expected: all parse-set tests pass.
- [x] **Step 5:** Commit: `feat(setlist-touch): scene set parser`.

### Task 2: Progress maths, auth, config

**Files:**
- Create: `setlist-touch/device/lib/progress.js`, `setlist-touch/device/lib/auth.js`, `setlist-touch/device/lib/config.js`
- Test: `setlist-touch/test/progress.test.js`, `setlist-touch/test/auth.test.js`

**Interfaces:**
- Produces:
  - `beatsPerBar(numerator, denominator) -> number`
  - `progress({position, loopStart, loopEnd, beatsPerBar}) -> {bar, bars, fraction} | null`
  - `isLoopback(remoteAddress: string) -> boolean`
  - `checkBasic(authorizationHeader: string|undefined, {username, password}) -> boolean`
  - `authorize({remoteAddress, authorization}, config) -> 'ok' | 'challenge' | 'forbidden'`
  - `DEFAULT_CONFIG`
  - `configPath() -> string`
  - `loadConfig(path?) -> Config` (missing or corrupt file → defaults)
  - `saveConfig(cfg, path?) -> void` (creates the directory if needed)

- [x] **Step 1: Write the failing tests:**

```js
assert.equal(beatsPerBar(4,4), 4); assert.equal(beatsPerBar(6,8), 3); assert.equal(beatsPerBar(3,4), 3);
assert.deepEqual(progress({position: 42, loopStart: 0, loopEnd: 128, beatsPerBar: 4}), { bar: 11, bars: 32, fraction: 42/128 });
assert.deepEqual(progress({position: 5, loopStart: 0, loopEnd: 6, beatsPerBar: 4}), { bar: 2, bars: 1.5, fraction: 5/6 });
assert.equal(progress({position: 1, loopStart: 4, loopEnd: 4, beatsPerBar: 4}), null);           // zero length
assert.equal(progress({position: 200, loopStart: 0, loopEnd: 128, beatsPerBar: 4}).bar, 32);    // clamped
assert.equal(progress({position: 200, loopStart: 0, loopEnd: 128, beatsPerBar: 4}).fraction, 1);
// auth
for (const a of ['127.0.0.1','::1','::ffff:127.0.0.1']) assert.ok(isLoopback(a));
assert.ok(!isLoopback('100.101.2.3')); assert.ok(!isLoopback('192.168.1.20'));
const cfg = { username: 'band', password: 'pw' };
const hdr = 'Basic ' + Buffer.from('band:pw').toString('base64');
assert.equal(authorize({ remoteAddress: '127.0.0.1' }, { ...cfg, password: '' }), 'ok');
assert.equal(authorize({ remoteAddress: '192.168.1.20', authorization: hdr }, cfg), 'ok');
assert.equal(authorize({ remoteAddress: '100.64.0.9' }, cfg), 'challenge');
assert.equal(authorize({ remoteAddress: '192.168.1.20', authorization: hdr }, { ...cfg, password: '' }), 'forbidden');
assert.ok(!checkBasic('Basic ' + Buffer.from('band:nope').toString('base64'), cfg));
assert.ok(!checkBasic('Basic !!!', cfg));
// config: loadConfig(tmpMissingPath) deep-equals DEFAULT_CONFIG; save then load round-trips
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL (modules missing).
- [x] **Step 3:** Implement. `bar = clamp(floor((position - loopStart) / beatsPerBar) + 1, 1, ceil(bars))`. `fraction` is clamped to 0..1. `checkBasic` compares with `crypto.timingSafeEqual` over equal-length buffers, and returns false on a length mismatch or an empty password. `configPath` = `path.join(os.homedir(), 'Documents', 'SetlistTouch', 'config.json')`.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(setlist-touch): progress maths, basic auth, config`.

### Task 3: HTTP app (static, SSE, fire, settings) + fake bridge + dev runner

**Files:**
- Create: `setlist-touch/device/lib/app.js`, `setlist-touch/device/lib/fake-bridge.js`, `setlist-touch/device/dev.js`, `setlist-touch/device/web/index.html` (placeholder `<h1 class="placeholder">Setlist Touch</h1>`; Task 6 replaces it)
- Test: `setlist-touch/test/app.test.js`

**Interfaces:**
- Consumes: `parseSet`, `progress`, `authorize`, `isLoopback`, `loadConfig`/`saveConfig`.
- Produces:
  - `createApp({ bridge, config, saveConfig, webRoot }) -> { listen(port) -> Promise<number /*actual port*/>, close() -> Promise<void>, getConfig() }`
  - `createFakeBridge(rawScenes) -> Bridge & { simulate({scene, bpm}) -> stop() }`. `simulate` emits `play` and then `pos` every 50 ms at the given tempo. `fire(i)` emits `play` with `fired: i`, then `playing: i` one bar later.
  - HTTP surface (consumed by Task 6):
    - `GET /` → `web/index.html`, and `GET /<path>` → the file under `webRoot`. Traversal outside `webRoot` → 404.
    - `GET /api/events` → `text/event-stream`. Events: `set` (ParsedSet), `play` (Play), `pos` (Pos). On connect it immediately sends the latest `set`, `play` and `pos` that it has. `pos` is broadcast at most every 50 ms.
    - `POST /api/fire` with body `{sceneIndex, name}` → 204 after `bridge.fire(sceneIndex)`. 400 if malformed. **409** if `sceneIndex` is not a row in the current ParsedSet or its name differs.
    - `GET /api/config` and `POST /api/config` (`{port, username, password}`): loopback only, 403 otherwise. Saving calls `saveConfig`. A changed port re-listens on the new port.
    - All routes go through `authorize`. `challenge` → 401 with `WWW-Authenticate: Basic realm="Setlist Touch"`. `forbidden` → 403 with text `Set a password in Setlist Touch settings on the laptop.`
  - `dev.js` runs `createApp` with the fake bridge and the RISE fixture, on `0.0.0.0` and the config port. It simulates `[N32] AA` playing at 100 bpm and prints the URL.

- [x] **Step 1: Write the failing tests.** Use a real server on port 0 and Node's `http`/`fetch` in the test only:

```js
test('SSE sends snapshot on connect', /* first events are set (songs.length === 4) then play */);
test('fire valid row -> 204 and bridge.fire called', ...);
test('fire with stale name -> 409, bridge.fire not called', ...);
test('fire on a title scene index -> 409', ...);
test('non-loopback without auth -> 401 with WWW-Authenticate', /* inject remoteAddress via createApp option trustRemoteAddress(req) for tests */);
test('non-loopback with empty password -> 403', ...);
test('/api/config from non-loopback -> 403 even with valid auth', ...);
test('GET /../package.json -> 404', ...);
```

To test non-loopback clients, `createApp` accepts an optional `remoteAddressOf(req)` that defaults to `req.socket.remoteAddress`. Tests override it.

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `app.js` on `http.createServer`. Keep the latest `set`, `play` and `pos` in memory. `play.playingSongId` comes from `sceneToSong`. Convert `pos` with `progress()`. Send a `: ping` comment every 15 s so proxies and Tailscale keep the stream alive. Implement `fake-bridge.js` and `dev.js`.
- [x] **Step 4:** Run `npm test`. Expected: PASS. Then run `node device/dev.js` and `curl -N localhost:8765/api/events`, which should stream `set`, `play` and repeated `pos` events.
- [x] **Step 5:** Commit: `feat(setlist-touch): http app with SSE, fire, auth`.

### Task 4: Device skeleton + jweb touch spike (user verification)

**Files:**
- Create: `setlist-touch/device/build_device.py`, `setlist-touch/device/setlist-server.js`, `setlist-touch/device/web/touch-test.html`

**Interfaces:**
- Consumes: `createApp`, `loadConfig`, `saveConfig`.
- Produces:
  - Max ↔ Node messages, used again in Task 7:
    - **into `node.script`:** `scenes` (re-read the dict `setlist_touch_scenes`, key `scenes`, a JSON string of RawScene[]), `play <playing> <fired>`, `pos <scene> <position> <loopStart> <loopEnd> <beatsPerBar>`.
    - **out of `node.script`:** `fire <sceneIndex>`, `address <url>`, `url <url>`.
  - `setlist-server.js` builds a Bridge from `max-api` handlers, starts `createApp`, then outputs `address http://<first non-internal IPv4>:<port>` and `url http://localhost:<port>/`.
  - `build_device.py` writes `SetlistTouch.amxd` (MIDI Effect) and `SetlistTouch.maxpat`, using the same `ampf`/`mmmm`/`meta`/`ptch` container as `device/build.py` at the repo root. The patch contains:
    - `node.script setlist-server.js @autostart 1`.
    - `[route fire address url]` on the node outlet. `fire` → `[deferlow]` → `[prepend fire]` → `js lom.js`. `address` → `[prepend set]` → a presentation message box. `url` → into the window subpatcher.
    - `js lom.js` outlet → `node.script` inlet. `lom.js` is a stub in this task.
    - `live.thisdevice` → `refresh` → `js lom.js`.
    - A `live.text` "Open" (button mode) → `[sel 1]` → `open` → `[pcontrol]` → `[p touch-window]`. The subpatcher holds a `jweb` that fills a 1200×800 window, and its second inlet takes `url`.
    - `midiin` → `midiout` passthrough.
  - `touch-test.html`: a full-screen page that logs every pointer event (`pointerType`, `pointerId`, x/y) and highlights a big target on a clean tap.

- [x] **Step 1:** Write `setlist-server.js`, the stub `lom.js` (`function refresh(){}` and `function fire(i){}`), `touch-test.html` and `build_device.py`.
- [x] **Step 2:** Run `python3 device/build_device.py` and `node --check device/setlist-server.js`. Expected: both files are written, and the JSON parses (`python3 -c "import json;json.load(open('device/SetlistTouch.maxpat'))"`).
- [ ] **Step 3: User verification on the Windows laptop. Stop and hand this checklist to the user.**
  - Drop `SetlistTouch.amxd` on a MIDI track. The panel shows an address.
  - Click Open, and the window loads the placeholder.
  - Open `<url>/touch-test.html` in the jweb window: does a finger tap log `pointerType: "touch"`? Does a drag avoid the highlight? Does a two-finger touch log two pointer IDs?
  - Open the address from the phone over Tailscale and from another device on the LAN. Both should prompt for a password; set one first via `http://localhost:8765/api/config` (POST) or edit `config.json`.
  - **If jweb touch is unreliable:** record it in `setlist-touch/README.md`. The fallback is `msedge --app=http://localhost:8765/ --start-fullscreen`, and Task 6 continues unchanged.
- [x] **Step 4:** Commit: `feat(setlist-touch): device skeleton and jweb touch spike`.

### Task 5: UI core logic (tap, layout, view state)

**Files:**
- Create: `setlist-touch/device/web/package.json`, `setlist-touch/device/web/js/tap.js`, `setlist-touch/device/web/js/layout.js`, `setlist-touch/device/web/js/view-state.js`
- Test: `setlist-touch/test/tap.test.mjs`, `setlist-touch/test/layout.test.mjs`, `setlist-touch/test/view-state.test.mjs`

**Interfaces:**
- Consumes: the ParsedSet and Play shapes.
- Produces:
  - `createTapDetector({ maxMove = 10, maxMs = 500 } = {}) -> { down(id, x, y, t, target), move(id, x, y), up(id, x, y, t, target) -> target|null, cancel(id) }`
  - `fitRows(count, availablePx, { gap = 6, min = 44, max = 120 } = {}) -> { rowHeight, scroll }`
  - `initialState(prefs = {}) -> ViewState`, where `ViewState = { songKey /* {title, occurrence}|null */, filter /* category|null */, sidebarOpen, locked, connected }`
  - `reduce(state, action, set) -> ViewState`. Actions:
    - `{type:'set'}`: reconcile to the new set
    - `{type:'selectSong', id}`
    - `{type:'stepSong', dir: -1|1}`: steps through `visibleSongs`
    - `{type:'filter', category}`
    - `{type:'toggleSidebar'}`
    - `{type:'toggleLock'}`
    - `{type:'connected', value}`
    - `{type:'showPlaying', play}`: what the banner tap dispatches
  - Selectors: `currentSong(state, set) -> Song|null`, `visibleSongs(state, set) -> Song[]`, `banner(state, set, play) -> {songId, title}|null`, `canLaunch(state) -> boolean` (`!locked && connected`).
  - `prefsOf(state)` returns `{sidebarOpen, locked, filter}` for localStorage.

- [x] **Step 1: Write the failing tests:**

```js
// tap
const d = createTapDetector(); d.down(1, 0, 0, 0, 'A'); assert.equal(d.up(1, 4, 3, 200, 'A'), 'A');
d.down(1,0,0,0,'A'); d.move(1,0,12); assert.equal(d.up(1,0,12,100,'A'), null);   // drag
d.down(1,0,0,0,'A'); assert.equal(d.up(1,0,0,600,'A'), null);                     // long hold
d.down(1,0,0,0,'A'); assert.equal(d.up(1,0,0,100,'B'), null);                     // different row
d.down(1,0,0,0,'A'); d.down(2,50,0,10,'B'); assert.equal(d.up(1,0,0,100,'A'), null); assert.equal(d.up(2,50,0,110,'B'), null); // multi-touch
d.down(3,0,0,0,'A'); assert.equal(d.up(3,0,0,100,'A'), 'A');                      // recovers after multi-touch ends
// layout
assert.deepEqual(fitRows(10, 700), { rowHeight: 64.6, scroll: false });  // (700 - 9*6) / 10
assert.deepEqual(fitRows(10, 300), { rowHeight: 44, scroll: true });
assert.deepEqual(fitRows(3, 900), { rowHeight: 120, scroll: false });
assert.deepEqual(fitRows(0, 500), { rowHeight: 120, scroll: false });
// view-state (use parseSet output from fixture-rise via createRequire)
test('first set selects first song; set with play selects playing song only when songKey is null', ...);
test('reconcile keeps song after insert above', /* insert 3 scenes before; current title unchanged */);
test('duplicate titles: viewing occurrence 2 stays on occurrence 2 after reconcile', ...);
test('current song deleted -> nearest following song, else previous, else null', ...);
test('play in another song never changes songKey; banner returns that song', ...);
test('banner null when playing song is on screen or nothing playing', ...);
test('stepSong respects filter and clamps at ends (no wrap)', ...);
test('canLaunch false when locked or disconnected', ...);
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement. `view-state.js` must not touch the DOM or `window`. `reconcile` looks up `(title, occurrence)` in the new set.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(setlist-touch): tap detector, row layout, view state`.

### Task 6: UI rendering, styles, fonts

**Files:**
- Create: `setlist-touch/device/web/js/render.js`, `setlist-touch/device/web/js/app.js`, `setlist-touch/device/web/style.css`, `setlist-touch/device/web/fonts/*`
- Modify: `setlist-touch/device/web/index.html`

**Interfaces:**
- Consumes:
  - from Task 3: `/api/events` (`set`/`play`/`pos`) and `POST /api/fire {sceneIndex, name}`
  - from Task 5: everything
- Produces: the UI described in the spec under "What the user sees", matching the second validated mockup (sidebar open/hidden):
  - **Header:** `sidebar-toggle` (`☰ Setlist` / `◀◀ Hide`), `song-nav` ◀ prev-title, `song-title`, `song-nav` next-title ▶, a `lock-toggle` and, on loopback only, a `settings-link`.
  - **Sidebar:** `setlist-sidebar` with `filter-pills` (`All` + categories), `category-heading` and `setlist-item`. The current song has `is-current`.
  - **Rows:** `scene-row` with an inline background from `color`, `tile-barlines` holding an `<i>` at `k * beatsPerBar / loopBeats` (class `bar-4` when `k % 4 === 0`), `tile-progress` (width = fraction) and `tile-bars` (`${bar} / ${Math.ceil(bars)}`) on the playing row only. `is-playing` and `is-queued` mark state. Empty rows use class `scene-row-end` with label `■ End` on grey `#9A9A9A`. Rows with `loopBeats === null` get no bar lines and no progress.
  - `now-playing-banner` when `banner()` isn't null. `connection-bar` ("Reconnecting…") while disconnected. A `locked` class on the body when locked, which dims rows.
  - **Settings page** (`#settings` view, loopback only): port, username and password fields, posting to `/api/config`.

- [x] **Step 1:** Fetch the fonts into a fresh temp dir with `npm pack @fontsource/poppins`. Copy `files/poppins-latin-{400,600,700}-normal.woff2` and `LICENSE` (saved as `OFL.txt`) into `web/fonts/`, and add `@font-face` rules in `style.css`.
- [x] **Step 2:** Implement `render.js` and `app.js`:
  - Use pointer events on the row list with `touch-action: pan-y`. Clean taps go through the tap detector.
  - The list re-fits with `fitRows` on resize via `ResizeObserver`.
  - Prefs persist in `localStorage['setlist-touch']`.
  - `EventSource` errors dispatch `connected:false`, and `open` dispatches `connected:true`.
  - A 409 from fire flashes the row and does nothing else.
- [x] **Step 3:** Run `node device/dev.js`, open `http://localhost:8765/` in a headless browser (Playwright, or the `browse` skill) and take a screenshot. Expected:
  - RISE's 10 rows fit without scrolling at 1280×800.
  - `[N32] AA` shows a moving progress fill with `n / 32`.
  - The sidebar toggles, and the pills filter.
  - Choosing HOW DEEP leaves the view there while the banner shows "Now playing: RISE >>".
  - A drag on the list fires nothing (check the dev server log).
- [x] **Step 4:** Run `npm test`. Expected: still PASS.
- [x] **Step 5:** Commit: `feat(setlist-touch): touch UI`.

### Task 7: LiveAPI bridge (`lom.js`) + install docs (user verification)

**Files:**
- Modify: `setlist-touch/device/lom.js`
- Create: `setlist-touch/README.md`

**Interfaces:**
- Consumes: the Max ↔ Node messages from Task 4.
- Produces: `lom.js` (ES5) with these messages:
  - `refresh()`: rebuild everything
  - `fire(i)`: `new LiveAPI("live_set scenes " + i).call("fire")`, a no-op if out of range

- [x] **Step 1:** Implement `lom.js`:
  - Rebuild RawScene[] for every scene:
    - `name` and `color` come from the scene.
    - `loopBeats` = `loop_end - loop_start` of the timing track's clip in that row, or null if there's no clip.
    - `beatsPerBar` comes from the scene's `time_signature_numerator/denominator` when `time_signature_enabled` is 1, otherwise from the song's `signature_numerator/denominator`.
    - Write the JSON string to `Dict("setlist_touch_scenes")` key `scenes`, then `outlet(0, "scenes")`.
  - Rebuilds are debounced 200 ms with a `Task`. They're triggered by:
    - observers on `live_set` `scenes` and `tracks`
    - each scene's `name` and `color`
    - the song's `signature_numerator` and `signature_denominator`
    - a 5 s `Task` poll, to catch clip loop edits
  - Observe the timing track's `playing_slot_index` and `fired_slot_index`, and send `play <playing> <fired>` with negative values sent as -1. When `playing_slot_index` changes, re-point a single `playing_position` observer to that slot's clip and send `pos …` on each change.
  - Rebind the timing-track observers whenever `tracks` changes.
  - Playing and queued come only from the timing track. A row with no timing clip never shows an outline (the spec leaves this to the builder).
  - Create every LiveAPI object lazily, after `refresh` (sent from `live.thisdevice`), never at load.
- [x] **Step 2:** Run `python3 device/build_device.py` and `npm test`. Expected: the build succeeds and tests pass.
- [x] **Step 3:** Write `README.md`:
  - install: copy the `setlist-touch/device` folder, then drop the `.amxd`
  - Open window and the Edge fallback command
  - set a password at `http://localhost:8765/#settings`
  - phone via `http://<tailscale-name>:8765`
  - LAN warning: plain HTTP
  - the scene naming convention table from the spec
- [ ] **Step 4: User verification in Live, with the real set. Stop and hand this checklist to the user.**
  - The song list matches the abletondrummer setlist, and categories group correctly.
  - RISE rows match Live's colours and names, ending in one `■ End` row.
  - Launching `[N32] AA` shows the progress fill, the bar counter and the queued outline before the quantise point.
  - Its follow action moves the outline to the next row by itself.
  - Renaming a scene in Live updates the UI within about 1 s without changing the song on screen.
  - The phone over Tailscale shows the same playback, and the lock toggle stops it launching.
- [x] **Step 5:** Commit: `feat(setlist-touch): LiveAPI bridge and README`.

## Implementation notes — 2026-10-29

- Tasks 1–7 implemented on `feat/setlist-touch`; the two Windows acceptance steps above are pending and were intentionally bypassed only to finish the remaining implementation, per the user's instruction.
- Screenshot fidelity takes precedence over the plan's 10-row RISE assertion: ten named sections including `{EMPTY}` plus the first trailing blank give **11 rows**, all fitting at 1280×800. The test uses 11. Original example text above is retained as approved-plan context.
- Added a Node-ready snapshot handshake, scene signature observers, presentation-only jweb sizing, cross-origin POST rejection, and occupied-port rollback. Reconnection enables launch only after a fresh set/play snapshot.
- Development used port 18765 because 8765 was already occupied; saved user configuration was not changed.
- The requested superpowers execution skills were unavailable; tasks and TDD were followed directly without further delegation.
- Local validation: 37 tests passed, Node 16.20.2 runtime syntax/HTTP/SSE smoke passed, ES5 parsing passed, AMXD chunks/embedded JSON verified, and the optional browser check passed including reconnect. These do not establish Windows/Live behaviour.
