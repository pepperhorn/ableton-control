# Handoff: 0006 — Timing clips on the device track (codex → lead)

- **Date:** 2026-11-03
- **Type:** return
- **Ledger:** 0006 · **Spec:** [0006](../specs/0006-timing-clips.md) · **Plan:** [0006](../plans/0006-timing-clips.md)
- **Dispatch/ack:** [lead-to-codex](2026-11-03-0006-timing-clips--lead-to-codex.md)
- **Branch:** orch/0006-timing-clips
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-71353fff
- **PR:** https://github.com/pepperhorn/ableton-control/pull/9 (draft)
- **Base commit:** 07c5cdbff2e4fb990c9f873688e28647e7070b5b (dispatch); specified code base 18e298309c86e909be121e8051bbc95198a82dcc is its ancestor
- **Implementation commit:** b0e78ee (initial); r1 follow-up is the subsequent commit on this branch
- **Port:** 5260 (fixture stopped; browser tabs closed)
- **Status:** closed (implementation complete, review and Live checks pending)

## Goal
Bind timing to the device's own regular track and provide an explicit, admin-only action that builds empty MIDI timing clips in empty slots from the longest beat-based loop in each scene row. Show progress, final counts and the received-empty-set message.

## Context you need
Read the linked spec, plan and dispatch. Follow the lead's review/merge protocol; this is a draft PR and has not been reviewed or merged. GBrain searched for `m4l-control timing clips`; no relevant project pages returned or used. No implementer GBrain writes.

## Scope
- **In:** spec behaviours 1, 2 and 4; all seven plan review focus items tested.
- **Out:** clip follow actions, automatic regeneration, timing picker, resizing/deleting existing clips, 0012 follow-ups, production/physical Live validation.
- **Files owned/changed:** setlist-touch/device/{lom.js,build_device.py,SetlistTouch.amxd,SetlistTouch.maxpat,setlist-server.js,lib/app.js,lib/fake-bridge.js,web/**}, setlist-touch/README.md, setlist-touch/test/{lom.test.js,device.test.js,app.test.js,access-view.test.mjs,transport-render.test.mjs,timing-view.test.mjs}, and the two 0006 handoffs. New web helper: web/js/timing-view.js.
- **Do not touch:** root device/, root README.md, other docs and ledger. No implementer edits to those paths. A diff against local main includes the dispatch commit's pre-existing ledger change; audit implementation ownership against 07c5cdb.

## Acceptance criteria and evidence
- [x] Existing clips: harness tests initial occupied slots, a clip gained immediately before create and regeneration after deletion. Fresh has_clip read immediately precedes create_clip.
- [x] Budget: shared LOM scheduler; six source tracks or one row commit per 15 ms tick. 683 scenes × 32 tracks: worst 66 LiveAPI operations/tick; simulated elapsed 163,950 ms with normal work interleaved. At most one builder row per tick (limit is three). Real Live elapsed/audio performance remains unverified.
- [x] Longest loop: MIDI/warped audio, ties, offsets, unwarped exclusion, own-track exclusion, missing source, scene bars and clip naming tested.
- [x] Binding: canonical parent ID matched against regular track IDs; add/reorder/remove and logged last-track fallback tested. Existing playing/position tests still pass. Return, Main, rack, zero-ID and throwing parent lookup each retain read-only fallback but refuse Build, with both form and console reasons. Parent ownership is rechecked on every build slice, including before create.
- [x] Concurrency: indexing, duplicate build, unconfirmed playback, structure drift before starting, tracks/scenes changes during build, removal, explicit timeout cancellation and partial failure covered. No automatic retry of a mutation.
- [x] Admin/Origin: open phone denied with 403, hostile Origin denied, HTTP concurrency/indexing/playback guarded. Uses the same exact admin identity gate that denies members. UI hides controls from non-admins.
- [x] Empty message: real app harness tests initial wait, indexing suppression, empty-set completion, disconnect and reconnect; focused truth-table test covers all combinations.
- [x] ES5 Max script and deterministic build checked. No runtime dependencies added.
- [x] Browser at 390×844 and 1280×800: visible build button, both confirmation prompts captured, disabled during build, `Building timing clips 3 / 33`, completion `Created 0; skipped (already had a clip) 22; skipped (no source clip) 11`, no horizontal overflow. Fixture has pre-existing timing lengths, so it models existing/no-source totals rather than actual Live creation. Empty-set message visible at both sizes; indexing replaced it with `Indexing Live set… 0 / 683`. Confirmations accepted through an instrumented window.confirm; no real Live writes.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
python3 device/build_device.py
# Determinism: record hashes, rebuild, compare.
sha256sum device/SetlistTouch.amxd device/SetlistTouch.maxpat > /tmp/timing-build.sha
python3 device/build_device.py
sha256sum -c /tmp/timing-build.sha
```

## Verification output
Final r1 validation: **20/20 consecutive complete `npm test` runs passed**, 276/276 tests per run (5,520 test executions), with zero failures. One earlier r1 full run also passed 276/276; the final batch was performed after the clock fixes and all final code changes.

```text
TIMING budget {"scenes":683,"tracks":32,"worst":66,"totalMs":163950}
python3 device/build_device.py
setlist-touch/device/SetlistTouch.amxd: OK
setlist-touch/device/SetlistTouch.maxpat: OK
```
The patch remains deterministic and unchanged by rebuilding. `git diff --check` passes. The new form-result tests cover refusal text and warning counts; no fresh browser session or physical Live validation was performed for r1.

## Opus r1 review and lead decisions
- Review: https://github.com/pepperhorn/ableton-control/pull/9#pullrequestreview-5747706592 on f85125c7b2006e6fe536c66fdf2546bfe379566a.
- The user's 2026-11-03 follow-up supersedes the original spec's undo grouping and paused-work choices: read-only fallback only, cosmetic name warnings, no undo grouping, and interleaved normal work.
- Return/Main/rack/unresolved/throwing-parent tests cover refusal at entry and ownership loss before create. A matching regular track is the sole write target.
- Normal dirty-scene and priority-loop changes are published while a 683 × 32 build is still running; all measured slices stay within 150 ops / three rows.

## Flake investigation
- Frozen snapshot of the reviewed head under `/tmp/timing-r1-baseline`: 20 complete original-suite runs passed (262 each). Another 100 focused repetitions of burst/send/transport timing tests passed. Opus's exact uncaptured failure cannot be identified retrospectively.
- Identified a concrete timing-sensitive assertion in `send coalesces a burst and retains the final value`: it required at most two sends even if ten real HTTP requests span more than the 33 ms throttle window. Controlled reproduction staggered request handlers by 12 ms per request; the original test failed `a.ok(calls.length<=2)`. This is legitimate throttling behavior across several windows, so the test's wall-clock assumption was wrong.
- The test now freezes Date and setTimeout via Node 22's built-in mock timers while the real HTTP requests execute. It asserts one initial send, no extra send at 32 ms, and exactly one final coalesced send at 33 ms. Related target-change, permission-revocation, latest-sender and transport tests use explicit virtual boundaries as well. SSE assertions still let socket writes drain after ticking.
- With the same staggered-request reproduction, the fixed burst test passes. No runtime scheduler or throttle behavior changed. MockTimers is an experimental Node test API and is only used in tests; use the pinned Node 22 command above.
- Local evidence: `/tmp/timing-r1-repro.log` (original failure), `/tmp/timing-r1-repro-fixed.log` (fixed pass), baseline/focused logs in `/tmp/timing-r1-baseline-logs/` and `/tmp/timing-r1-targeted/`, final batch in `/tmp/timing-r1-final-logs/`.

To reproduce the original timing assumption on a clean checkout of the reviewed head, save this preload as `/tmp/stagger-send.cjs`:
```js
const http = require('node:http');
const original = http.createServer, defer = setTimeout;
http.createServer = function(handler) {
  let n = 0;
  return original.call(this, (req, res) => {
    if (req.url === '/api/send') defer(() => handler(req, res), ++n * 12);
    else handler(req, res);
  });
};
```
Run `node --require /tmp/stagger-send.cjs --test --test-name-pattern='send coalesces a burst' setlist-touch/test/app.test.js` with Node 22. The reviewed version fails its two-call limit; the revised version passes with the same preload.

## Decisions made
- Keep the builder in lom.js, sharing its work Task; no extra script/install artifact. Alternate a build slice with a normal work slice so dirty scene edits, signature defaults, priority timing and the slow sweep continue during the build. No slice combines both LiveAPI budgets. A normal refresh error also stops the builder.
- Check fresh scene/track ID lists on each builder tick and before accepting a build. Abort on structural changes, preserve already-created clips and report partial counts. Max also checks is_playing at the command boundary.
- Lead r1 decision: no undo grouping across Task ticks. No begin/end undo calls remain in the builder; README describes deleting the generated clips to undo and checking clips with name warnings.
- Request-ID Dict replies are retained until Node sends timingForget. Progress resets a ten-second inactivity timeout, rather than limiting total build time. Timeout requests cancellation and warns the user to check Live before retrying.
- After create_clip, re-read has_clip. Write the stopwatch as an ES5 Unicode escape; round bars to at most two decimals with no trailing zeros. Name-set/readback failures increment unnamed, log a warning and show a warning count in the form; the build continues. Creation failures still stop without retrying.
- Existing transport/players/effect Max routes remain deferred; a timing route is inserted before the transport lane. Generated .maxpat/.amxd rebuilt.

## Live API assumptions and Live-only checks
1. `new LiveAPI('this_device canonical_parent')` resolves the containing track; its numeric id matches `live_set.get('tracks')` pairs. Check on an own MIDI track, after regular-track add/remove/reorder, and the logged return/Main fallback. Rack nesting resolves a non-track parent and retains read-only fallback; Build is refused. Every build slice rechecks the current canonical parent against the saved path, even without a tracks observer callback.
2. `tracks`, `scenes` arrays give stable ordered ID pairs and observers notify structure changes. Check insertion/removal/reordering during a build stops it before further creates.
3. `Track.has_midi_input` identifies a MIDI destination. Every fallback track must reject building, including MIDI fallback tracks. Positively resolved own audio tracks also reject building. No MIDI track is created automatically.
4. Clip-slot `has_clip` reads are fresh; `call('create_clip', beats)` immediately creates an empty MIDI clip with that loop length. Verify silent clip content, exact loop end and nonzero loop-start sources. Readback and no-retry handling are fixture-tested only.
5. `Clip.is_audio_clip`, `warping`, `loop_start`, `loop_end` yield beats for MIDI/warped audio; unwarped audio is ignored. Check a mixed real set and time-signature overrides, including fractional bar labels rounded to at most two decimals.
6. `clip.set('name', '⏱ <bars> bars')` ideally preserves Unicode through classic Max js/LiveAPI. A mismatch/read failure now only warns and increments unnamed; confirm the warning count and inspect those clips in Live.
7. Build uses no undo group. To reverse a build, delete its generated ⏱ clips in Live; inspect any clips reported with name warnings. Existing clips are always skipped.
8. A scene launch fires the timing clip in its row. Check manual tap, scene follow actions and vamps; generated clips have no clip follow actions. Verify counts/progress appear from the created timing clips.
9. Check real 683-scene completion time, audio responsiveness, status in the device, moving the device, device deletion during build and jweb/Windows rendering. Local fixtures and simulated scheduler time do not prove these.

## Open questions
None blocking implementation. Lead/user owns the Live-only checks and cross-family review.

## Return
- **Outcome:** done (local implementation and validation)
- **What changed:** device-track timing, explicit admin builder, protected creates, bounded progress/results, empty-set messaging and deterministic packaged patch.
- **Out-of-scope issues found:** none requiring changes.
- **Follow-ups:** cross-family review, lead merge/ledger update, Live checks above.
- **For GBrain (lead to promote):** alternating Task slices preserve normal timing updates without stacking budgets; inactivity timeout supports >10-second builds; do not infer Live undo/scene-follow-action proof from fixture tests.
