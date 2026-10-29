# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0005

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0004 | Footswitch / MIDI controller support (e.g. FCB1010): learn mode incl. Program Change; next/prev/relaunch relative to the playing song; respects lock | proposed (on hold, phones first) | — | — | — | — | — | — | — | — | 2026-10-29 |
| 0003 | Transport header | https://github.com/pepperhorn/ableton-control/pull/3 | 2026-10-29 (squash of reviewed bfd084a) | Opus approved r2. Optional: extra lost-pointer safeguard (transport-render.js:66). Verify in Live: get_current_beats_song_time format, play/stop idempotence, Arrangement Record toggle. |
| 0002 | In-ear mix pages (phase 2) | https://github.com/pepperhorn/ableton-control/pull/2 | 2026-10-29 (22b634a, squash of reviewed cd24b83) | Opus approved r2. Optional nits: late mid-drag echo or cancel() clears release hold early. Needs user verification in Live 12/Windows: routing JSON and Main/Master name, echo latency vs 1 s hold, send labels, touch. |
| 0001 | Setlist Touch (phase 1) | https://github.com/pepperhorn/ableton-control/pull/1 | 2026-10-29 (e2bc976, squash of reviewed a3f2853) | Opus approved r2. Minor follow-ups folded into 0002: Space blocked in settings inputs; extra LiveAPI reads per position update; empty set shows Reconnecting. Needs user verification in Live on Windows (touch in jweb, END-row empty name, window open/resize). |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
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
