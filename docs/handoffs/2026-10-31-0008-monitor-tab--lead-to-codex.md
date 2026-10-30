# Handoff: 0008 — Monitor tab (lead → codex)

- **Date:** 2026-10-31
- **Type:** dispatch
- **Ledger:** 0008 · **Spec:** docs/superpowers/specs/2026-10-30-monitor-and-access-design.md (Part 1 only) · **Plan:** single task, in this handoff
- **Branch:** orch/0008-monitor-tab · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** cb7d989bcbad2ba0f940e04c5561f799fc795c80
- **Port (if running a server):** 5280 (`SETLIST_TOUCH_PORT=5280 node device/dev.js`)
- **Status:** open

## Goal
Add a read-only "Monitor" page beside "Scenes" and "My mix", showing the current scene and the flashing next scene, per Part 1 of the spec. Done means the behaviour is met, `npm test` passes and a draft PR is open. Part 2 (members and access) is out of scope.

## Context you need
- Spec Part 1, including the "Scenes with no timing clip" rule and the "my calls" list.
- `device/web/js/app.js` (page switch, state, SSE handling), `view-state.js` (prefs), `progress.js` in `device/lib` and how `render.js` uses it for bar counts, `transport-render.js` (how transport state arrives).

## Plan
1. Add a pure `web/js/monitor-view.js`: given scenes, play state, position, transport state and connection, return what to show (song title, current scene, next scene, counter/progress, or Stopped / Playing / disconnected). Reuse the existing progress calculation; don't duplicate it.
2. Add `web/js/monitor-render.js` and the page markup and styles, with the spec's class names.
3. Add "Monitor" to the page switch and remember it per device, as the other pages are.
4. Tests in `test/monitor-view.test.mjs`:
   - current scene with and without a timing clip
   - next scene shown only while queued
   - song title lookup, including a scene before any `* ` title
   - Stopped versus neutral Playing
   - disconnected shows no scene as playing
   - queued scene that is also the playing scene (loop relaunch) doesn't break the view
5. Headless browser check against `dev.js` at 390×844, 844×390 and 1280×800: it reads at arm's length, the flash runs and stops on change, and tapping anywhere on the page sends no POST.

## Scope
- **In:** the plan above.
- **Out:** Part 2 of the spec. Any Live, server or `.amxd` change: this item needs none. If you find it does, stop and write that in your return handoff.
- **Files you own:**
  - `setlist-touch/device/web/index.html`, `setlist-touch/device/web/style.css`, `setlist-touch/device/web/js/app.js`, `setlist-touch/device/web/js/view-state.js` (prefs only)
  - new `setlist-touch/device/web/js/monitor-view.js`, `setlist-touch/device/web/js/monitor-render.js`
  - new `setlist-touch/test/monitor-view.test.mjs`; `setlist-touch/test/view-state.test.mjs` if prefs change
  - `setlist-touch/README.md` (a short Monitor section)
  - your handoff files for key `0008`
- **Do not touch:** everything else, including `lom.js`, `mix.js`, `lib/*`, the root `README.md` and `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Spec Part 1 behaviour is met, including read-only: no tap on the page can reach `/api/fire`, `/api/transport` or `/api/send`.
- [ ] Scenes, My mix and transport behaviour are unchanged.
- [ ] `cd setlist-touch && npm test` passes.
- [ ] The PR describes the browser check results.

## Verify with
```bash
cd setlist-touch && npm test
SETLIST_TOUCH_PORT=5280 node device/dev.js   # headless check http://localhost:5280/
```

## Known gotchas / decisions already made
- The app only knows what plays through the timing track. See the spec's known limit; don't try to solve it here.
- Wake Lock needs a secure context, so it silently does nothing over plain http on a LAN.
- Live-only checks are for the user. List them in your return handoff: reading it on a real phone on a mic stand, and the flash timing against a real queued scene.
- GBrain: no project pages yet for m4l-control.

## Open questions
None.

---
## Receiver ack

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
