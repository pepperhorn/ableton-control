# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0003

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0001 | Setlist Touch (phase 1): touch scene launcher M4L device | in-review | codex/gpt-6.1-sol | feat/setlist-touch (local feat/setlist-touch-r2) | https://github.com/pepperhorn/m4l-control/pull/1 | /home/shaun/.t3/worktrees/m4l-control/t3-f6cd9154 | impl r2 head a3f2853; review r2 dispatched (0001-review-r2) | docs/superpowers/specs/2026-10-29-setlist-touch-design.md | docs/superpowers/plans/2026-10-29-setlist-touch.md | — | 2026-10-29 |
| 0002 | In-ear mix pages (phase 2) | planned | codex/gpt-6.1-sol (planned) | orch/0002-in-ear-mix | — | — | — | docs/superpowers/specs/2026-10-29-in-ear-mix-design.md | docs/plans/0002-in-ear-mix.md | docs/handoffs/2026-10-29-0002-in-ear-mix--lead-to-codex.md | 2026-10-29 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
2026-10-29 0001 changes-requested→in-review — r2 fixes pushed (head a3f2853, 49 tests); Opus review r2
2026-10-29 0001 in-review→changes-requested — Opus r1: 2 high (Space/Enter refire, view jump after restart), 3 medium (stale fire, 5 s rebuild cancels taps, DNS rebinding); fix round r2 to Sol in worktree
2026-10-29 0002 specced→planned — waits on 0001 merge
2026-10-29 0001 PR #1 opened; Opus review r1 dispatched
2026-10-29 0002 proposed→specced — phase 2 design approved
2026-10-29 0001 dispatched→in-review — built by Sol before orch setup; opening PR for Opus review
