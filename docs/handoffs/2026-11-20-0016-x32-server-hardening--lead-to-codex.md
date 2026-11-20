# Handoff: 0016 — [quick] X32 server hardening from PR #15 review (lead → codex)

- **Date:** 2026-11-20
- **Type:** quick
- **Ledger:** 0016 · **Spec:** none (quick lane; context: docs/superpowers/specs/2026-11-19-x32-mixes-design.md)
- **Branch:** orch/0016-x32-server-hardening · **Worktree:** created by T3
- **Base commit:** 8790c29cb8ebf00d0671af53cc671e06a048e83b
- **Status:** closed

## Goal
Fix four small server issues from the PR #15 review (`gh pr view 15 --repo pepperhorn/ableton-control --comments`):

1. **UDP socket crash:** add an `error` listener to the X32 UDP socket before `bind`, so a bind error can't crash Node. Report it as an X32 status or error, and keep the HTTP server running.
2. **Repeated snapshot copies:** stop copying the full desk snapshot on every status check and per client. Compute the filtered X32 state once per change, per distinct permission set, so a desk scene recall with 8 phones doesn't stall Node.
3. **Host validation:** reject IPv4 octets with leading zeros, e.g. `192.168.001.032`, with a clear 400 message.
4. **Hidden lists with member access off (lead's decision):** with access off and a known member identity, the member may save hidden lists for any bus they can view. With access on, the rule stays "own or granted buses".

## Files you own
- `setlist-touch/device/lib/app.js`
- `setlist-touch/device/lib/x32.js`
- `setlist-touch/device/lib/x32-mix.js` (if it exists)
- `setlist-touch/device/setlist-server.js`
- server tests under `setlist-touch/test/` (`*.test.js`)
- your 0016 handoff files

Don't touch `web/` or README. They belong to 0015-t5, which runs in parallel.

## Acceptance criteria
- [ ] One test per item 1–4. For item 2, test that the state isn't rebuilt per client per event, e.g. a build-count spy.
- [ ] `npm test` passes. Node 16-compatible, built-ins only.
- [ ] No change to the API shapes in the 0015-t4 return handoff.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
```

---
## Receiver ack

Codex acknowledges 2026-11-20: fix UDP socket error handling before bind, cache filtered desk state per change and permission set, reject leading-zero IPv4 octets, and allow identified members to save hidden lists for visible buses while access is off. Preserve the 0015-t4 API shapes, edit only owned server/test files and these handoffs, add regressions for all four items, run the full suite, then push this branch and open a draft PR. No blocking questions. GBrain search returned partial unrelated results; repo docs govern. Base 8790c29 is an ancestor of starting HEAD ac69fed.

---
## Return
(write in …--codex-to-lead.md)
