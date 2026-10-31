# Handoff: 0009 — Band members and access (codex → lead)

- **Date:** 2026-10-31
- **Type:** return
- **Ledger:** 0009 · **Spec:** [Part 2](../superpowers/specs/2026-10-30-monitor-and-access-design.md) · **Plan:** [T1–T3](../plans/0009-band-access.md)
- **Dispatch:** [lead → codex](2026-10-31-0009-band-access--lead-to-codex.md)
- **Branch:** orch/0009-band-access
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-2098f564
- **PR:** https://github.com/pepperhorn/ableton-control/pull/7 (draft; orch/0009-band-access → main)
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
- [x] Return handoff committed; branch pushed and draft PR #7 opened.

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
1..170
# tests 170
# suites 0
# pass 170
# fail 0
# cancelled 0
# skipped 0
# todo 0
Node v16.20.2: token expiry/rotation and app/config load passed
```
`git diff --check` passed. `git diff --name-only main...HEAD` contains only owned files plus the task handoffs.
- **Browser checks (initial implementation, before R1; not repeated during R1):** shared preview browser, desktop 1280×800 and mobile 390×844. Access off showed all three page choices and no picker; laptop admin UI added Shaun with Monitor and matching Shaun mix. Separate incognito context used 127.0.0.2 (Host deliberately outside trusted loopback) and shared Basic auth, chose Shaun, and showed only My mix/Monitor and the Shaun return; transport remained hidden with `?transport=1`; direct blocked `/api/fire` returned 403. Laptop enabled Scenes and it appeared live without reload; selected Scenes on the phone, then revoked Scenes/mix, and it moved live to Monitor. Removing the last member returned the phone to an empty picker with Monitor. Separate admin-password sign-in on the phone opened Admin with all pages. Both viewports had no horizontal overflow. Tabs opened for checks were closed. Initial preview navigation preceded server startup and returned connection refused; retry succeeded. Credential-bearing navigation was used only to seed synthetic Basic auth, followed by navigation without URL credentials.
- **Decisions made:** preserve legacy config's enumerable object shape via non-enumerable readable access fields and a serialization hook, so old config consumers/tests remain compatible while generated secrets are saved when safe and writable (see R1 corrections below). Public `/api/config` retains its original shape until access/admin settings exist; the settings UI treats omitted accessEnabled as false. Lazy-load the access UI, like Monitor, keeping the laptop operational if that module fails. Phone admin cookies remain admin while restrictions are off, enabling the first-member workflow. Serialize member/settings writes with the existing changing guard. Recheck coalesced send permission at flush time and retain the latest sender's resolver.
- **Out-of-scope issues found:** Node 16's experimental test runner lacks `t.after`, already used by the repository's tests. Full suite therefore ran on Node 22; Node 16 was checked separately for runtime access/HMAC/app loading. Default `node` shim is unusable here; explicit NVM path works.
- **Follow-ups:** other-model-family PR review by lead. User must verify Windows/Ableton jweb trusted-loopback control and phone identity persistence after browser restart, then existing real Live/touch acceptance before gig use. No deployment/build/physical proof claimed.
- **For GBrain (lead to promote):** keep identities subordinate to shared Basic auth; resolve return permissions from live return indexes; preserve access fields on laptop saves; last-member removal must leave restrictions on; delayed send commands must carry their current sender's identity and recheck at flush.

## Open questions
None.

## Receiver ack
Lead acknowledges via the ledger on main.


## PR #7 review R1 corrections — 2026-10-31

Addressed the review of `15d7dd60dc555c6fef0226390231c198098120a2`: all four blockers, all three should-fix findings, and both minor findings. None deferred. The initial validation missed these cases; the regressions below supersede the earlier coverage claim.

| Finding | Correction | Regression evidence |
|---|---|---|
| 1. Damaged config overwritten/fails open | Parse/base failures preserve file bytes and return restricted access with no members. Damaged access fields are not written during load. A valid legacy migration writes only the secret, preserving original fields (including unknown fields and omitted defaults). Only ENOENT is fresh install. | `access.test.js`: damaged bytes/fallback and legacy migration tests; truncated JSON, invalid port and invalid members covered. |
| 2. Unwritable config stops laptop | Secret write failures are caught; the in-memory secret lets startup continue. | `access.test.js`: deterministic EACCES injection; bytes remain unchanged, identity stays laptop admin, real app binds an ephemeral port. |
| 3. Saved mix tab erased before identity | `acceptMix` preserves state/preferences until access is ready; `refreshMe` reduces only when the mix snapshot is available. | `access-view.test.mjs`: real app shell receives mix before delayed `/api/me`; Keith stays selected/stored with restrictions off and with multiple allowed mixes. |
| 4. Admin session survives password change/replays forever | Admin token has server-checked `exp` and a constant-time checked password version derived with a domain-separated HMAC keyed by the signing secret. Rotating the password invalidates prior tokens. | `access.test.js`: expired/missing/invalid expiry, password rotation, rejection of legacy admin tokens, keyed version rather than raw password hash. `app.test.js`: old phone cookie loses `/api/me` admin and `/api/members` authority after laptop password change. |
| 5. Stale settings disables restrictions | Untouched access checkbox is omitted from settings POST. Live refresh updates it unless the user deliberately changed it. | `access-view.test.mjs`: real app settings opened off, access refresh enables it, unrelated save omits field; intentional disable still posts false. |
| 6. Saving existing members re-enables access | Auto-enable only on empty-to-nonempty member transition. | `app.test.js`: phone admin saves existing members after laptop disables access; ordinary phone remains open. |
| 7. Send check order/stale returns | Refuse none/no-mix identity before body parsing. Eligible callers with absent returns reach existing 409 mix snapshot validation; known blocked returns remain 403. | `app.test.js`: raw malformed JSON from none → 403; stale index from eligible member → 409 + mix; forged known blocked return → 403. Previous PR-added tests now target Keith (index 3), since index 1 is a filtered effects return and correctly takes the missing-return path. |
| 8. Orphan mix gives blank page | Once the mix snapshot is known, page availability uses currently matching return names; orphan-only permission falls back to Monitor. Readiness also uses filtered returns. | `access-view.test.mjs`: renamed return removes Mix and selects Monitor. |
| 9. Refresh interrupts unrelated gestures/applies stale results | Compare control permissions/page/tab before cancelling or rerendering mix. A sequence counter ignores superseded responses. Actual permission changes still cancel gestures. | `access-view.test.mjs`: unrelated member edit causes no cancel/render; newer restrictive identity beats older open response and moves to Monitor. |

### R1 validation

- Full `PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test` from `setlist-touch`: **170 pass, 0 fail**.
- Ran the updated access/server/app-shell tests against reviewed-head implementation files in a separate temporary directory: **13 failing tests**, including every finding above. The same regressions pass with corrections. No checkout was reverted to run this comparison.
- `git diff --check`: passed. All revision changes stay within the previously owned files and this return handoff.
- Node 16.20.2 smoke: admin token creation/verification, password rotation rejection, and app/config loading passed. The full suite still uses Node 22 for the repository's existing `t.after` requirement.
- R1 client verification is a deterministic harness executing the real `web/js/app.js` with controlled fetch/SSE ordering and real reducers. Browser results above are the original implementation's results; no new browser or physical-device proof is claimed.
- GBrain search repeated; no relevant project page found. Implementer did not write to GBrain.

### Updated decisions and remaining gates

- An unwritable config leaves the signing secret in memory; cookies may need re-selection after restart. Config corruption remains on disk for repair, with access on in memory. A deliberate laptop settings save can still persist repairs.
- Admin tokens issued before this correction intentionally require a fresh sign-in. Member identities are unchanged.
- Lead: request a new cross-family review of the pushed head. Windows/Ableton jweb, actual phone restart persistence, and live/touch acceptance remain the user-only gates from the original handoff.
