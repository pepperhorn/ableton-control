# Plan 0002 — In-ear mix pages (Setlist Touch phase 2)

- **Spec:** ../superpowers/specs/2026-10-29-in-ear-mix-design.md
- **Builds on:** 0001 (Setlist Touch phase 1, PR #1). This item can't be dispatched until 0001 has merged.
- **Base:** main after 0001 merges
- **Verification (whole item):** `cd setlist-touch && npm test` (Node 16+ compatible code; `node --test`)

## Approach

This mirrors phase 1's Live → Node → web pipeline, adding a parallel "mix" lane:

- **`device/mix.js` (new, ES5 Max `js`).** It observes:
  - `live_set return_tracks`: name, colour, output routing
  - every track in `live_set tracks` whose name matches `/^\+\s/` (grouped child tracks included)
  - each such track's `mixer_device sends K` value, one per return K

  It writes the raw snapshot JSON to `Dict("setlist_touch_mix")` key `mix` and outputs `mix`. Single level changes go out as `level <trackIndex> <returnIndex> <value> <label>`. On `send <trackIndex> <returnIndex> <value>` it sets that send's `value`. Snapshots are debounced 200 ms on structure, name, colour or routing changes. It doesn't poll; all changes come from observers.
- **`device/lib/parse-mix.js` (new, pure).** Converts the raw snapshot to a `ParsedMix`:
  - keeps only returns **not routed to Main** (`routedToMain === false`)
  - strips `+ ` from track names
  - keeps set order
- **`device/lib/app.js` (extend).** Adds:
  - SSE events `mix` (ParsedMix) and `level`, plus the snapshot on connect
  - `POST /api/send`, validated against the current ParsedMix:
    - **409** if the track's raw name or the return has changed
    - **400** if the value isn't finite or is outside 0..1
    - otherwise it calls `bridge.setSend(trackIndex, returnIndex, value)` and returns **204**
  - Server → Max sends are coalesced per (track, return) to at most one every 33 ms, so the latest value wins.
- **Web.** Adds:
  - a "Scenes / My mix" switch
  - a tab per return
  - one fader-bar row per strip: option B, where the row is the fader, filled in the track's colour, with Live's own value text at the right
  - a pure gesture classifier: horizontal-only, relative and single-pointer, with the lock respected
  - prefs (`page`, mix tab by return name) in the existing `localStorage['setlist-touch']`

Max wiring (`build_device.py`):
- `route` gains `send`, which goes `[deferlow]` → `[prepend send]` → `js mix.js`.
- The `mix.js` outlet → `node.script`.
- The existing `refresh` / `live.thisdevice` / `ready` paths also go to `mix.js`.

### Shared types

```
RawMix     = { returns: [{ index, name, color, routedToMain }], tracks: [{ index, name, color, sends: [{ value, label }] /* by return index */ }] }
ParsedMix  = { returns: [{ returnIndex, name, color }], strips: [{ trackIndex, rawName, name, color, levels: { [returnIndex]: { value, label } } }] }
Level      = { trackIndex, returnIndex, value, label }
Bridge     += event 'mix'(RawMix), event 'level'(Level), method setSend(trackIndex, returnIndex, value)
```

## Tasks

This is a single dispatch (K = `0002`). The steps below run in order inside one worktree, because they share `lib/app.js` and `web/js/app.js`.

### T1 — parse-mix + server lane
- **Owns:** `setlist-touch/device/lib/parse-mix.js`, `setlist-touch/device/lib/app.js`, `setlist-touch/device/lib/fake-bridge.js`, `setlist-touch/device/lib/fixture-mix.json`, `setlist-touch/device/dev.js`, `setlist-touch/test/parse-mix.test.js`, `setlist-touch/test/app.test.js`
- **Fixture** (`fixture-mix.json`), taken from the user's screenshot:
  - returns `A-Verb` and `B-Delay` (routedToMain true), and `Shaun`, `Keith`, `Sam` (false)
  - tracks `+ DRUMS`, `+ PERC`, `+ Bass`, `+ COMP`, `+ HORNS`, `+ OTHER`, `+ SAMPLES`, `+ BGs`, `+ CLICK`, `+ CUE GROUP`, using the screenshot colours, with plausible values and labels such as `-4.1 dB`
- **Tests:**
  - parse drops returns routed to Main
  - prefix stripped, with the raw name kept
  - order preserved
  - a track named `+Kick` (no space) is excluded by `mix.js`'s regex. Assert this in parse-mix as a guard too, and document it.
  - SSE sends `mix` on connect
  - `/api/send` returns 204 and calls `setSend` once
  - a stale `rawName` → 409, and a return routed to Main → 409
  - a value of 1.5, NaN or a string → 400
  - 10 rapid posts to the same fader within 30 ms → `setSend` is called ≤ 2 times, and the last value wins
  - the `level` event updates the snapshot sent to a client that connects later
- **Acceptance:** spec "How the set is encoded" + "Live sync"; `dev.js` serves the mix fixture alongside the scenes fixture, and `setSend` on the fake bridge echoes a `level`.

### T2 — mix.js (LiveAPI) + device wiring
- **Owns:** `setlist-touch/device/mix.js`, `setlist-touch/device/setlist-server.js`, `setlist-touch/device/build_device.py`, `setlist-touch/device/SetlistTouch.amxd`, `setlist-touch/device/SetlistTouch.maxpat`, `setlist-touch/test/mix.test.js`
- **Notes:**
  - Write ES5 only. Follow `lom.js`'s patterns for `watch`, `release` and debounce.
  - "Routed to Main": parse the return track's `output_routing_type` (JSON dict) and compare `display_name` against `Main` and `Master`, case-insensitive. Live 12 says "Main", and older versions say "Master".
  - Get the label from the send parameter's `str_for_value`.
  - The send `value` set must happen on the deferred (low-priority) path.
  - Rebind observers when `tracks` or `return_tracks` change, or when a track name changes (a track gaining or losing its `+ ` prefix).
  - Extend the existing `lom.test.js` approach (a stubbed LiveAPI harness) for `mix.js` if feasible. If it isn't, use a syntax and ES5 parse check plus a manual checklist.
- **Acceptance:**
  - `python3 device/build_device.py` succeeds
  - the `.maxpat` JSON parses
  - the route includes `send`
  - `mix.js` passes the ES5 parse check

### T3 — web mix pages
- **Owns:** `setlist-touch/device/web/js/fader.js`, `setlist-touch/device/web/js/mix-view.js`, `setlist-touch/device/web/js/mix-render.js`, `setlist-touch/device/web/js/app.js`, `setlist-touch/device/web/js/view-state.js` (prefs only), `setlist-touch/device/web/index.html`, `setlist-touch/device/web/style.css`, `setlist-touch/test/fader.test.mjs`, `setlist-touch/test/mix-view.test.mjs`
- **Interfaces:**
  - `createFaderGesture({ slop = 8, fullScalePx }) -> { down(id, x, y, startValue), move(id, x, y) -> value|null, up(id) -> value|null, cancel(id) }`
    - It returns a value only once the gesture is classified as horizontal: |dx| reaches `slop` before |dy| does.
    - The value = clamp(startValue + dx / fullScalePx, 0, 1).
    - A second pointer cancels the gesture, and the value is never changed on `down`.
  - `mix-view.js`: `initialMixState(prefs) -> { page: 'scenes'|'mix', tab /* return name|null */ }` and `reduceMix(state, action, mix)`.
    - Actions: `page`, `tab`, and `mix` (reconcile `tab` by return name, falling back to the first return).
    - `faderValue(levels, dragging)`: a fader being dragged on this screen ignores incoming `level` events until release.
- **Tests:**
  - a tap never changes the value
  - a vertical-first gesture never returns a value
  - a horizontal drag of `fullScalePx / 4` from 0.5 → 0.75
  - clamping at 0 and 1
  - multi-touch cancels the gesture
  - the tab survives a set change by name and falls back when its return disappears
  - a drag in progress ignores a remote level, then shows the latest level after release
  - the lock blocks fader gestures (the `canLaunch(state)` guard is reused)
- **UI:**
  - The page switch sits in the header and the mix page reuses the connection bar and lock.
  - Rows are 44 px minimum with `touch-action: pan-y`.
  - Client sends are throttled to one every 33 ms per fader, plus the final value on release.
  - A 409 flashes the row and reverts it to the server value.
  - Class names: `page-switch`, `send-tabs`, `send-tab`, `mix-list`, `mix-row`, `mix-fill`, `mix-label`, `mix-value`.
- **Acceptance:** the spec's "What the user sees" and "Touch safety". Run a headless browser against `node device/dev.js` at 390×844 (phone) and 1280×800, and check:
  - tabs show Shaun, Keith and Sam only
  - a horizontal drag changes the value and the dev log shows a throttled `setSend`
  - a vertical scroll and a tap change nothing
  - with the lock on, nothing changes

## Merge order
0001 → 0002

## Risks
- `output_routing_type` format and the display names in Live 12 need checking by the user in Live.
- `str_for_value` on a send parameter is expected to return text like `-4.1 dB`. If it fails, show a dB value computed in the UI and record that as a decision.
- Manual check in Live, by the user:
  - the tabs match the player returns
  - moving a send knob in Live updates the phone within about 0.2 s
  - a phone drag moves the knob in Live
  - adding `+ ` to a track name adds its row
