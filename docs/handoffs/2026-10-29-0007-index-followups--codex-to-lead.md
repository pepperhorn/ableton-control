# Handoff: 0007 — 0005 review follow-ups (codex → lead)

- **Date:** 2026-10-29
- **Type:** return
- **Ledger:** 0007 · **Spec:** [0005-large-set-performance](../specs/0005-large-set-performance.md)
- **Plan:** single task in [0007 dispatch](2026-10-29-0007-index-followups--lead-to-codex.md)
- **Branch:** orch/0007-index-followups
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-63b03fd2
- **PR:** https://github.com/pepperhorn/ableton-control/pull/5 (draft)
- **Base commit:** 72096c35e2643a722627ed53478e605d0c040e0d; starting worktree HEAD ea87cb66c3c30ce74ebad313b610f2e5f547fc8c includes it
- **Receiver ack commit:** 4e372f9
- **Implementation commit:** 4deeb5ee0eadc5e3885467ee4d86bcd9b8d4b112
- **Port:** 5270 reserved; no server or browser started for this task
- **Status:** closed (local implementation complete; lead review and user Live checks remain)

## Goal
Address all six findings from the [approved PR #4 review](https://github.com/pepperhorn/ableton-control/pull/4#pullrequestreview-5693703281), preserve 0005's bounded scene indexing and safety checks, and deliver a tested draft PR.

## Context you need
The spec and dispatch above define the task. [0005's return](2026-10-29-0005-large-set-performance--codex-to-lead.md) contains the earlier architecture and budgets. GBrain search for `m4l-control` returned only unrelated weak semantic matches; no project page was used. As implementer, I made no GBrain writes; promotion notes below are for the lead.

## Scope
- **In:** mix write availability during rescans, plain device status text, startup replay, timing-only handling of tracks changes, deferred host teardown, scene-worker back-off, and regression tests.
- **Out:** all web code/UI, launch semantics, other transport behavior, server/API changes, root `device/`, root README, ledger/spec/other docs.
- **Files owned and changed:** `setlist-touch/device/{lom.js,mix.js,transport.js,build_device.py,SetlistTouch.maxpat,SetlistTouch.amxd}`, `setlist-touch/test/{lom.test.js,mix.test.js,transport.test.js,device.test.js}`, and the two 0007 handoffs.
- **Ownership audit:** only those owned files differ from `main`; no protected files changed. `transport.js` required item 3's fix because the patch originally sent Node ready through the same refresh fan-out as `live.thisdevice`; its only change is the four-line `ready()` handler.

## Acceptance criteria
- [x] Item 1: batch up to 12 untagged tracks per slice, stopping at tagged tracks for separate bounded sends. Keep the prior published generation writable during debounce, scans, failures and bounded retirement. Four 100-track scenarios prove no valid fader writes are dropped; stale identities/names/routing still fail closed. Published level echoes retain the 33 ms cadence; draft observations remain private until publication.
- [x] Item 2: remove `symout`; patch wiring/text and deterministic artifact tests pass. Actual Windows/Live rendering remains user verification.
- [x] Item 3: route Node ready to a separate `ready` message for all three scripts. Ready preserves in-flight scans and replays completed scenes/progress/mix/transport without rebinding observers. Fresh ready still initializes an inactive lane.
- [x] Item 4: tracks-only notifications compare scene IDs, rebind timing observers, retain scene observers and snapshot, dirty all timing rows, and prioritise playing/queued rows followed by current-song rows. No metadata reads, scene observer churn or indexing progress. Changed scene IDs still trigger a full bounded scan, including same-count replacements.
- [x] Item 5: scene and mix deletion first disable callbacks, advance generation and cancel Tasks, then relinquish references for Max's js teardown. Tests cover complete/partial/overlapping generations, zero deletion LiveAPI calls, and inert late callbacks. Explicit refresh/re-index still releases old observers in bounded slices.
- [x] Item 6: scene-worker failures keep the last complete snapshot, cancel work, report once per failed attempt, and retry after 1/2/4/8 seconds, capped at 8. Sweep/playback/metadata notifications cannot shorten the pending retry. Successful recovery resets to 1 second, including failure on a later scene after successful earlier slices.
- [x] 683/1,000-scene budgets remain ≤150 operations and ≤3 scene reads per tick; 134 full-suite tests pass; all three classic scripts parse as ES5; zero runtime dependencies; deterministic build.

## Verify with
```bash
cd setlist-touch
npm test
python3 device/build_device.py
node - <<'JS'
const fs = require('fs'), acorn = require('/usr/share/nodejs/acorn');
for (const name of ['lom', 'mix', 'transport']) {
  acorn.parse(fs.readFileSync('device/' + name + '.js', 'utf8'), {ecmaVersion:5});
  console.log(name + '.js ES5 parse passed');
}
if (Object.keys(require('./package.json').dependencies || {}).length) throw Error('Runtime dependencies');
console.log('zero runtime dependencies');
JS
# The device test rebuilds and compares both artifacts byte for byte.
# Two additional consecutive builds were also compared with SHA-256.
```

## Verification output
```text
Node v25.9.0: npm test
ℹ tests 134
ℹ suites 0
ℹ pass 134
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
python3 device/build_device.py
wrote SetlistTouch.maxpat, SetlistTouch.amxd
Two consecutive rebuilds: byte-identical
lom.js ES5 parse passed
mix.js ES5 parse passed
transport.js ES5 parse passed
zero runtime dependencies
git diff --check: passed
```

### Updated budget numbers
Counts include constructors, gets/getcounts, observer subscription writes and explicit release writes; mix's synthetic initial observer get is counted conservatively. Durations are simulated scheduler time, not Live measurements. Scene slices remain CHUNK=3 with 15 ms spacing.

| Fixture/work | Worst operations per tick | Scene reads per tick | Simulated indexing time |
|---|---:|---:|---:|
| 683 scenes | 87 | 3 | 3,420 ms; 3,540 ms including playback/timing follow-up |
| 1,000 scenes | 87 | 3 | 5,010 ms; 5,130 ms including playback/timing follow-up |
| 100 tagged tracks × 6 returns | 30 (startup 11) | 0 | 3,090 ms / 206 ticks |
| 100 tracks, 1 tagged × 6 returns | 96 | 0 | 255 ms / 17 ticks |
| Mix observer retirement | 60 | 0 | batches of 30 objects at 15 ms |
| Scene/mix `notifydeleted()` | 0 LiveAPI operations | 0 | host teardown timing remains unmeasured |

The same time-aware 100-track/6-return harness was replayed against `git show ea87cb66c3c30ce74ebad313b610f2e5f547fc8c:setlist-touch/device/mix.js` and the new implementation. Each scenario edits the last track, repeatedly sends to an unchanged valid first-track/first-return fader, and checks the first accepted write. New regression tests additionally attempt writes throughout debounce, scan and retirement (344–349 accepted attempts per scenario).

| Change | Before: valid-fader dead window | After: valid-fader dead window |
|---|---:|---:|
| Rename another track | 3,710 ms | 0 ms |
| Colour change | 3,710 ms | 0 ms |
| Append a track | 3,725 ms | 0 ms |
| Remove last track | 3,680 ms | 0 ms |

All-tagged rescans still take about 3.7 seconds including debounce and retirement, but valid faders remain available throughout. The renamed/replaced/moved target itself intentionally rejects stale requests until its fresh snapshot is published; zero milliseconds is not a claim that stale targets accept writes. Published fader feedback during a scan is separately asserted at 33 ms.

## Decisions made
- Retain published track/return/send API maps and subscriptions until a complete replacement is ready, then retire the old generation in bounded batches. Failed scans retain the published snapshot too. This temporarily holds two mix generations rather than disabling all writes while scanning.
- Validate current target track and return IDs against their published ID-list slots, as well as exact names, literal opt-in inherited from the published track, routing, numeric bounds and live API IDs. This narrows the former whole-list equality check to the actual write targets: unrelated structural edits can proceed, while any change in the identities at the requested slots fails closed. No path creates a new API object to guess a stale write target. Tests cover same-name ID replacement and return replacement before notifications.
- A rejected stale request does not restart an already pending scan, so a phone repeating stale requests cannot indefinitely postpone its replacement snapshot.
- Separate published and draft level queues: published writes echo normally while scans run; new-generation changes replay after the snapshot swap using new-generation APIs. This preserves final values even when a fader changes after its replacement value was first read.
- Let Max free scene/mix LiveAPI objects on js destruction after making every callback inert. Explicitly walking both retired and live thousands of observers in `notifydeleted` was the unbounded deletion slice. The harness models host cleanup separately after asserting zero deletion calls and inert callbacks; this is not evidence of actual Max cleanup time. Normal refresh still performs explicit bounded observer retirement. Transport deletion remains explicit and constant-size (six observers), outside item 5's large-index problem.
- Reset scene back-off on successful complete indexing or ordinary successful incremental work, rather than on retirement or each partial scan slice; otherwise a persistent failure on scene 77 would restart at one second forever.
- No ADR proposed; these are implementation choices inside the approved follow-up scope.

## Known gotchas / decisions already made
Synchronous initial observer callbacks remain guarded by `subscribing`/`building`. Complete scene snapshots remain public during replacement indexing; `fire`'s final-boundary exact-name check is unchanged. Local harness results do not establish Windows/Max/Ableton behavior, physical touch or audio stability.

## Open questions
None blocking the implementation or draft PR.

---
## Receiver ack
Lead acknowledges the return through the ledger on `main`; implementer leaves the ledger unchanged.

---
## Return (implementer → lead)
- **Outcome:** done (local implementation); independent other-family review and merge belong to the lead.
- **Commits:** ack 4e372f9; implementation 4deeb5e; this return is committed separately before push/PR creation.
- **What changed:** all six follow-ups, generated device artifacts and 17 additional tests (117 → 134).
- **Out-of-scope issues found:** none requiring edits. No browser/device/audio claims were made from mock tests.
- **Follow-ups / user-only Live checks:** status text appears without quotes and restores the address; actual device-deletion time/observer cleanup; fader responsiveness and echo after a track rename; real 683-scene index time, UI/transport/audio responsiveness, no dropouts, and scene-rename latency around 0.5 seconds.
- **For GBrain (lead to promote):** keep the published mix generation alive through bounded rescans, validate target slot identity rather than unrelated list edits, keep draft level events private, distinguish host teardown from explicit refresh retirement, and reset persistent-error back-off only after substantive successful recovery. Link this handoff, spec and resulting PR if promoted.
