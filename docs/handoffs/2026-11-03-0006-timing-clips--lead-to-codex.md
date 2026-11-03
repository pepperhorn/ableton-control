# Handoff: 0006 — Timing clips on the device track (lead → codex)

- **Date:** 2026-11-03
- **Type:** dispatch
- **Ledger:** 0006 · **Spec:** docs/specs/0006-timing-clips.md · **Plan:** docs/plans/0006-timing-clips.md
- **Branch:** orch/0006-timing-clips · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 18e298309c86e909be121e8051bbc95198a82dcc
- **Port (if running a server):** 5260
- **Status:** closed

## Goal
Bind timing to the device's own track and add an admin "Build timing clips" action that fills empty device-track slots with empty MIDI clips sized to each row's longest loop. Plus the no-songs message. Done means the plan's review focus is tested, tests pass and a draft PR is open.

## Context you need
Spec and plan above. Read `lom.js` (bindTiming, clipAt, loopAt, playbackChanged, the Task budget), `players.js` from 0011 for the admin set-changing pattern (request id, Dict result, timeout, undo attempt), `lib/app.js` for the 0011 admin routes and `confirmPlaying`, and `docs/specs/0005-large-set-performance.md` for the budget.

## Scope
- **In:** the spec's Behaviour 1, 2 and 4.
- **Out:** spec non-goals; 0012 items.
- **Files you own:** the plan's Owns list, plus your handoff files for key 0006.
- **Do not touch:** root `device/`, root `README.md`, `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Every plan review focus item has a test.
- [ ] `npm test` passes; ES5 for Max scripts; zero runtime deps; deterministic build.
- [ ] Browser check at 390×844 and 1280×800: build button, confirmation, progress, result, no-songs message.
- [ ] Return handoff lists each Live API assumption and the Live-only checks.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py
```
Use Node 22 if the cached Node 16 can't run the suite (`PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH`).

## Known gotchas / decisions already made
- The user's set: 683 scenes; sections advance by scene follow actions or vamp; never clip follow actions.
- Users copy the whole `device` folder, not just the .amxd. Keep new scripts beside it and update the README install line if you add one.
- LiveAPI callbacks can fire synchronously; keep the guards.
- GBrain: no project pages used.

## Open questions
None.

---
## Receiver ack

Acknowledged: bind timing to the device track with logged fallback; implement a budgeted, admin-confirmed empty-slot timing-clip builder, progress/results and the received-empty-set message. I own only the plan-listed paths under setlist-touch/ and these 0006 handoffs (root device/ is excluded). I will test every review focus, run the deterministic build and browser checks, then commit the return and open a draft PR. No questions. GBrain searched for m4l-control timing clips; no relevant project pages returned.

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
