# Handoff: 0015-t3 — Identity, personal links, optional password (lead → codex)

- **Date:** 2026-11-20
- **Type:** dispatch
- **Ledger:** 0015 · **Spec:** docs/superpowers/specs/2026-11-19-x32-mixes-design.md · **Plan:** docs/plans/0015-x32-mixes.md (Task 3)
- **Branch:** orch/0015-t3-identity · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** 109d71caa1846942308bc4494aff0fee5dadca6c (includes merged Task 2, PR #13)
- **Port (if running a server):** 5353
- **Status:** open

## Goal
Implement plan Task 3:
- 24-hour member cookie with a server-checked expiry
- a separate `st_who` display identity, so admin survives personal links
- Log out
- `/<slug>` personal links with slug validation
- member links listed in admin
- the `allowOpenLan` switch (default off) for a blank password

Also fix two small Task 2 review follow-ups (below). Done means every test listed in the plan task passes, the full suite passes, and a draft PR is open.

## Context you need
- The spec ("Who they are", "Personal links", "Optional password"). Note the *Lead's call* items there.
- The plan: Global Constraints, Review Focus #5, Task 3.
- Existing code: `lib/access.js` (identify, sign/verify, meFor), `lib/auth.js`, `lib/app.js` (cookie helper near `/api/identify`, `/api/forget`, `/api/members`, static serving), `web/js/access-*.js`.
- The merged Task 2 code in `web/js/scene-window*.js` and `monitor-render.js`.

## Scope
- **In:** plan Task 3, plus these Task 2 follow-ups from the PR #13 review:
  - (a) the mix-page `scene-bar` must fit at 390px wide: the current scene plus the next 2, with long names ellipsised and no clipped third row
  - (b) a Monitor launch sends the scene name as drawn on screen, so the server's existing name check catches a set change between draw and tap, as the Scenes page does
  Add a test for each.
- **Out:** the X32 work (Tasks 1, 4 and 5), and whether the mix page shares the Monitor lock (that's waiting on the user).
- **Files you own:**
  - plan Task 3's Files list
  - `web/js/scene-window.js`, `scene-window-render.js` and `monitor-render.js` (for (a) and (b) only)
  - css
  - their tests
  - your 0015-t3 handoff files
- **Do not touch:** `lib/osc.js`, `lib/x32.js`, `lib/fake-x32.js` (Task 1, in review), lom.js, mix.js, players.js, root `device/`, and `docs/` outside your handoff files.

## Acceptance criteria
- [ ] Every test named in plan Task 3 exists and passes, plus tests for (a) and (b).
- [ ] `npm test` passes. Runtime code runs on Node 16 and uses built-ins only.
- [ ] Only owned files changed.
- [ ] The browser check at 390×844 and 1280×800 covers the overlay, Log out, `/<slug>`, the admin links with copy, and the scene bar fit.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
python3 device/build_device.py && git status --short
```

## Known gotchas / decisions already made
- The member cookie and admin cookie are both `st_id` today. The plan adds `st_who` so a personal link never signs admin out.
- Existing installs that never set a password must stay locked (403) unless admin turns on `allowOpenLan`.
- Settings changes stay loopback-only.
- GBrain: nothing relevant.

## Open questions
None.

---
## Receiver ack

I will implement Task 3 identity expiry, personal links, logout and the explicit open-LAN switch, plus the two bounded Task 2 scene fixes. I will change only the assigned runtime/UI files, CSS, their tests and my handoffs; preserve admin permission independently of display identity; verify the full suite, device build and both browser sizes; then push this branch and open a draft PR. No open questions. GBrain search returned no task-specific evidence (coverage degraded); repo spec and plan govern.

R2 ack: apply the lead's PR #14 decisions: required picker only for kind none, persistent optional dismissal, automatic suppression on loopback/jweb with header opt-in, accurate post-Live slug error, 403-only identity refresh and cached reserved static paths. Existing-name clash warnings remain deferred; no ledger edits.

---
## Return
(write in …--codex-to-lead.md)
