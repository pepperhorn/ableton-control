# Handoff: 0015-t4 — X32 in the server (lead → codex)

- **Date:** 2026-11-20
- **Type:** dispatch
- **Ledger:** 0015 · **Spec:** docs/superpowers/specs/2026-11-19-x32-mixes-design.md · **Plan:** docs/plans/0015-x32-mixes.md (Task 4)
- **Branch:** orch/0015-t4-x32-server · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** e0df6a8d3cb81793bc6ad9496f2f40586e411d05 (includes merged Tasks 1–3: PRs #12, #13, #14)
- **Port (if running a server):** 5354
- **Status:** open

## Goal
Implement plan Task 4, which wires the merged X32 client into the server:
- the mix source setting and its migration default
- bus assignment and bus permissions, with linked-bus mapping
- hidden lists per member and per bus
- the `/api/x32*` routes, with fail-closed writes and write coalescing
- the SSE events `x32` and `x32level`
- the toMain warning
- `dev.js` with the fake X32

Done means every test listed in Task 4 passes, the full suite passes, and a draft PR is open.

## Context you need
- The spec ("Mix source setting", "X32 connection", "Assigning a bus", "The mix page in X32 mode" for data needs) and its *Lead's call* items.
- The plan's Global Constraints, Review Focus #1–3, and Task 4.
- The merged code:
  - `lib/x32.js`, `lib/osc.js`, `lib/fake-x32.js`. Their real interfaces are in the Task 1 return handoff, `docs/handoffs/2026-11-20-0015-t1-x32-client--codex-to-lead.md`, and they win over the plan if they differ.
  - `lib/access.js` (`identify` with `member`, `can`, `meFor`).
  - `lib/app.js` (the existing mix, level and SSE patterns, and the fail-closed rule from 0007).
  - `setlist-server.js` and `dev.js`.

## Scope
- **In:** plan Task 4, plus:
  - **(S5)** Don't broadcast `x32level` when the value hasn't changed. With a desk that echoes, the echo plus the read-back would otherwise send duplicates to phones.
- **Out:** all UI (Task 5), README (Task 5), and the Ableton returns mode behaviour, which must stay unchanged.
- **Files you own:** `setlist-touch/device/lib/app.js`, `lib/access.js`, `lib/config.js`, `setlist-server.js`, `dev.js`, new `setlist-touch/test/app-x32.test.js` (and existing tests only where a fixture needs the new config fields), and your 0015-t4 handoff files. A small new `lib/x32-mix.js` for filtering and permission helpers is fine.
- **Do not touch:** `lib/x32.js`, `lib/osc.js`, `lib/fake-x32.js` (if they need a change, stop and note it), `web/`, lom.js, mix.js, players.js, and `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Every test named in plan Task 4 passes, and so does an `x32level` dedupe test.
- [ ] `npm test` passes. Runtime code runs on Node 16 and uses built-ins only.
- [ ] `node device/dev.js` with `SETLIST_TOUCH_FAKE_X32=1` serves `/api/x32` with fake data.
- [ ] Only owned files changed.
- [ ] The return handoff documents the exact API and SSE shapes, because Task 5 builds on them.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
python3 device/build_device.py && git status --short
```

## Known gotchas / decisions already made
- The X32 traffic stays in Node. Max `js` and the LiveAPI budget are not touched.
- The desk is the source of truth: never push levels on connect.
- With member access off, identity still comes from the link or picker (Task 3), so the caller's own bus is first.
- **Real-desk unknowns:**
  - whether the desk echoes writes
  - the idle `/xremote` behaviour

  Both are handled by Task 1, so keep the server agnostic.
- GBrain: nothing relevant.

## Open questions
None.

---
## Receiver ack

Codex: I will implement Task 4 server wiring, config migration, linked-bus permissions, hidden lists, fail-closed/coalesced X32 routes, SSE dedupe and fake dev mode within the owned files. Ableton returns and UI remain unchanged. I will run the named tests, full suite and device build, document exact API/SSE shapes, and open a draft PR. No open questions. Base ancestry and clean worktree verified.

---
## Return
(write in …--codex-to-lead.md)
