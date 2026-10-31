# Handoff: 0009 — Band members and access (lead → codex)

- **Date:** 2026-10-31
- **Type:** dispatch
- **Ledger:** 0009 · **Spec:** docs/superpowers/specs/2026-10-30-monitor-and-access-design.md (Part 2) · **Plan:** docs/plans/0009-band-access.md (T1 → T2 → T3, in order, one worktree)
- **Branch:** orch/0009-band-access · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 15ff7f966193bc1e4d6327041fbb2091bf4a8d6c
- **Port (if running a server):** 5290 (`SETLIST_TOUCH_PORT=5290 node device/dev.js`)
- **Status:** open

## Goal
Add band member names on first connect and admin-controlled access, on one shared band password, per Part 2 of the spec and the plan. Done means the plan's acceptance criteria and Review Focus are met, `npm test` passes and a draft PR is open.

## Context you need
- The spec's Part 2 and the plan, in full. The plan has the file ownership, interfaces, tests and Review Focus.
- Existing patterns: `setlist-touch/device/lib/auth.js` (constant-time compare, loopback rule), `lib/config.js`, `lib/app.js` (`handler`, `/api/config`), `web/js/app.js` (page switch, settings).

## Scope
- **In:** plan T1–T3.
- **Out:** the spec's non-goals. No Live, Max or `.amxd` change. If you find one is needed, stop and say so in your return handoff.
- **Files you own:** the union of the plan's T1–T3 **Owns** lists, `setlist-touch/device/lib/fake-bridge.js` and `setlist-touch/device/dev.js` (only if needed to exercise this), plus your handoff files for key `0009`.
- **Do not touch:** `lom.js`, `mix.js`, `transport.js`, `build_device.py`, the root `device/`, the root `README.md`, and `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Plan T1, T2 and T3 acceptance are met, and each Review Focus item has a test.
- [ ] With access off, behaviour is unchanged: every existing test passes without edits to its expectations.
- [ ] The laptop always keeps full control, even with a broken config or cookie.
- [ ] `cd setlist-touch && npm test` passes. Node 16 compatible code, zero runtime deps.
- [ ] The PR describes the browser check results.

## Verify with
```bash
cd setlist-touch && npm test
SETLIST_TOUCH_PORT=5290 node device/dev.js   # headless check http://localhost:5290/
```

## Known gotchas / decisions already made
- The name is an honour system; the user accepted that. Don't add per-member passwords.
- `/api/config` POST currently rebuilds `cfg` from three fields. Merge instead, or members are wiped (plan Review Focus 1).
- Resolve a send's return from `returnIndex` in the current mix, never from the request's `returnName`.
- Live-only checks are for the user. List them in your return handoff.

## Open questions
None.

---
## Receiver ack

Acked 2026-10-31 (Codex). I will implement T1 → T2 → T3 in the owned files only: fail-closed identity/config, server-enforced permissions, and live-updating picker/admin UI. Loopback remains admin and existing access-off behavior stays intact. I will test, browser-check both viewports, and return a committed handoff plus draft PR. No open questions. GBrain search returned no relevant project page.

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
