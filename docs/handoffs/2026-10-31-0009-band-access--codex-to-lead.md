# Handoff: 0009 — Band members and access (codex → lead)

- **Date:** 2026-10-31
- **Type:** return
- **Ledger:** 0009 · **Spec:** [Part 2](../superpowers/specs/2026-10-30-monitor-and-access-design.md) · **Plan:** [T1–T3](../plans/0009-band-access.md)
- **Dispatch:** [lead → codex](2026-10-31-0009-band-access--lead-to-codex.md)
- **Branch:** orch/0009-band-access
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-2098f564
- **PR:** draft creation follows this commit; branch orch/0009-band-access → main
- **Base commit:** 15ff7f966193bc1e4d6327041fbb2091bf4a8d6c
- **Implementation commit:** 37cf7c68ed52b39140f186ed1597507b1d9777fa
- **Port:** 5290, isolated fixture HOME=/tmp/0009-home
- **Status:** closed

## Goal
Implement the approved T1 → T2 → T3 access layer: shared band password first, signed member/admin identity second, server-enforced permissions, and live-updating picker/admin UI. Ready for the other-family review and lead merge.

## Context you need
Read the linked spec, plan and dispatch. No Live/Max/device build changes were needed. GBrain search for `m4l-control band access` returned no relevant project page; no brain page was used and no write was made (implementer role).

## Scope
- **In:** pure access/config validation; identity/admin/member routes; current-return send enforcement; SSE refresh; picker, filtered pages/mixes, admin member editor and laptop settings.
- **Out:** Live/Max, .amxd, per-member credentials, HTTPS, physical-device acceptance.
- **Files owned/changed:** `setlist-touch/device/lib/{access,config,app}.js`; `setlist-touch/device/web/{index.html,style.css,js/app.js,js/access-view.js,js/access-render.js}`; `setlist-touch/test/{access.test.js,access-view.test.mjs,app.test.js}`; `setlist-touch/README.md`; this task's dispatch ack and return handoff.
- **Protected scope:** no changes to lom/mix/transport implementation, build_device.py, root device/README, ledger, specs or plans.

## Acceptance criteria
- [x] T1, T2, T3 implemented, including all five review-focus regression cases.
- [x] Existing tests pass without changing their expectations.
- [x] Trusted loopback keeps admin despite corrupt cookies/access fields.
- [x] Full npm test passes; built-ins only; Node 16 runtime smoke passes.
- [x] Browser checks recorded below.
- [x] Return handoff committed; push and draft PR follow this commit.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
HOME=/tmp/0009-home SETLIST_TOUCH_PORT=5290 /home/shaun/.nvm/versions/node/v22.22.1/bin/node device/dev.js
```

## Return
- **Outcome:** done
- **What changed:** HMAC identity cookies, constant-time password checks, independently validated access config, long-lived HttpOnly cookies, per-address admin-login rate limit, laptop-only settings merge, member administration, immediate permission refresh, and default name/mix permissions. Pending sends recheck permission using the latest sender's identity.
- **Verification output:**
```text
1..158
# tests 158
# suites 0
# pass 158
# fail 0
# cancelled 0
# skipped 0
# todo 0
Node v16.20.2: access/HMAC and app load passed
```
`git diff --check` passed. `git diff --name-only main...HEAD` contains only owned files plus the task handoffs.
- **Browser checks:** shared preview browser, desktop 1280×800 and mobile 390×844. Access off showed all three page choices and no picker; laptop admin UI added Shaun with Monitor and matching Shaun mix. Separate incognito context used 127.0.0.2 (Host deliberately outside trusted loopback) and shared Basic auth, chose Shaun, and showed only My mix/Monitor and the Shaun return; transport remained hidden with `?transport=1`; direct blocked `/api/fire` returned 403. Laptop enabled Scenes and it appeared live without reload; selected Scenes on the phone, then revoked Scenes/mix, and it moved live to Monitor. Removing the last member returned the phone to an empty picker with Monitor. Separate admin-password sign-in on the phone opened Admin with all pages. Both viewports had no horizontal overflow. Tabs opened for checks were closed. Initial preview navigation preceded server startup and returned connection refused; retry succeeded. Credential-bearing navigation was used only to seed synthetic Basic auth, followed by navigation without URL credentials.
- **Decisions made:** preserve legacy config's enumerable object shape via non-enumerable readable access fields and a serialization hook, so old config consumers/tests remain compatible while generated secrets are saved. Public `/api/config` retains its original shape until access/admin settings exist; the settings UI treats omitted accessEnabled as false. Lazy-load the access UI, like Monitor, keeping the laptop operational if that module fails. Phone admin cookies remain admin while restrictions are off, enabling the first-member workflow. Serialize member/settings writes with the existing changing guard. Recheck coalesced send permission at flush time and retain the latest sender's resolver.
- **Out-of-scope issues found:** Node 16's experimental test runner lacks `t.after`, already used by the repository's tests. Full suite therefore ran on Node 22; Node 16 was checked separately for runtime access/HMAC/app loading. Default `node` shim is unusable here; explicit NVM path works.
- **Follow-ups:** other-model-family PR review by lead. User must verify Windows/Ableton jweb trusted-loopback control and phone identity persistence after browser restart, then existing real Live/touch acceptance before gig use. No deployment/build/physical proof claimed.
- **For GBrain (lead to promote):** keep identities subordinate to shared Basic auth; resolve return permissions from live return indexes; preserve access fields on laptop saves; last-member removal must leave restrictions on; delayed send commands must carry their current sender's identity and recheck at flush.

## Open questions
None.

## Receiver ack
Lead acknowledges via the ledger on main.
