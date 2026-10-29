# Handoff: 0005 — Large-set performance and indexing progress (lead → codex)

- **Date:** 2026-10-29
- **Type:** dispatch
- **Ledger:** 0005 · **Spec:** docs/specs/0005-large-set-performance.md · **Plan:** single task, in this handoff
- **Branch:** orch/0005-large-set-performance · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** cbde2eed84a8a4d2cf6b2d377b400fb585ec49ab
- **Port (if running a server):** 5250 (`SETLIST_TOUCH_PORT=5250 node device/dev.js`)
- **Status:** open

## Goal
On the user's real set (683 scenes), dropping in `SetlistTouch.amxd` froze Live. Make indexing chunked, incremental and non-blocking, and show indexing progress both in the device and in the web app. Done means the spec's acceptance criteria are met, `npm test` passes and a draft PR is open.

## Context you need
- **Spec:** `docs/specs/0005-large-set-performance.md`. It covers the root cause, goals, budget and acceptance criteria.
- **Code:**
  - `setlist-touch/device/lom.js`: see `refresh`, `rebuild`, `clipAt`, the `poll` Task (5 s, calls `rebuild(true)`) and the 5 per-scene observers.
  - `setlist-touch/device/mix.js`: the same pattern for tracks.
- **Wiring:**
  - `setlist-touch/device/setlist-server.js` (the `max.addHandler` handlers)
  - `setlist-touch/device/lib/app.js` (SSE events and the snapshot on connect)
  - `setlist-touch/device/web/js/app.js` (the connection bar text, around line 32)
  - `setlist-touch/device/build_device.py`: the `address` message box is the device's visible status text, and `lom.js`'s outlet routing lives here.
- **Test harness:** `setlist-touch/test/lom.test.js` (a `vm` harness with stubbed `LiveAPI`/`Task`/`Dict` and `gets` tracking). Extend it so it can generate N-scene sets and step Task ticks one at a time. `Task.schedule(ms)` currently only sets `pending`. Add a way to advance ticks and count per-tick work.

## Plan (one worktree, in order)
1. **Chunked indexing in `lom.js`.**
   - A scan state machine driven by a `Task`:
     - read scenes in slices of `CHUNK`, registering their observers in the same slices
     - output `progress <done> <total>` (throttled) to the outlet
     - publish the snapshot only when complete
   - A new `refresh` or a `notifydeleted` cancels any scan in flight.
   - Keep `fire`'s final-boundary name check.
2. **Incremental updates.**
   - Per-scene observer callbacks carry the scene index and re-read only that scene, debounced, and coalesced across scenes.
   - Changes to `scenes` or `tracks` start a chunked re-index while keeping the old snapshot live.
   - Signature changes on `live_set` recompute `beatsPerBar` without fresh LiveAPI reads for scenes that don't override it, wherever possible.
3. **Remove the 5 s full poll.** Replace it with targeted timing reads (playing, queued and the current song's rows on playback change) plus an optional slow chunked sweep, or with chunked slot observers. Record your choice under "Decisions made".
4. **`mix.js`:**
   - Measure its startup slice in the harness at 100 tracks × 6 returns.
   - Chunk it only if it exceeds the budget.
   - Either way, report the numbers.
5. **Server, web and device feedback:**
   - **Server:** `progress` handler → bridge → SSE `progress` event, included in the snapshot on connect. Extend `fake-bridge`/`dev.js` with an option (e.g. `SETLIST_TOUCH_SLOW_INDEX=1`) that simulates a slow index.
   - **Web:** show `Indexing Live set… n / total` with a progress bar (`index-progress`, `index-progress-bar`, `index-progress-label`) while indexing.
   - **Device:** route `progress` in the patcher so the `address` box shows `Indexing scenes n / total…`, then restore the address when done. Look at how the address text is currently set in `build_device.py` and `setlist-server.js`.
6. **Tests:** cover every acceptance criterion in the spec. Then run a headless browser check against `dev.js` with the slow index at 390×844 and 1280×800.

## Scope
- **In:** the plan above.
- **Out:** the spec's non-goals. No change to launch, setlist, mix or transport behaviour.
- **Files you own:**
  - `setlist-touch/device/lom.js`, `setlist-touch/device/mix.js`
  - `setlist-touch/device/setlist-server.js`, `setlist-touch/device/lib/app.js`, `setlist-touch/device/lib/fake-bridge.js`, `setlist-touch/device/dev.js`
  - `setlist-touch/device/build_device.py`, `setlist-touch/device/SetlistTouch.amxd`, `setlist-touch/device/SetlistTouch.maxpat`
  - `setlist-touch/device/web/index.html`, `setlist-touch/device/web/style.css`, `setlist-touch/device/web/js/app.js`
  - a new `setlist-touch/device/web/js/index-progress.js` if you want a pure module
  - `setlist-touch/test/lom.test.js`, `setlist-touch/test/mix.test.js`, `setlist-touch/test/app.test.js`, `setlist-touch/test/device.test.js`, plus new test files for new modules
  - `setlist-touch/README.md` (a short "Large sets" note)
  - your handoff files for key `0005`
- **Do not touch:**
  - other web modules
  - `transport.js`
  - the root `device/` and the root `README.md`
  - `docs/` outside your handoff files

## Acceptance criteria
- [ ] Spec AC1–AC9 are met.
- [ ] `cd setlist-touch && npm test` passes. `lom.js`/`mix.js` are ES5, and the server runs on Node 16 with zero runtime deps.
- [ ] `python3 device/build_device.py` is deterministic (the device test passes).
- [ ] The PR describes the browser check results and the final budget numbers (CHUNK and delay, the worst-case calls per tick at 683 and 1,000 scenes, and the estimated total index time).

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py
SETLIST_TOUCH_PORT=5250 SETLIST_TOUCH_SLOW_INDEX=1 node device/dev.js   # headless check http://localhost:5250/
```

## Known gotchas / decisions already made
- **Max `js` runs LiveAPI calls synchronously,** and a long synchronous loop blocks Live's UI. Chunk the work across `Task` ticks.
- **The user's set:** 683 scenes, and the timing track is the last regular track before Main.
- **Keep the previous snapshot launchable during re-index.** Never publish a partial set.
- **Live-only checks are for the user.** List them in your return handoff:
  - total index time on 683 scenes
  - no audio dropouts
  - renaming a scene updates within about 0.5 s
- GBrain: no project pages yet for m4l-control.

## Open questions
None.

---
## Receiver ack

2026-10-29 — Codex: I will implement bounded Task-driven scene indexing and observer setup, incremental scene/timing updates, and indexing progress through Max, Node/SSE and the web UI. I will measure mix startup and chunk it if required, preserve launch validation and the previous complete snapshot during re-indexing, stay within the listed owned files, run the specified unit/build/browser checks, and push only orch/0005-large-set-performance with a draft PR and committed return handoff. No open questions. GBrain search for m4l-control returned no relevant project pages. Live/audio/Windows acceptance remains with the user.

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
