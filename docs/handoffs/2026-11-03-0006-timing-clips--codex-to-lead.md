# Handoff: 0006 — Timing clips on the device track (codex → lead)

- **Date:** 2026-11-03
- **Type:** return
- **Ledger:** 0006 · **Spec:** [0006](../specs/0006-timing-clips.md) · **Plan:** [0006](../plans/0006-timing-clips.md)
- **Dispatch/ack:** [lead-to-codex](2026-11-03-0006-timing-clips--lead-to-codex.md)
- **Branch:** orch/0006-timing-clips
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-71353fff
- **PR:** draft to be opened after this committed return; URL added below once created
- **Base commit:** 07c5cdbff2e4fb990c9f873688e28647e7070b5b (dispatch); specified code base 18e298309c86e909be121e8051bbc95198a82dcc is its ancestor
- **Implementation commit:** b0e78ee
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
- [x] Budget: shared LOM scheduler; six source tracks or one row commit per 15 ms tick. 683 scenes × 32 tracks: worst 62 LiveAPI operations/tick; simulated elapsed 85,395 ms. At most one builder row per tick (limit is three). Real Live elapsed/audio performance remains unverified.
- [x] Longest loop: MIDI/warped audio, ties, offsets, unwarped exclusion, own-track exclusion, missing source, scene bars and clip naming tested.
- [x] Binding: canonical parent ID matched against regular track IDs; add/reorder/remove and logged last-track fallback tested. Existing playing/position tests still pass.
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
```text
# tests 262
# suites 0
# pass 262
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11908.614228
wrote SetlistTouch.maxpat, SetlistTouch.amxd
wrote SetlistTouch.maxpat, SetlistTouch.amxd
device/SetlistTouch.amxd: OK
device/SetlistTouch.maxpat: OK
```
A final binding-read placement adjustment was followed by the entire LOM suite: 31/31 passed. `git diff --check` passes.

## Decisions made
- Keep the builder in lom.js, sharing its work Task; no extra script/install artifact. Source scans and creation run in separate ticks, preserving the budget while playback callbacks remain active.
- Check fresh scene/track ID lists on each builder tick and before accepting a build. Abort on structural changes, preserve already-created clips and report partial counts. Max also checks is_playing at the command boundary.
- Attempt one undo group across the build; close on success, error, refresh, structure cancellation and removal. Unsupported begin/end APIs log to the Max console; README describes ungrouped undo.
- Request-ID Dict replies are retained until Node sends timingForget. Progress resets a ten-second inactivity timeout, rather than limiting total build time. Timeout requests cancellation and warns the user to check Live before retrying.
- After create_clip, re-read has_clip and verify the set name. No retry when Live fails to confirm creation/name.
- Existing transport/players/effect Max routes remain deferred; a timing route is inserted before the transport lane. Generated .maxpat/.amxd rebuilt.

## Live API assumptions and Live-only checks
1. `new LiveAPI('this_device canonical_parent')` resolves the containing track; its numeric id matches `live_set.get('tracks')` pairs. Check on an own MIDI track, after regular-track add/remove/reorder, and the logged return/Main fallback. Rack nesting could resolve a non-track parent and fall back; no recursive parent traversal was specified.
2. `tracks`, `scenes` arrays give stable ordered ID pairs and observers notify structure changes. Check insertion/removal/reordering during a build stops it before further creates.
3. `Track.has_midi_input` identifies a MIDI destination. Audio fallback tracks must reject building. No MIDI track is created automatically.
4. Clip-slot `has_clip` reads are fresh; `call('create_clip', beats)` immediately creates an empty MIDI clip with that loop length. Verify silent clip content, exact loop end and nonzero loop-start sources. Readback and no-retry handling are fixture-tested only.
5. `Clip.is_audio_clip`, `warping`, `loop_start`, `loop_end` yield beats for MIDI/warped audio; unwarped audio is ignored. Check a mixed real set and time-signature overrides, including fractional bar labels if a loop is not a whole number of bars.
6. `clip.set('name', '⏱ <bars> bars')` and name readback preserve Unicode through classic Max js/LiveAPI.
7. `begin_undo_step` / `end_undo_step` may be unavailable. Check whether one undo removes the whole build on the user's Live version, and whether logs/individual undo behave as documented otherwise.
8. A scene launch fires the timing clip in its row. Check manual tap, scene follow actions and vamps; generated clips have no clip follow actions. Verify counts/progress appear from the created timing clips.
9. Check real 683-scene completion time, audio responsiveness, status in the device, moving the device, device deletion during build and jweb/Windows rendering. Local fixtures and simulated scheduler time do not prove these.

## Open questions
None blocking implementation. Lead/user owns the Live-only checks and cross-family review.

## Return
- **Outcome:** done (local implementation and validation)
- **What changed:** device-track timing, explicit admin builder, protected creates, bounded progress/results, empty-set messaging and deterministic packaged patch.
- **Out-of-scope issues found:** none requiring changes.
- **Follow-ups:** cross-family review, lead merge/ledger update, Live checks above.
- **For GBrain (lead to promote):** shared Task scheduling prevents builder/index work stacking; inactivity timeout supports >10-second builds; do not infer Live undo/scene-follow-action proof from fixture tests.
