# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0008

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0005 | Large-set performance + indexing progress | https://github.com/pepperhorn/ableton-control/pull/4 | 2026-10-29 (d57b0a7, squash of reviewed 3cf9f49) | Opus approved r1. Non-blocking follow-ups → 0007. Verify in Live: 683-scene index time, no dropouts, status text quotes, rename ~0.5 s. |
| 0003 | Transport header | https://github.com/pepperhorn/ableton-control/pull/3 | 2026-10-29 (squash of reviewed bfd084a) | Opus approved r2. Optional: extra lost-pointer safeguard (transport-render.js:66). Verify in Live: get_current_beats_song_time format, play/stop idempotence, Arrangement Record toggle. |
| 0002 | In-ear mix pages (phase 2) | https://github.com/pepperhorn/ableton-control/pull/2 | 2026-10-29 (22b634a, squash of reviewed cd24b83) | Opus approved r2. Optional nits: late mid-drag echo or cancel() clears release hold early. Needs user verification in Live 12/Windows: routing JSON and Main/Master name, echo latency vs 1 s hold, send labels, touch. |
| 0001 | Setlist Touch (phase 1) | https://github.com/pepperhorn/ableton-control/pull/1 | 2026-10-29 (e2bc976, squash of reviewed a3f2853) | Opus approved r2. Minor follow-ups folded into 0002: Space blocked in settings inputs; extra LiveAPI reads per position update; empty set shows Reconnecting. Needs user verification in Live on Windows (touch in jweb, END-row empty name, window open/resize). |
| 0007 | 0005 review follow-ups (mix fader-dead window, status quotes, double startup index, tracks-only re-index, bulk release, error back-off) | in-review | codex/gpt-6.1-sol | orch/0007-index-followups | https://github.com/pepperhorn/ableton-control/pull/5 (head 5a2faf7) | /home/shaun/.t3/worktrees/m4l-control/t3-63b03fd2 | thread:delegated-task:command%3Amcp%3Ad5f78977-ab82-47e2-a4a5-0a5fee001abb%3Adelegate-task%3A0007-impl-r1 | docs/specs/0005-large-set-performance.md | in handoff | docs/handoffs/2026-10-29-0007-index-followups--lead-to-codex.md | 2026-10-29 |
| 0006 | "Build timing clips" button: fill empty slots on the device's own track with empty MIDI clips sized from [N32]-style tags or a chosen reference track; one undo step; skips existing clips (delete a clip + rerun = regen); device track becomes the timing track | proposed (after 0005) | — | — | — | — | — | — | — | — | 2026-10-29 |
| 0004 | Footswitch / MIDI controller support (e.g. FCB1010): learn mode incl. Program Change; next/prev/relaunch relative to the playing song; respects lock | proposed (on hold, phones first) | — | — | — | — | — | — | — | — | 2026-10-29 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
2026-10-29 0007 dispatched→in-review — PR #5 head 5a2faf7, 134 tests; Opus review r1
2026-10-29 0007 proposed→dispatched — user: go; Sol in worktree
2026-10-29 0007 →proposed — Opus r1 non-blocking findings on PR #4
2026-10-29 0005 in-review→merged — PR #4 squash d57b0a7; 117 tests on main; GBrain: pending write-back
2026-10-29 0005 dispatched→in-review — PR #4 head 3cf9f49, 117 tests; Opus review r1
2026-10-29 0006 →proposed — user idea: generate timing clips; regen by deleting a clip and rerunning; explicit action, not during indexing, no auto-refill observers
2026-10-29 0005 →dispatched — user test: 683-scene set froze Live on load (sync scan + 5 s full poll); add chunked indexing + progress feedback; Sol in worktree
2026-10-29 0004 →proposed — idea filed by user; not prioritised. Note: Live MIDI Map can't learn Program Change (FCB1010 default), so in-device MIDI learn is the likely approach. Interim: SceneNav device is MIDI-mappable via CC/notes.
2026-10-29 0003 in-review→merged — PR #3; 104 tests on main; GBrain: pending write-back
2026-10-29 0003 changes-requested→in-review — r2 head bfd084a; Opus review r2
2026-10-29 0003 in-review→changes-requested — Opus r1: play/stop not idempotent (high), stuck pointers, bar.beat from Live, availability tied to setlist
2026-10-29 0003 dispatched→in-review — PR #3 head c2fe570; Opus review r1
2026-10-29 0003 proposed→dispatched — user approved outline; Sol in worktree
2026-10-29 0002 in-review→merged — PR #2 squash 22b634a; 80 tests on main; GBrain: pending write-back
2026-10-29 0002 changes-requested→in-review — r2 head cd24b83; Opus review r2
2026-10-29 0002 in-review→changes-requested — Opus r1: output_routing_type wrapped shape (blocker) + minors; resumed Sol
2026-10-29 0002 dispatched→in-review — PR #2, head 75d511e; Opus review r1
2026-10-29 0002 planned→dispatched — Sol, worktree, branch orch/0002-in-ear-mix
2026-10-29 0001 in-review→merged — PR #1 squash e2bc976; Opus r2 approve; GBrain: pending write-back
2026-10-29 0001 changes-requested→in-review — r2 fixes pushed (head a3f2853, 49 tests); Opus review r2
2026-10-29 0001 in-review→changes-requested — Opus r1: 2 high (Space/Enter refire, view jump after restart), 3 medium (stale fire, 5 s rebuild cancels taps, DNS rebinding); fix round r2 to Sol in worktree
2026-10-29 0002 specced→planned — waits on 0001 merge
2026-10-29 0001 PR #1 opened; Opus review r1 dispatched
2026-10-29 0002 proposed→specced — phase 2 design approved
2026-10-29 0001 dispatched→in-review — built by Sol before orch setup; opening PR for Opus review
