# Handoff: 0015-t2 — Scene window, Monitor launch, scene bar (lead → codex)

- **Date:** 2026-11-20
- **Type:** dispatch
- **Ledger:** 0015 · **Spec:** docs/superpowers/specs/2026-11-19-x32-mixes-design.md · **Plan:** docs/plans/0015-x32-mixes.md (Task 2)
- **Branch:** orch/0015-t2-scene-window · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 57df4758d8d47c80d3385da4657ada04960f2548
- **Port (if running a server):** 5352
- **Status:** closed

## Goal
Add the scene window (configurable before/after, default 2/2) in large form on Monitor (touch lock on by default; launch only for members with the scenes permission) and as a hideable slim bar on the mix page, per plan Task 2. Done means every test listed in the plan task passes, the full suite passes, and a draft PR is open.

## Context you need
Read the spec, then the plan: its Global Constraints, its Review Focus, and Task 2. The plan's interfaces are binding, because later tasks build on them by name. Read the existing code each step touches before changing it.

## Scope
- **In:** plan Task 2 only.
- **Out:** the other plan tasks, 0012 and 0004.
- **Files you own:** the plan Task 2 Files list (`web/js/scene-window.js`, `scene-window-render.js`, `monitor-view.js`, `monitor-render.js`, `mix-render.js` for mounting the bar only, `web/js/app.js`, `web/index.html`, css; `lib/config.js` and `lib/app.js` for the two settings only; `lib/access.js` only if needed for the label) and their tests, plus your 0015-t2 handoff files.
- **Do not touch:** `lib/osc.js`, `lib/x32.js`, `lib/fake-x32.js` (Task 1), lom.js, mix.js, players.js, root `device/`, `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Every test named in plan Task 2 exists and passes.
- [ ] `npm test` passes. Runtime code is Node 16-compatible and uses built-ins only. Max `js` stays ES5.
- [ ] Only owned files changed (`git diff --stat main...HEAD`).
- [ ] The return handoff lists any interface deviation, and (for Task 1) every desk-protocol assumption as a check to run on a real X32.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
```

## Known gotchas / decisions already made
- Task 1 and Task 2 run in parallel and own disjoint files.
- The user copies the whole `setlist-touch/device` folder to the laptop.
- GBrain: searched for "X32 OSC xremote"; nothing relevant.

## Open questions
None.

---
## Receiver ack

I will implement Task 2 only: the bounded pure sceneWindow interface, large locked-by-default Monitor with permission-gated clean taps, read-only mix bar with local preference, and validated sceneBefore/sceneAfter admin settings. I own only the listed device web/settings files, related tests, and this task’s handoffs. No interface questions. GBrain search returned unrelated results; repository spec and plan govern. Local tests do not establish Live/Windows or physical touch acceptance.

---
## Return
(write in …--codex-to-lead.md)
