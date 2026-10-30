# Handoff: 0008 — Monitor tab (codex → lead)

- **Date:** 2026-10-31
- **Type:** return
- **Ledger:** 0008 · **Spec:** [approved design, Part 1](../superpowers/specs/2026-10-30-monitor-and-access-design.md) · **Plan:** [dispatch handoff](2026-10-31-0008-monitor-tab--lead-to-codex.md)
- **Branch:** orch/0008-monitor-tab
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-bba88117
- **PR:** draft PR from this branch (URL recorded in final response)
- **Base commit:** cb7d989bcbad2ba0f940e04c5561f799fc795c80
- **Port:** 5280 (not started)
- **Status:** blocked

## Goal
Implement the read-only Monitor page specified in Part 1, with current/queued scenes, existing progress, persisted tab choice, Wake Lock, tests and browser verification. Stopped before feature edits because the browser does not receive all required scene data and the dispatch explicitly forbids server changes and requires handback if one is needed.

## Context you need
Read the linked spec and dispatch. Receiver acknowledgement was committed first in `7b231745f671845eac1b5cf32e095acb3d6dccb8`.

### Blocking evidence
- `setlist-touch/device/lib/parse-set.js:14-29` discards every scene before the first song title, converts song-title scenes into song metadata without their exact scene name, colour or timing, and drops category scenes. Lines 8-10 also truncate repeated trailing empty scenes.
- `setlist-touch/device/lib/app.js:36-41` calls that parser and broadcasts only its result as `set`; line 131 sends the same parsed snapshot to new browsers. `play` supplies indexes, and `pos` supplies calculated progress, neither supplies missing titles/colours.
- A local reproduction with raw scenes `0: Count in` (red, 16 beats), `1: * Song A` (green), `2: Verse` (blue, 32 beats) produces only song `{id:1,title:'Song A',rows:[{sceneIndex:2,name:'Verse',color:255,...}]}` and `sceneToSong:{'2':1}`. With playing index 0 and fired index 1, neither scene has the required display data. A pure browser function cannot recover the exact current title/colour or queued title/colour.
- This directly affects the requested test for a scene before any `* ` title. It also affects a title scene launched from Live while a player is watching Monitor.

## Scope
- **In:** acknowledged task and investigated existing data contract; reproduced the blocking loss of scene data; verified baseline tests; returned this blocked report and draft PR.
- **Out:** feature implementation, Part 2, Live/server/device changes, ledger and other docs.
- **Files owned:** dispatch Receiver ack and this return handoff. Feature ownership remains exactly the dispatch list, unused.
- **Do not touch:** `lib/*`, Live bridge, `.amxd`, root README, ledger, other docs and all other unowned files.

## Acceptance criteria
- [ ] Monitor Part 1 implemented — blocked before feature changes.
- [x] Existing baseline `npm test` passes (136/136, Node 22.23.4).
- [ ] Browser checks at 390×844, 844×390, 1280×800 — not run because there is no Monitor implementation.
- [x] No unowned files changed; no server or Live changes.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH npm test
```
Output:
```text
1..136
# tests 136
# suites 0
# pass 136
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2237.216254
```
The provided Node 16.20.2 executable started `npm test` but produced only `TAP version 13` during the observed run; I terminated that run and used the installed Node 22.23.4 executable. This does not certify Node 16 tests.

Reproduce missing data from the repository root:
```bash
/home/shaun/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node - <<'JS'
const {parseSet}=require('./setlist-touch/device/lib/parse-set');
const raw=[
  {index:0,name:'Count in',color:16711680,loopBeats:16,beatsPerBar:4},
  {index:1,name:'* Song A',color:65280,loopBeats:null,beatsPerBar:4},
  {index:2,name:'Verse',color:255,loopBeats:32,beatsPerBar:4}
];
console.log(JSON.stringify(parseSet(raw),null,2));
JS
```

## Known gotchas / decisions already made
- GBrain was available; `search("m4l-control")` returned no relevant project pages. No GBrain pages used or written.
- Existing progress is calculated server-side by `lib/progress.js` and delivered as `pos`; a later implementation should consume that result.
- Respect the dispatch stop condition rather than silently restrict Monitor to parsed rows or invent names/colours for omitted scenes.

## Open questions
Lead to resolve: authorise an additive server payload exposing all raw scene display/timing metadata, or explicitly narrow the spec to retained Scenes rows and define the fallback for omitted playing/queued indexes. The former preserves the current requirements but requires new server file ownership and tests. No code proposal was applied.

---
## Receiver ack
For lead acknowledgement through the main-checkout ledger; implementer did not edit the ledger.

---
## Return
- **Outcome:** blocked
- **What changed:** acknowledgement and evidence handoff only.
- **Decisions made:** no feature implementation because the necessary scene metadata is absent from the existing browser contract; explicit scope escalation applies.
- **Out-of-scope issues found:** parsed SSE set payload omits scenes needed by Monitor.
- **Follow-ups:** revise scope/data contract, redispatch; after implementation, user checks a real phone on a mic stand and flash timing against a real queued scene in Live.
- **For GBrain (lead to promote):** Scenes' parsed song data is insufficient for a complete Live Monitor. Raw scene metadata is lost before SSE publication, including pre-title and heading scenes.
