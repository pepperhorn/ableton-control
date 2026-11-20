# Handoff: 0016 — X32 server hardening (codex → lead)

- **Date:** 2026-11-20
- **Type:** return
- **Ledger:** 0016 · **Spec / plan:** none (quick lane)
- **Dispatch / acknowledgement:** [lead to codex](2026-11-20-0016-x32-server-hardening--lead-to-codex.md)
- **Context:** [X32 design](../superpowers/specs/2026-11-19-x32-mixes-design.md), [0015-t4 API contract](2026-11-20-0015-t4-x32-server--codex-to-lead.md)
- **Branch:** orch/0016-x32-server-hardening
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-e940f129-fcf98da7e7c6e5bc
- **Base commit:** ac69fedf7f7731556770998cf46914835edcd72c (contains required 8790c29)
- **Implementation commit:** 88b2f31
- **PR:** https://github.com/pepperhorn/ableton-control/pull/16 (draft)
- **Port:** ephemeral loopback HTTP test only; stopped
- **Status:** closed (implementation complete; lead review pending)

## Goal
Resolve the four server follow-ups from PR #15 while preserving the 0015-t4 response/event shapes and parallel UI ownership.

## Scope
- **In / owned changes:** `setlist-touch/device/lib/{app,x32-mix}.js`, `setlist-touch/device/setlist-server.js`, `setlist-touch/test/{app-x32,device,mix,clipboard}.test.js`, and 0016 handoffs.
- **Out / untouched:** web assets, README, config/access modules, OSC client, LiveAPI, generated device, ledger and other work items.
- Legacy VM fixtures now expose socket `on()` to support the server listener; legacy assertions unchanged.

## Acceptance criteria
- [x] UDP listener exists before bind, reports errors via Max, and a simulated bind failure leaves a real HTTP `/api/me` request working.
- [x] Eight simulated phones share snapshot reads and permission-filtered level builds; readiness and level fanout perform no deep copies. Test checks shared table identity, level freshness, metadata refresh and permission changes.
- [x] Leading-zero IPv4 hosts return a clear 400 without applying settings; canonical IPv4 and null still work.
- [x] With access off, an identified member can save hidden lists on another visible bus. Anonymous writes and access-on forbidden buses remain rejected; lists stay personal.
- [x] Full suite passes; API object/event shapes preserved; built-ins and Node 16-compatible runtime syntax only.
- [x] Scope and whitespace audited.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
# focused
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH node --test test/app-x32.test.js test/device.test.js
cd ..
git diff --check
git diff --stat main...HEAD
```

Final full output:
```text
1..395
# tests 395
# suites 0
# pass 395
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
Focused suite: 29 pass, 0 fail. Execution used Node 22.22.1; no Node 16 runtime or real desk/Ableton/Windows/physical phone checks performed. Initial new UDP regression failed because the test read a private HTTP-server property; corrected to await the public listen port. Final suite passes.

## Known gotchas / decisions made
- The server owns a persistent socket error reporter registered before bind. The existing X32 client's running-state error handler continues to invalidate live desk state after startup. Bind failure is reported as `Setlist Touch X32 UDP: <message>` in Max; HTTP remains available.
- Cache the client's defensive snapshot in the mix adapter. Invalidate on status, snapshot, metadata and explicit config refresh; apply authoritative `level` deltas to that copy. Share levels, source labels and default hidden lists by actual permitted bus set. Member-specific ordering, saved hidden lists and unavailable assignments are composed separately to preserve identity semantics. Identity is still checked per event and delayed write.
- Strict host checking is at the HTTP settings boundary with built-in `net.isIP`, since `config.js` is outside ownership. Previously persisted malformed host strings are not migrated by this task.
- Access-off hidden lists require a known identity and a currently visible desk bus. With access on, existing own/granted-bus checks remain, including admin member-target behavior.
- GBrain searched for `m4l-control X32`; returned unrelated excerpts and partial indexing warnings. No GBrain page informed implementation; repository documents govern. Implementer did not write to GBrain.

## Open questions
None blocking.

## Receiver ack
Lead acknowledges through the ledger.

## Return
- **Outcome:** done
- **What changed:** four fixes and four regressions, plus VM socket fixture updates.
- **Out-of-scope issues found:** no additional changes requested; legacy on-disk leading-zero hosts remain a possible separate config cleanup.
- **Follow-ups:** cross-family review and lead merge decision; real desk and Ableton acceptance gates remain.
- **For GBrain (lead to promote):** keep socket error reporting active before bind; avoid defensive desk clones in readiness and per-phone fanout; cache permission-shared data while retaining personal ordering and hidden lists.
