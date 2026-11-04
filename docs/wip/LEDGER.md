# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0014

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0009 | Band members and access | https://github.com/pepperhorn/ableton-control/pull/7 | 2026-10-31 (squash of reviewed da181fd) | Opus approved r3. Follow-ups → 0010. Verify: jweb stays full admin on Windows, real phones keep their name after a browser restart, Node 16 runtime. |
| 0008 | Monitor tab | https://github.com/pepperhorn/ableton-control/pull/6 | 2026-10-31 (squash of reviewed f24c47e + docs-only main merge fddc1c9) | Opus approved r2. Verify in Live: phone on mic stand, flash vs real queued scene incl. pale colours, blank name time during re-index, possible brief wrong-name flash on scene insert. |
| 0007 | 0005 review follow-ups | https://github.com/pepperhorn/ableton-control/pull/5 | 2026-10-29 (squash of reviewed 8de8c00) | Opus r1 approve + lead fixes (stale Dict on ready, return-list fail-closed); Sol r2 approve. Verify in Live: status text, device delete time, fader echo after rename. |
| 0005 | Large-set performance + indexing progress | https://github.com/pepperhorn/ableton-control/pull/4 | 2026-10-29 (d57b0a7, squash of reviewed 3cf9f49) | Opus approved r1. Non-blocking follow-ups → 0007. Verify in Live: 683-scene index time, no dropouts, status text quotes, rename ~0.5 s. |
| 0003 | Transport header | https://github.com/pepperhorn/ableton-control/pull/3 | 2026-10-29 (squash of reviewed bfd084a) | Opus approved r2. Optional: extra lost-pointer safeguard (transport-render.js:66). Verify in Live: get_current_beats_song_time format, play/stop idempotence, Arrangement Record toggle. |
| 0002 | In-ear mix pages (phase 2) | https://github.com/pepperhorn/ableton-control/pull/2 | 2026-10-29 (22b634a, squash of reviewed cd24b83) | Opus approved r2. Optional nits: late mid-drag echo or cancel() clears release hold early. Needs user verification in Live 12/Windows: routing JSON and Main/Master name, echo latency vs 1 s hold, send labels, touch. |
| 0001 | Setlist Touch (phase 1) | https://github.com/pepperhorn/ableton-control/pull/1 | 2026-10-29 (e2bc976, squash of reviewed a3f2853) | Opus approved r2. Minor follow-ups folded into 0002: Space blocked in settings inputs; extra LiveAPI reads per position update; empty set shows Reconnecting. Needs user verification in Live on Windows (touch in jweb, END-row empty name, window open/resize). |
| 0013 | Port already in use: fall forward to next free port, detect Windows shadowed bind, show on panel | in-review | codex/gpt-6.1-sol | orch/0013-port-in-use | https://github.com/pepperhorn/ableton-control/pull/10 | T3 | — | docs/specs/0013-port-in-use.md | (spec) | docs/handoffs/2026-11-04-0013-port-in-use--lead-to-codex.md | 2026-11-04 |
| 0012 | Review follow-ups: 0011 (stale form can link an alias without naming it first; case-only name difference creates a near-duplicate return); 0006 (Build before track found shows wrong message, lom.js:347; build tick reads track list twice, lom.js:372) | proposed | — | — | — | — | — | — | — | — | 2026-11-02 |
| 0004 | Footswitch / MIDI controller support (e.g. FCB1010): learn mode incl. Program Change; next/prev/relaunch relative to the playing song; respects lock | proposed (on hold, phones first) | — | — | — | — | — | — | — | — | 2026-10-29 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|
| 0006 | Timing clips on the device track | https://github.com/pepperhorn/ableton-control/pull/9 | 2026-11-03 (squash of reviewed 0b68a46) | Opus approved r2; 276 tests on main. Verify in Live: own-track binding, create_clip, ⏱ name, build time on 683 scenes, generated clip launches by tap and scene follow action. |
| 0011 | Add player and effects (includes 0010) | https://github.com/pepperhorn/ableton-control/pull/8 | 2026-11-02 (squash of reviewed a728ef0) | Opus approved r3; 244 tests on main. Live API untested: run the return handoff's Live-only checks on a scratch set before the show set. |

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
2026-11-04 0013 changes-requested→in-review — r2 head 6e886bc, 294 tests; Opus review r2
2026-11-04 0013 in-review→changes-requested — Opus r1 on e49f045: localhost can reach another program on [::1] (important); timeout persists fallback; non-busy errors reported as busy; resumed Sol (probe ::1 + window on 127.0.0.1)
2026-11-04 0013 dispatched→in-review — PR #10 head e49f045, 288 tests; scope incl. Open button; Opus review r1
2026-11-04 0013 →dispatched — user test on larger set: port already taken, no firewall prompt; user chose next free port; Sol in worktree
2026-11-03 0006 in-review→merged — PR #9 9996ba7; 276 tests on main; r2 nits → 0012; GBrain: pending write-back
2026-11-03 0006 changes-requested→in-review — r2 head 0b68a46, 276 tests (20/20 runs); Opus review r2
2026-11-03 0006 in-review→changes-requested — Opus r1 on f85125c: Build could write to the fallback track (blocker); clip name/rounding; undo held open ~85 s; index paused during build; flaky test; resumed Sol
2026-11-03 0006 dispatched→in-review — PR #9 head f85125c, 262 tests; Opus review r1
2026-11-03 0006 proposed→dispatched — user: device track is the timing track; follow actions are always scene follow actions, so generated clips need none; Sol in worktree
2026-11-02 0012 →proposed — Opus r3 low findings on PR #8
2026-11-02 0011 in-review→merged — PR #8 bfcf47d; 244 tests on main; GBrain: pending write-back
2026-11-02 0011 changes-requested→in-review — r3 head a728ef0, 244 tests; Opus review r3 (last before escalating)
2026-11-02 0011 in-review→changes-requested — Opus r2 on 8f1da7a: prefix fix matches A Gtr to E Gtr and can re-route it (blocker); no channels on effect-only sets; 4 low; resumed Sol, r3 is last before escalating
2026-11-02 0011 changes-requested→in-review — r2 head 8f1da7a, 214 tests; Opus review r2
2026-11-02 0011 in-review→changes-requested — Opus r1 on 792e856: 3 blockers (prefixed names never link, existing output can move unchosen, output defaults to first channel so may reach PA) + effect mapping ignores send names, no diagnostic for accepted layouts, identifier 0 refused; resumed Sol
2026-11-02 0011 dispatched→in-review — PR #8 head 792e856, 200 tests; Opus review r1
2026-11-02 0011 →dispatched — user: "build it"; disabled sends left to Ableton UI (no detection or note); no pre-build Live check, build fails safe; Sol in worktree
2026-11-02 0010 proposed→folded into 0011
2026-10-31 0010 →proposed — Opus r3 non-blocking findings on PR #7
2026-10-31 0009 in-review→merged — PR #7; 179 tests on main; GBrain: pending write-back
2026-10-31 0009 changes-requested→in-review — r3 head da181fd, 179 tests; Opus review r3 (last before escalating)
2026-10-31 0009 in-review→changes-requested — Opus r2: regression moves members off My mix on server restart (access-view.js:3); no damaged-config warning; 3 fixes lack coverage; resumed Sol
2026-10-31 0009 changes-requested→in-review — r2 head 792bea5, 170 tests; Opus review r2
2026-10-31 0009 in-review→changes-requested — Opus r1: 4 blockers (damaged config overwritten, unwritable config stops server, saved mix tab lost before /api/me, admin cookie survives password change) + 3 should-fix, 2 minor; resumed Sol
2026-10-31 0009 dispatched→in-review — PR #7 head 15d7dd6, 158 tests; Opus review r1
2026-10-31 0009 planned→dispatched — user approved plan; Sol in worktree
2026-10-31 0009 specced→planned — plan written; awaiting user OK to dispatch
2026-10-31 0008 in-review→merged — PR #6; 148 tests on main; GBrain: pending write-back
2026-10-31 0008 changes-requested→in-review — r2 head f24c47e, 148 tests; Opus review r2
2026-10-31 0008 in-review→changes-requested — Opus r1 blocker: play.current/next use stale scene list during re-index; resumed Sol
2026-10-31 0008 dispatched→in-review — PR #6 head 3d646ab, 145 tests; Opus review r1
2026-10-31 0008 blocked→dispatched — Sol blocked: set payload omits non-song scenes; lead authorised additive play.current/next in lib/app.js; PR #6 draft, resumed Sol
2026-10-31 0009 →specced — access design approved; follows 0008
2026-10-31 0008 →dispatched — monitor design approved; Sol in worktree
2026-10-31 0006 note — held: LOM may not expose clip follow actions, so generated timing clips may not advance with the music; check with user before speccing
2026-10-29 0007 in-review→merged — PR #5; 136 tests on main; GBrain: pending write-back
2026-10-29 0007 in-review — Opus r1 approve (5a2faf7) w/ 2 small findings; lead fixed in 8de8c00 (stale Dict on ready, return-list fail-closed); Sol review r2
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
