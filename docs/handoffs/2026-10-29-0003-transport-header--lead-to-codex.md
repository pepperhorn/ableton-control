# Handoff: 0003 — Transport header (lead → codex)

- **Date:** 2026-10-29
- **Type:** dispatch
- **Ledger:** 0003 · **Spec:** docs/specs/0003-transport-header.md · **Plan:** single task, in this handoff
- **Branch:** orch/0003-transport-header · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** (see the ledger commit that dispatched this)
- **Port (if running a server):** 5230 (`SETLIST_TOUCH_PORT=5230 node device/dev.js`)
- **Status:** open

## Goal
Add an opt-in (`?transport=1`) transport row to the Setlist Touch web app with these controls:
- **Play** on a tap.
- **Stop** on a 1-second hold.
- **Arrangement Record toggle** on a 1-second hold.
- Live state shown on every screen: playing, recording, tempo, and position as bar.beat.

Done means the spec's behaviour is met, `npm test` passes (including all existing tests) and a draft PR is open.

## Context you need
- Spec: `docs/specs/0003-transport-header.md`
- The existing architecture, which you extend in the same patterns:
  - **LiveAPI to Node:** `setlist-touch/device/lom.js` and `mix.js` (ES5 Max `js`, observers, debounce, deferred writes that carry expected state).
  - **Node to web:** `setlist-touch/setlist-server.js` and `device/lib/app.js` (SSE snapshot on connect, POST validated with 409/400, auth on every route).
  - **Device wiring:** `device/build_device.py`, where the `route` object gains new selectors.
  - **UI:** `device/web/js/*` (pure modules tested with `node --test`, pointer-event gesture handling as in `tap.js` and `fader.js`, and the lock and connection via `canLaunch`).
- Earlier specs: `docs/superpowers/specs/2026-10-29-setlist-touch-design.md`, `docs/superpowers/specs/2026-10-29-in-ear-mix-design.md`.

## Plan (one worktree, in order)
1. **Transport lane (Live and server).** Add a new ES5 `device/transport.js`.
   - It observes `live_set` `is_playing`, `record_mode`, `tempo`, `current_song_time`, `signature_numerator` and `signature_denominator`.
   - It throttles `current_song_time` output to at most 10 Hz.
   - It handles the commands `play`, `stop` and `record <0|1>`, taking `record` as the target state on the deferred path.
   - Node side: a pure `lib/transport.js` to format position (`bar.beat`, 1-based, signature-aware) and validate commands.
   - Server additions: SSE `transport` events (snapshot on connect), and `POST /api/transport {command: 'play'|'stop'|'record', value?: 0|1}`. It returns 400 for anything else, and 204 after calling `bridge.transport(command, value)`. Extend the fake bridge and `dev.js` to simulate transport.
   - Wiring in `build_device.py`: route the `transport` selector from node through `[deferlow]` to `js transport.js`. The `transport.js` outlet goes to `node.script`, and it gets `refresh` on load like the other scripts.
2. **UI.** Add a pure `web/js/hold.js`: `createHoldGesture({ ms = 1000 }) -> { down(id, t), move(id, inside), up(id, t) -> boolean, cancel(id), progress(t) -> 0..1 }`.
   - A second pointer cancels it.
   - Leaving the button cancels it.
   - Completion fires once.

   The transport row renders only when `new URLSearchParams(location.search).get('transport') === '1'`. Use the class names listed in the spec. Buttons are disabled when `!canLaunch(state)` or before the first transport snapshot. The Rec button shows recording in red.
3. **Tests:**
   - `hold` tests:
     - early release → no fire
     - 1000 ms → fire once
     - a second pointer → cancel
     - leave → cancel
   - position formatting tests (4/4, 6/8, time 0 → `1.1`)
   - server tests:
     - invalid command → 400
     - `record` without a 0/1 value → 400
     - valid → 204 and the bridge is called
     - SSE `transport` snapshot on connect
     - auth applies to `/api/transport`
4. **Headless browser check** against `dev.js` at 390×844 and 1280×800:
   - no transport without `?transport=1`
   - with it, Play taps work
   - Stop and Rec need the hold
   - the lock disables all three

## Scope
- **In:** the plan above.
- **Out:** all of the spec's non-goals. Don't change existing scene or mix behaviour.
- **Files you own:**
  - `setlist-touch/device/transport.js`, `setlist-touch/device/lib/transport.js`, `setlist-touch/device/lib/app.js`, `setlist-touch/device/lib/fake-bridge.js`, `setlist-touch/device/dev.js`
  - `setlist-touch/device/setlist-server.js`, `setlist-touch/device/build_device.py`, `setlist-touch/device/SetlistTouch.amxd`, `setlist-touch/device/SetlistTouch.maxpat`
  - `setlist-touch/device/web/index.html`, `setlist-touch/device/web/style.css`, `setlist-touch/device/web/js/app.js`, `setlist-touch/device/web/js/hold.js`, `setlist-touch/device/web/js/transport-render.js`
  - new test files under `setlist-touch/test/` for these modules, plus `setlist-touch/test/app.test.js` and `setlist-touch/test/device.test.js`
  - `setlist-touch/README.md` (add a short Transport section)
  - your handoff files for key `0003`
- **Do not touch:** `lom.js`, `mix.js`, other web modules, the root `device/`, the root `README.md`, and `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Spec behaviour met, including the anti-goals: no single tap can stop or toggle recording.
- [ ] `cd setlist-touch && npm test` passes. Code runs on Node 16 with zero runtime deps, and `transport.js` is ES5.
- [ ] `python3 device/build_device.py` succeeds deterministically (the device test passes).
- [ ] Browser check results are described in the PR.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py
SETLIST_TOUCH_PORT=5230 node device/dev.js   # check http://localhost:5230/?transport=1 in a headless browser
```

## Known gotchas / decisions already made
- The user plays from Session view and records the show into Arrangement, so Rec = `record_mode` (Arrangement Record), not Session record.
- Use the 1 s hold for both Stop and Rec, in both directions. Play is a tap.
- `?transport=1` opts a screen in; there's no server setting.
- Space must stay inert on the page (phase 1 rule), and inputs must still accept spaces.
- Live-only checks (actual LOM behaviour) are for the user. List them in your return handoff.

## Open questions
None.

---
## Receiver ack

Accepted: implement the opt-in transport row on both pages, with Play on a clean tap and Stop/Arrangement Record only after a cancellable 1-second hold. Add the ES5 LiveAPI lane, validated/authenticated HTTP and SSE transport state, deterministic device wiring, fake transport, pure gesture/position tests, and browser verification at both specified viewports. I will change only the declared owned files and task 0003 handoffs, preserve scene/mix behaviour, and return a committed handoff plus draft PR. No open questions.

GBrain was searched for `m4l-control`; it returned no relevant project context. Repository specs and this handoff are the source of truth.

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
