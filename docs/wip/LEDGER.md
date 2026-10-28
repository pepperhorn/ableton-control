# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0003

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0001 | Setlist Touch (phase 1) | https://github.com/pepperhorn/ableton-control/pull/1 | 2026-10-29 (e2bc976, squash of reviewed a3f2853) | Opus approved r2. Minor follow-ups folded into 0002: Space blocked in settings inputs; extra LiveAPI reads per position update; empty set shows Reconnecting. Needs user verification in Live on Windows (touch in jweb, END-row empty name, window open/resize). |
| 0002 | In-ear mix pages (phase 2) | in-review | codex/gpt-6.1-sol | orch/0002-in-ear-mix | https://github.com/pepperhorn/ableton-control/pull/2 | /home/shaun/.t3/worktrees/m4l-control/t3-1fa7b284 | impl r1 head 75d511e (71 tests); Opus review r1 (0002-review-r1) | docs/superpowers/specs/2026-10-29-in-ear-mix-design.md | docs/plans/0002-in-ear-mix.md | docs/handoffs/2026-10-29-0002-in-ear-mix--lead-to-codex.md | 2026-10-29 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
2026-10-29 0002 dispatched→in-review — PR #2, head 75d511e; Opus review r1
2026-10-29 0002 planned→dispatched — Sol, worktree, branch orch/0002-in-ear-mix
2026-10-29 0001 in-review→merged — PR #1 squash e2bc976; Opus r2 approve; GBrain: pending write-back
2026-10-29 0001 changes-requested→in-review — r2 fixes pushed (head a3f2853, 49 tests); Opus review r2
2026-10-29 0001 in-review→changes-requested — Opus r1: 2 high (Space/Enter refire, view jump after restart), 3 medium (stale fire, 5 s rebuild cancels taps, DNS rebinding); fix round r2 to Sol in worktree
2026-10-29 0002 specced→planned — waits on 0001 merge
2026-10-29 0001 PR #1 opened; Opus review r1 dispatched
2026-10-29 0002 proposed→specced — phase 2 design approved
2026-10-29 0001 dispatched→in-review — built by Sol before orch setup; opening PR for Opus review
