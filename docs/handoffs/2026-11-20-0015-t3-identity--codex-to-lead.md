# Handoff: 0015-t3 — Identity, personal links, optional password (codex → lead)

- **Date:** 2026-11-20
- **Type:** return
- **Ledger:** 0015-t3
- **Spec:** [X32 mixes design](../superpowers/specs/2026-11-19-x32-mixes-design.md)
- **Plan:** [0015, Task 3](../plans/0015-x32-mixes.md)
- **Dispatch:** [lead to codex](2026-11-20-0015-t3-identity--lead-to-codex.md)
- **Branch:** orch/0015-t3-identity
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-a5b5ea0c-86ffa607eeb1ba70
- **Base commit:** 7a618cca66a81154d79865e3a74ea29e0a900e66 (descends from required 109d71c)
- **Implementation commit:** 3500976
- **PR:** https://github.com/pepperhorn/ableton-control/pull/14
- **Port:** 5353 (fixture server stopped after verification)
- **Status:** closed

## Goal
Complete Task 3 identity, links and optional LAN access, with the two assigned Task 2 scene fixes; return a verified draft PR for cross-family review.

## Scope and files owned
Changed only the Task 3 runtime/UI files (`device/lib/{access,auth,app,config}.js`, `device/web/js/{access-view,access-render,app}.js`, `device/web/index.html`), assigned scene renderer, CSS, their tests, and this task's handoffs. No X32, Max JS, root device files, other task docs or ledger edits. `git diff --stat main...HEAD` is the ownership audit; main advanced independently with Task 1 during this task, which is not part of this branch's diff.

## Acceptance criteria and outcome
- **Outcome: done.** Every named Task 3 test is represented and passes. Tests first failed before implementation.
- Signed member cookies have a server-checked 24-hour expiry and matching Max-Age. Missing expiry fails closed. Injected-clock API regression tests cross the exact expiry boundary and reject subsequent writes.
- `st_who` preserves display identity independently of admin authority, including personal links, laptop sessions and admin sign-in. Logout clears member cookies while retaining a valid admin session.
- Slug creation rejects reserved routes/static paths, empty values and collisions. Links redirect to `/`; unknown valid slug paths serve the normal app. Member/admin snapshots include the specified link paths. Admin link fields use the first external IPv4 and actual bound port, matching the device panel's address selection.
- Blank LAN passwords remain forbidden unless `allowOpenLan` is explicitly true. The setting defaults false, validates as a boolean, is offered in laptop settings, and cannot be changed from a remote admin session.
- Name picker is required only for `kind:'none'`. Admin/open prompts offer Not now and persist dismissal in localStorage across reloads and logout. Loopback/jweb never automatically prompts; Choose name in the header explicitly opens it. Only 403 API responses trigger the identity refresh; SSE reconnect retains its existing `/api/me` refresh.
- Scene bar now stacks current + next two compact rows; long names ellipsise. Monitor rows keep the exact raw name drawn, including blank End names, and launch no longer substitutes the latest set's name. Renderer and callback regressions cover that boundary.

## Verification
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
# tests 350
# suites 0
# pass 350
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11755.843575
python3 device/build_device.py && git status --short
# wrote SetlistTouch.maxpat, SetlistTouch.amxd
# (no status output; clean after implementation commit)
```
`git diff --check` passes. Runtime adds no dependencies and uses Node 16-compatible built-ins/syntax. The configured Node 22 test command succeeded; a separate Node 16 run was not performed.

R1 shared-preview browser checks (historical; picker policy superseded by R2 below) against the synthetic `dev.js` fixture on port 5353:
- **390×844:** picker, personal-link redirect, name/Log out, logout reopening picker, admin membership links. Member fieldset width 350px within viewport. Forced clipboard-unavailable branch selected all 35 URL characters.
- **1280×800:** picker/name selection, personal-link redirect retaining admin, logout reopening picker, admin link copy returned “Link copied.” Link used `http://172.21.248.68:5353/keith-ray`, not localhost.
- `test/identity-browser-check.mjs` exports the repeatable real-DOM scene fit assertion, executed through preview evaluation with My mix open at both sizes. At 390: bar 370×110, all three rows 364×32. At 1280: bar 944×110, rows 938×32. All three lie inside the bar and viewport, with long names measured wider than their ellipsised text boxes and no horizontal overflow.
- Fixture server stopped and preview tab closed. These checks do not certify real Ableton, Max jweb, Windows touch or physical audio operation.

## Decisions made
- Local storage remembers optional picker dismissal across browser sessions and logout; storage failures are caught. Only kind none requires identity selection. The jweb loopback URL suppresses automatic prompts, with explicit header opt-in.
- Logout preserves only a valid admin cookie, rather than inferring cookie type from loopback authority. A laptop carrying a member `st_id` still clears it.
- Display identity has no effect on open/admin permissions. Access-off identity continues to label the musician.
- Compact stacked scene rows avoid horizontal scrolling on phones.
- Member save validation also guards the server's add-player route before a Live operation; the protected `players.js` module is unchanged.

## Known gotchas / GBrain
GBrain was searched for m4l-control identity/personal-link decisions. No task-specific evidence was returned; the search reported degraded coverage. No brain pages were used as authority and no implementer brain writes were made. Repo spec and plan govern.

## Open questions
None.

## Follow-ups / for GBrain (lead to promote)
- Cross-family PR review remains the lead's next step; do not merge based on this implementer's checks alone.
- Task 5 owns README updates, including the explicit Wi-Fi-only gate warning; laptop settings already show that warning here.
- Real Live/Windows/Max/touch gates remain separate. Main's independently merged Task 1 is absent from this pinned task base; validate the combined main state on integration.

## Receiver ack
Lead acknowledges through the ledger.

## R2 review response (2026-11-20)
- **Request:** address PR #14 review on 6b3bc68, using the lead's explicit picker policy and accepted efficiency suggestions. Receiver acknowledgement is committed in the dispatch handoff.
- **Outcome:** done. Only assigned identity/server/UI files, their tests and this task's handoffs changed. No ledger, other-task, protected Max or X32 edits.
- Admin/open picker dismissal is durable per device using guarded localStorage. Header opt-in does not erase the stored preference. Logout preserves it. Only kind none requires selection, regardless of stored dismissal. Loopback addresses (localhost, 127/8, IPv6 loopback) suppress automatic prompting; this covers the Live jweb URL set by setlist-server.js. Real jweb remains a physical acceptance gate.
- Split post-Live member validation errors: invalid slugs return `That name can't be used for a link; return remains in Live` (409), retaining the existing config. Test exercises an accepted pre-check followed by a post-add collision in a legacy member list, and proves Live was already called.
- Identity wrapper refreshes only on 403, avoiding per-write identity requests. Existing SSE reconnect and explicit login/selection refresh paths remain intact.
- Static web names and their normalized slugs are cached at module startup. A test makes subsequent directory reads throw while verifying reserved lookups still work.
- Regression tests: admin dismiss, open dismiss, persistence across renderer recreation, header reopening, none required even with stored dismissal, loopback/jweb suppression, localStorage failures, post-Live slug failure, 200 versus 403 refresh, and cached reserved paths.
- **Verification:** failing regression run before implementation: 91 passed / 11 failed. Final full suite: 350/350 passed, zero skipped; `python3 device/build_device.py` succeeded and generated no diff; `git diff --check` passed. No new shared-preview browser run in R2; renderer tests exercise real handlers against a controlled DOM, and the previous scene-bar layout checks remain R1 evidence.
- **Deferred:** existing-member clash warnings remain lead-ledger follow-up only; no warning implementation or ledger edit here.
- **Next:** lead obtains cross-family re-review. No PR monitoring or polling by this implementer.
- **GBrain:** searched again for m4l-control/0015 picker context; no task-specific authority was returned, with incomplete semantic coverage reported. User's explicit R2 decisions govern; implementer made no GBrain writes.
