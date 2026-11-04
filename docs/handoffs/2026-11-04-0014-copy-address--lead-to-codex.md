# Handoff: 0014 — Click the device's address to copy it (lead → codex)

- **Date:** 2026-11-04
- **Type:** dispatch
- **Ledger:** 0014 · **Spec:** docs/specs/0014-copy-address.md · **Plan:** single task, the spec is the plan
- **Branch:** orch/0014-copy-address · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** b01210305b7d9d2e0d20d1000190c4a6c2663f9c
- **Port (if running a server):** 5340
- **Status:** open

## Goal
Clicking the address on the device panel copies the phone URL to the clipboard and briefly confirms. Done means the spec's behaviours are tested, tests pass, the build is deterministic and a draft PR is open.

## Context you need
- The spec.
- `setlist-touch/device/build_device.py`: the `address` message box, `address-set` and `route`.
- `setlist-touch/device/setlist-server.js`: `lastAddress`, `address()`, indexing status and the startup failure path, from 0013.
- The tests for the generated patch wiring added in 0013.

## Scope
- **In:** spec Behaviour 1–5, and a short README line in `setlist-touch/README.md`.
- **Out:** the spec's non-goals.
- **Files you own:**
  - `setlist-touch/device/build_device.py` and the regenerated `SetlistTouch.amxd`/`.maxpat`
  - `setlist-touch/device/setlist-server.js`
  - a new `setlist-touch/device/lib/clipboard.js` if useful
  - `setlist-touch/README.md`
  - tests under `setlist-touch/test/`
  - your 0014 handoff files
- **Do not touch:** lom.js, mix.js, players.js, lib/app.js unless unavoidable (note why), root `device/`, `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Tests cover:
  - the patch wiring (a click reaches node as a copy command, and the message text never reaches `route` or `lom`)
  - the copied text is the URL only
  - no copy before the server is ready
  - the confirmation and restore, including indexing in between
  - copy failure
  - the clipboard spawn uses an args array with no shell (inject the spawner)
- [ ] `npm test` passes; Node 16-compatible runtime; built-ins only; ES5 for Max js.
- [ ] The return handoff lists the Windows checks.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
python3 device/build_device.py && git status --short
```

## Known gotchas / decisions already made
- Clicking a Max message box outputs its contents, which may be multi-line text with the port note. Convert the click to a bare trigger, e.g. `t b` → `copyAddress` → node.script, so the text never travels.
- `clip.exe` with a default codepage can mangle non-ASCII text, but the URL is ASCII. Still, don't append a newline.
- The user copies the whole `device` folder.
- GBrain: not consulted (small item).

## Open questions
None.

---
## Receiver ack

Acknowledged by Codex, 2026-11-04. I will wire the address click through a bare trigger to a Node copyAddress command, copy only the ready server URL using a built-in clipboard subprocess, and restore current panel status after temporary copy feedback. I own only the files listed above and my 0014 handoffs. I will cover wiring, readiness, status restoration and clipboard failures, run the full tests and deterministic build, then push orch/0014-copy-address and open a draft PR. No open questions. GBrain searched for m4l-control/setlist-touch; no relevant project results were returned. No GBrain writes.

---
## Return
(write in …--codex-to-lead.md)
