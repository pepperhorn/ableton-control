# Handoff: 0005 — Large-set performance and indexing progress (codex → lead)

- **Date:** 2026-10-29
- **Type:** return
- **Ledger:** 0005 · **Spec:** [0005-large-set-performance](../specs/0005-large-set-performance.md)
- **Plan:** single task in [dispatch handoff](2026-10-29-0005-large-set-performance--lead-to-codex.md)
- **Branch:** orch/0005-large-set-performance
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-b74d6a78
- **PR:** https://github.com/pepperhorn/ableton-control/pull/4 (draft)
- **Base commit:** cbde2eed84a8a4d2cf6b2d377b400fb585ec49ab (dispatch document commit: 633d4c7a909c0380ce9b62c2778c595324400758)
- **Implementation commit:** f44c93fa70e649dfed4a337991a6186a858203b4
- **Port:** 5250; fixture process stopped and browser tabs closed after verification
- **Status:** closed (implementation complete; lead review and physical acceptance pending)

## Goal
Keep scene indexing and observer registration bounded on the 683-scene show set, retain complete snapshots during re-indexing, and report progress in the Max device and web app. Local acceptance is complete; the actual show set and audio remain user verification.

## Context you need
Read the spec and dispatch linked above. The receiver acknowledgement was committed first as 8e4453a. GBrain search for `m4l-control` returned no relevant project page; unrelated weak semantic results were not used. No GBrain writes were made by this implementer.

## Scope
- **In:** chunked scene/observer indexing, incremental metadata/signature updates, targeted and slow timing reads, bounded mix startup/rebinding, progress through Node/SSE/web/device, fixtures and acceptance tests.
- **Out:** transport, launch semantics, setlist/mix UI behaviour beyond indexing status, root `device/`, root README, ledger/spec/other docs.
- **Files owned and changed:** `setlist-touch/device/{lom.js,mix.js,setlist-server.js,dev.js,build_device.py,SetlistTouch.amxd,SetlistTouch.maxpat}`, `setlist-touch/device/lib/{app.js,fake-bridge.js}`, `setlist-touch/device/web/{index.html,style.css,js/app.js}`, `setlist-touch/test/{lom.test.js,mix.test.js,app.test.js,device.test.js}`, `setlist-touch/README.md`, and the two 0005 handoff files.
- **Scope audit:** `git diff --name-only main...HEAD` contains only owned files. No feature code, ledger or protected docs were edited outside this list.

## Acceptance criteria
- [x] AC1: 683/1,000-scene harnesses step Tasks, bound creations/reads/registrations/releases and check every final row; monotonic progress reaches the total, throttled at 120 ms.
- [x] AC2: a simulated minute after indexing performs zero scene metadata reads and at most 180 timing-slot reads; no recurring full scan.
- [x] AC3: one-scene rename reads only that scene; global signatures use cached override/default information.
- [x] AC4: scene-list callbacks trigger chunked replacement while the prior Dict stays unchanged; exact-name `fire` remains usable during re-indexing.
- [x] AC5: deletion during an initial partial scan cancels all Tasks and releases observers; refresh restarts. Repeated structure changes/refreshes drain retired generations in bounded batches.
- [x] AC6: progress streams to existing clients and replays on connect, including completed state; completion follows the final scenes Dict read.
- [x] AC7: browser checks against slow `dev.js` at 390×844 and 1280×800 verify indexing text/bar, bounds, Poppins and normal UI restoration.
- [x] AC8: generated patch routes progress to `sprintf symout Indexing scenes %ld / %ld…` and the existing address box; completion restores the latest address. Generator deterministic.
- [x] AC9: all 117 tests pass on Node 25.9.0; classic Max scripts parse as ES5. Node 16.20.2 device tests and actual HTTP/static/progress-SSE smoke pass. No runtime dependencies added.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py
SETLIST_TOUCH_PORT=5250 SETLIST_TOUCH_SLOW_INDEX=1 node device/dev.js
# Browser sizes: 390x844 and 1280x800, including completion/reconnect.
# Optional Node 16 device checks, using a locally available Node 16 binary:
node --test test/lom.test.js test/mix.test.js test/device.test.js
```

## Verification output
```text
Node v25.9.0: npm test
ℹ tests 117
ℹ suites 0
ℹ pass 117
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
python3 device/build_device.py
wrote SetlistTouch.maxpat, SetlistTouch.amxd
lom.js: ES5 parse passed
mix.js: ES5 parse passed
Node v16.20.2: device test files 3/3 pass, 0 fail
v16.20.2: HTTP static and progress SSE replay passed
```

### Final budget numbers
The counter includes LiveAPI construction, get/getcount/call, observer property assignment and property/id writes on release. Mix harness subscription callbacks also count their synthetic initial get, conservatively. These are operation counts and simulated scheduler durations, not real Live measurements.

| Work | Slice | Worst measured operations/tick | Simulated time to complete snapshot |
|---|---|---:|---:|
| 683 scenes | CHUNK=3, 15 ms delay | 87 | 3,420 ms (3,540 ms including playback/timing follow-up) |
| 1,000 scenes | CHUNK=3, 15 ms delay | 87 | 5,010 ms (5,130 ms including playback/timing follow-up) |
| 100 tagged tracks × 6 external returns | 1 return/track, or 6 sends; 15 ms | 30 (startup 11) | 3,090 ms / 206 ticks |

- Scene slices create at most 24 LiveAPI objects (including 15 observer registrations). The budget assertion is ≤150 operations and ≤3 scene reads per tick.
- Normal re-index/refresh observer retirement releases at most 30 objects / 60 writes per tick. Full replacement of 1,000 scenes adds about 2,505 ms of retirement before reading the new scenes.
- Mix startup before this change measured **3,883 operations in one synchronous burst** on the same 100×6 fixture; this exceeded budget, so it was chunked. Rebinding also retires observers in batches of 30.
- Scene progress emits initially, every 120 ms of scanning (about 8.3 Hz), and at completion.
- `notifydeleted` releases the remaining objects synchronously so teardown leaves no live subscriptions or scheduled work. Normal structure changes and refreshes use bounded retirement.

### Browser evidence
Started `dev.js` with slow indexing on port 5250, loaded both sizes in the shared headless Chromium browser, and restarted the fixture to exercise reconnect with indexing in progress. Each viewport recorded 21 progress states from `13 / 33` through `32 / 33`, followed by hidden indexing/connection bars and rendered scene rows at completion. The progress container and bar stayed within their bounds, document widths equalled their viewports, font was Poppins, and both snapshots had no console entries. The 33 scenes are the development fixture, not the user's show set.

Screenshots outside the repo:
- 390×844 (device scale 2): `/home/shaun/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvt5d35f-35ec0b92.png`
- 1280×800: `/home/shaun/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvt5d3ec-02b89d16.png`

## Decisions made
- Use targeted playing/queued/current-song timing reads in bounded work batches, plus a slow sweep of three timing slots per second. This avoids thousands of additional slot/clip observers. An idle edit elsewhere can take roughly 228 seconds at 683 scenes or 334 seconds at 1,000 scenes to reach the sweep; playback changes prioritise the relevant song.
- Keep only complete scene snapshots public. Retired scene callbacks are generation-guarded immediately, then unsubscribed in bounded batches; scene edits during a scan are coalesced and applied before replacement publication.
- Keep the exact-name check at the final Live launch boundary. Playing/queued/position observations continue during indexing once the timing track exists.
- Slice mix return metadata, track metadata and send reads separately, so send registration remains bounded even with more than six returns. Preserve final-boundary routing/name/structure validation and queued level changes received between index slices.
- Forward completion after the last asynchronous Dict read; store the current URL separately so a port change during indexing restores the correct address afterwards.
- No ADR proposed; these are implementation choices within the approved spec.

## Open questions
None blocking implementation or the draft PR.

## Return
- **Outcome:** done (local implementation); ready for independent other-family review.
- **What changed:** bounded scene and mix indexing, incremental scene refreshes, removal of 5 s whole-set polling, progress feedback and slow-index fixture, regenerated device artifacts and tests.
- **Out-of-scope issue found:** the existing full suite cannot run unchanged under Node 16.20.2 because its `TestContext` has no `t.after`; app tests fail before registering cleanup and keep their servers open. The attempted full Node 16 run was stopped, and this was confirmed with a bounded app-test run. No test-runner compatibility rewrite was made. Runtime compatibility was checked separately via the actual HTTP server/SSE smoke; device tests pass on Node 16.
- **Follow-ups / user-only Live checks:** real 683-scene index time, Live UI/transport responsiveness and no audio dropouts, rename propagation around 0.5 s, and visible Max status/address restoration on Windows/Live. Fixture/browser proof does not establish these physical results.
- **For GBrain (lead to promote):** bound observer construction and retirement as well as scene reads; mix startup can exceed budget even when scene indexing is fixed. Keep the slow-sweep latency explicit. Node 16 runtime support is distinct from support for the repository's modern test cleanup API.
