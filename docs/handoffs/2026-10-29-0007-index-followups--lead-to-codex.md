# Handoff: 0007 — 0005 review follow-ups (lead → codex)

- **Date:** 2026-10-29
- **Type:** dispatch
- **Ledger:** 0007 · **Spec:** docs/specs/0005-large-set-performance.md (still applies; this item tightens it) · **Plan:** single task, in this handoff
- **Branch:** orch/0007-index-followups · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 72096c35e2643a722627ed53478e605d0c040e0d
- **Port (if running a server):** 5270 (`SETLIST_TOUCH_PORT=5270 SETLIST_TOUCH_SLOW_INDEX=1 node device/dev.js`)
- **Status:** open

## Goal
Fix the six non-blocking findings from Opus's approved review of PR #4 (0005), without weakening 0005's per-tick budget or its safety guarantees. The full review, with file:line references, is at https://github.com/pepperhorn/ableton-control/pull/4 (`gh pr view 4 --json reviews --jq '.reviews[-1].body'`).

Done means all six items are handled with tests, `npm test` passes and a draft PR is open.

## Context you need
- The spec `docs/specs/0005-large-set-performance.md` (budget, no partial publication, progress feedback) still applies.
- 0005's return handoff, `docs/handoffs/2026-10-29-0005-large-set-performance--codex-to-lead.md`, has your own earlier decisions and budget numbers.
- The user's show set has 683 scenes. The user is about to test 0005 in Live, so keep behaviour changes limited to these items.

## Items (in priority order)
1. **Medium: `mix.js` rescans block phone fader sends for seconds.**
   - **Problem:** `send()` returns early while `dirty` is set, and `MIX_CHUNK = 1` means one track per tick.
   - **Fix:** in the tracks phase, process untagged tracks in a loop up to an operation budget. Only stop at `+ ` tracks for the sends phase.
   - **Also:** consider keeping the previous snapshot's `send` path usable during a rescan. This is safe because `send()` already rechecks ids, names and routing at the final boundary. If you do, record it under "Decisions made".
   - **Target:** fader writes are dropped for ≤ ~300 ms after a track rename, colour change, add or remove on a 100-track set. Prove it in the harness.
2. **Low: status text quotes (`build_device.py:37`).**
   - **Problem:** `sprintf symout` into `prepend set` probably shows `"Indexing scenes …"` with quotes.
   - **Fix:** drop `symout`, so the message box shows plain text. A device test asserts that the patch no longer uses `symout` on that path.
3. **Low: startup indexes twice.**
   - **Problem:** `live.thisdevice` triggers `refresh`, then Node's `ready` calls `refresh` again, which restarts the scan from 0.
   - **Fix:**
     - On `ready`, if a scan is in flight, let it finish.
     - If a scan has completed, re-send `scenes` and the last `progress`/mix snapshot instead of re-indexing.
     - Do the same for `mix.js` and `transport.js` if they're wired the same way. You may read `transport.js`, but only edit it if the double-refresh applies there, and say so.
4. **Low: a track-list change re-indexes every scene.**
   - **Fix:** on a `tracks`-only change (the scene id list is unchanged):
     - rebind the timing-track observers
     - mark every row `dirtyTiming` so the targeted and sweep timing reads refresh `loopBeats`
     - prioritise the playing, queued and current song rows
   - **Keep:**
     - the scene observers
     - the current snapshot
   - **Skip:** the "Indexing…" progress UI.
   - **Test:** a tracks-only change creates no scene metadata reads and no scene observer churn.
5. **Low: `notifydeleted()` releases every observer synchronously.**
   - **Fix:** after `active = false` and the generation bump, stop releasing thousands of observers one by one. Let Max's js teardown free them, or keep a bounded release only where it's needed for correctness (for example, for refresh without deletion).
   - **Requirement:** callbacks must stay inert, which the harness already asserts.
   - **Record your reasoning** under "Decisions made". If you judge explicit release necessary, keep it and explain why.
6. **Nit: no back-off on persistent `workTick` exceptions.**
   - **Fix:** use a `retryDelay` back-off like `mix.js`'s (1 s → 8 s cap, reset on success), and `post()` the error once per back-off step.

## Scope
- **In:** the six items above, plus tests.
- **Out:** everything else. Don't change launch, setlist, mix-fader or transport UI behaviour, or the progress UI design.
- **Files you own:**
  - `setlist-touch/device/lom.js`, `setlist-touch/device/mix.js`, `setlist-touch/device/transport.js` (item 3 only, if it applies)
  - `setlist-touch/device/setlist-server.js`, `setlist-touch/device/lib/app.js`, `setlist-touch/device/lib/fake-bridge.js`, `setlist-touch/device/dev.js`
  - `setlist-touch/device/build_device.py`, `setlist-touch/device/SetlistTouch.amxd`, `setlist-touch/device/SetlistTouch.maxpat`
  - `setlist-touch/test/lom.test.js`, `setlist-touch/test/mix.test.js`, `setlist-touch/test/transport.test.js`, `setlist-touch/test/app.test.js`, `setlist-touch/test/device.test.js`
  - your handoff files for key `0007`
- **Do not touch:**
  - `device/web/**`
  - the root `device/` and the root `README.md`
  - `docs/` outside your handoff files

## Acceptance criteria
- [ ] Items 1–6 are handled. Each has a test, or a recorded reason for why it isn't testable outside Live.
- [ ] 0005's budget assertions still pass: ≤ 150 operations and ≤ 3 scene reads per tick. The 683- and 1,000-scene harness tests still pass.
- [ ] `cd setlist-touch && npm test` passes. `lom.js`, `mix.js` and `transport.js` are ES5, and there are zero runtime deps.
- [ ] `python3 device/build_device.py` is deterministic.
- [ ] The PR reports the updated budget numbers, including the mix fader-dead window before and after.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py
```

## Known gotchas / decisions already made
- LiveAPI observer callbacks can fire synchronously when `property` is assigned. Keep the `subscribing`/`building` guards.
- Never publish a partial scene set, and keep `fire`'s final-boundary name check unchanged.
- Live-only checks are for the user. List them in your return handoff:
  - how the status text looks
  - how long deleting the device takes
  - fader responsiveness after a track rename
- GBrain: no project pages yet for m4l-control.

## Open questions
None.

---
## Receiver ack

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
