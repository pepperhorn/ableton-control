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
- **PR:** pending creation after this handoff commit
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
- Name picker is required without a name when access is enabled. With access off it is dismissible for the browser session; Choose name can reopen it. Logout resets the dismissal and reloads. Member/open API responses refresh identity, and SSE reconnect retains the existing `/api/me` refresh.
- Scene bar now stacks current + next two compact rows; long names ellipsise. Monitor rows keep the exact raw name drawn, including blank End names, and launch no longer substitutes the latest set's name. Renderer and callback regressions cover that boundary.

## Verification
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
# tests 336
# suites 0
# pass 336
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11761.411496
python3 device/build_device.py && git status --short
# wrote SetlistTouch.maxpat, SetlistTouch.amxd
# (no status output; clean after implementation commit)
```
`git diff --check` passes. Runtime adds no dependencies and uses Node 16-compatible built-ins/syntax. The configured Node 22 test command succeeded; a separate Node 16 run was not performed.

Shared-preview browser checks against the synthetic `dev.js` fixture on port 5353:
- **390×844:** picker, personal-link redirect, name/Log out, logout reopening picker, admin membership links. Member fieldset width 350px within viewport. Forced clipboard-unavailable branch selected all 35 URL characters.
- **1280×800:** picker/name selection, personal-link redirect retaining admin, logout reopening picker, admin link copy returned “Link copied.” Link used `http://172.21.248.68:5353/keith-ray`, not localhost.
- `test/identity-browser-check.mjs` exports the repeatable real-DOM scene fit assertion, executed through preview evaluation with My mix open at both sizes. At 390: bar 370×110, all three rows 364×32. At 1280: bar 944×110, rows 938×32. All three lie inside the bar and viewport, with long names measured wider than their ellipsised text boxes and no horizontal overflow.
- Fixture server stopped and preview tab closed. These checks do not certify real Ableton, Max jweb, Windows touch or physical audio operation.

## Decisions made
- Session storage remembers optional picker dismissal; storage failures are caught. Required identity selection cannot be dismissed.
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
