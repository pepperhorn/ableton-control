# Handoff: 0015-t1 — X32 OSC client and fake desk (lead → codex)

- **Date:** 2026-11-20
- **Type:** dispatch
- **Ledger:** 0015 · **Spec:** docs/superpowers/specs/2026-11-19-x32-mixes-design.md · **Plan:** docs/plans/0015-x32-mixes.md (Task 1)
- **Branch:** orch/0015-t1-x32-client · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 57df4758d8d47c80d3385da4657ada04960f2548
- **Port (if running a server):** 5351
- **Status:** closed

## Goal
Build the standalone X32 OSC client and a fake desk exactly to plan Task 1 interfaces. Nothing is wired into the server yet (that is Task 4). Done means every test listed in the plan task passes, the full suite passes, and a draft PR is open.

## Context you need
Read the spec, then the plan: its Global Constraints, its Review Focus, and Task 1. The plan's interfaces are binding, because later tasks build on them by name. Read the existing code each step touches before changing it.

## Scope
- **In:** plan Task 1 only.
- **Out:** the other plan tasks, 0012 and 0004.
- **Files you own:** `setlist-touch/device/lib/osc.js`, `setlist-touch/device/lib/x32.js`, `setlist-touch/device/lib/fake-x32.js`, `setlist-touch/test/osc.test.js`, `setlist-touch/test/x32.test.js` (new files only), plus your 0015-t1 handoff files.
- **Do not touch:** every existing file, `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Every test named in plan Task 1 exists and passes.
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

Codex, 2026-11-20: I will implement Task 1 only: the OSC codec, standalone X32 client, fake desk and their tests, preserving the named interfaces and fail-closed writes. I own only the five new files listed above and these task handoffs. I will verify the full suite, record real-desk assumptions, and open a draft PR. No open questions. GBrain keyword search found the prior X32 design conversation (2026-11-19); repository spec and plan govern implementation.

---
## Return
(write in …--codex-to-lead.md)
