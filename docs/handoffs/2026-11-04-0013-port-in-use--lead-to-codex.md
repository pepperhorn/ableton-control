# Handoff: 0013 — Port already in use (lead → codex)

- **Date:** 2026-11-04
- **Type:** dispatch
- **Ledger:** 0013 · **Spec:** docs/specs/0013-port-in-use.md · **Plan:** single task, the spec is the plan
- **Branch:** orch/0013-port-in-use · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 0cdf6087c6ce3d253868657206caf304f9065260
- **Port (if running a server):** 5330
- **Status:** open (scope extended 2026-11-04: Open button, see spec "Added" section)

## Goal
When the configured port is busy (bind error, or Windows shadowing where localhost reaches another program), the device moves to the next free port, saves it, and says so on the device panel and the settings page. Done means every spec behaviour has a test, tests pass and a draft PR is open.

## Context you need
- The spec above.
- `setlist-touch/device/setlist-server.js`: startup `app.listen` and `address()`.
- `lib/app.js`: `start`/`listen` and the settings port change around lines 310–360.
- `lib/config.js`: load and save, the damaged-config warning from 0009.
- `build_device.py`: panel `address` message and the `route` outlets.
- README lines 11–13.

## Scope
- **In:** the spec's Behaviour 1–6.
- **Out:** the spec's non-goals; 0012 items.
- **Files you own:** `setlist-touch/device/setlist-server.js`, `setlist-touch/device/lib/app.js`, `setlist-touch/device/lib/config.js`, `setlist-touch/device/build_device.py` with the regenerated `SetlistTouch.amxd`/`.maxpat`, settings UI files under `setlist-touch/device/web/`, `setlist-touch/README.md`, new or changed tests under `setlist-touch/test/`, and your handoff files for key 0013.
- **Do not touch:** `lom.js`, `mix.js`, `players.js`, root `device/`, `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Tests cover:
  - a bind error falls forward
  - a shadowed port (another server on 127.0.0.1:port while this one binds 0.0.0.0) is detected as busy, where the OS allows the setup; otherwise unit-test the check with an injected probe
  - all attempts busy gives the clear message
  - the new port is persisted
  - a damaged config is not overwritten
  - a settings port change to a busy port is refused and does not fall forward
- [ ] The panel shows the fallback and failure text (the build stays deterministic).
- [ ] `npm test` passes; ES5 for Max `js`; Node built-ins only; Node 16 compatible runtime code.
- [ ] Return handoff lists the Windows-only checks.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py && git status --short
```
Use Node 22 if needed: `PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH`.

## Known gotchas / decisions already made
- User decision: fall forward to the next free port, not stop.
- The user copies the whole `device` folder.
- The loopback check must not be fooled by a different program answering 200. Use a nonce.
- Keep `max.outlet('ready')` after a successful listen. Show failure on the panel through the existing `address` route or a new route.
- GBrain: not consulted for this small item.

## Open questions
None.

---
## Receiver ack

Codex: I will implement bounded next-port startup with a nonce-backed loopback check, persist safe fallback ports, show fallback/failure on the panel and Settings, and refuse busy exact-port settings changes. I own only the declared files and my handoffs; no ledger or GBrain writes. Tests and deterministic device builds will be recorded; Windows/Live checks remain explicit. Scope extension acknowledged: fetched origin/main and read the added Open-button requirements from commit 6c63f86; touch-window.js is now owned, with ordered pcontrol open, resize/front and wiring coverage. No open questions. GBrain search returned no relevant project/port guidance.

---
## Return
(write in …--codex-to-lead.md)
