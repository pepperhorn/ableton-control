# Handoff: 0011 — Add player and effects (lead → codex)

- **Date:** 2026-11-02
- **Type:** dispatch
- **Ledger:** 0011 · **Spec:** docs/superpowers/specs/2026-11-01-add-player-and-effects-design.md · **Plan:** docs/plans/0011-add-player-and-effects.md (T1–T3, one dispatch)
- **Branch:** orch/0011-add-player · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 6a1c9450a2e893ba2e010ad19d0a6611a0869cdb
- **Port (if running a server):** 5310 (`SETLIST_TOUCH_PORT=5310 node device/dev.js`)
- **Status:** open

## Goal
Admin adds a player from the web UI (creating or linking a named return, setting its Ext. Out, scoping the member), and players can raise the house reverb and delay in their own mix. Done means the plan's tasks and review focus are met, tests pass and a draft PR is open.

## Context you need
- The spec and plan above are the brief. Also read `setlist-touch/device/mix.js`, `lib/access.js`, `lib/app.js`, `docs/plans/0009-band-access.md` and `docs/specs/0005-large-set-performance.md` (budget).
- The 0010 items are in the ledger row and in plan T2.

## Scope
- **In:** plan T1–T3.
- **Out:** spec non-goals; 2-track; detecting or noting disabled sends.
- **Files you own:** the union of the plan's Owns lists, paths under `setlist-touch/`, plus your handoff files for key 0011.
- **Do not touch:** root `device/`, root `README.md`, `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Every plan review focus item has a test, or a recorded reason it needs Live.
- [ ] `npm test` passes; `mix.js`/`players.js` are ES5; zero runtime deps; budget assertions hold.
- [ ] `python3 device/build_device.py` is deterministic.
- [ ] With access off and no form use, nothing changes for existing setups beyond the effect rows.
- [ ] Browser check done at both sizes; result in the PR.
- [ ] Return handoff lists every Live-only check, and which API assumption each code path rests on.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py
```

## Known gotchas / decisions already made
- LiveAPI observer callbacks can fire synchronously; keep the `building` guards.
- Live JSON values may arrive wrapped, as `routedToMain` shows for `output_routing_type`. Expect the same for the routing lists and handle both shapes.
- Disabled return sends are the user's job in Live.
- GBrain: no project pages used.

## Open questions
None. If a plan detail conflicts with the code, escalate per AGENTS.md §7.

---
## Receiver ack

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
