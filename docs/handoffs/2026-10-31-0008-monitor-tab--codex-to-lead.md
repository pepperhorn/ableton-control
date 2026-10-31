# Handoff: 0008 — Monitor tab (codex → lead)

- **Date:** 2026-10-31
- **Type:** return
- **Ledger:** 0008 · **Spec:** [approved design, Part 1](../superpowers/specs/2026-10-30-monitor-and-access-design.md)
- **Plan:** [original dispatch and acknowledgement](2026-10-31-0008-monitor-tab--lead-to-codex.md), with [approved added scope](2026-10-31-0008-monitor-tab--lead-to-codex-answers.md)
- **Branch:** orch/0008-monitor-tab
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-bba88117
- **PR:** https://github.com/pepperhorn/ableton-control/pull/6 (draft)
- **Base:** origin/main at abc991a9557d7e672baf02300b6157a983b89d6e merged to obtain the answers document; original dispatch base cb7d989bcbad2ba0f940e04c5561f799fc795c80
- **Review fixes commit:** 7b3e15e30aeb2a1f6a68d76d5147945e10ec137d (reviewed base 3d646ab7e05bd9b4b4b2e42ebe1e7d21f021f687)
- **Implementation commit:** f5f37bbc64e00b44e200791bff9f3baf176a80d0 (return documentation committed afterwards)
- **Port:** 5280
- **Status:** closed — implementer work done, ready for lead review

## Goal
Deliver Part 1's read-only Monitor page for current and queued scenes, including timing progress, transport/disconnect states, device page preference and optional Wake Lock. Implementation and automated verification are complete. The earlier data-contract blocker is resolved by the lead's added scope.

## Context you need
The approved answers retain the existing parsed `set` contract and add just two scene detail objects to each `play` payload. Metadata is refreshed on both play and scene changes, including when the parsed set itself did not change. New connections receive the enriched play snapshot. No whole raw scene list is published.

## Scope
- **In:** Monitor pure view and renderer, markup/styles, shell page preference and SSE integration, README, enriched current/next play payload and tests, own handoffs.
- **Out:** Part 2 access/members, Live/LOM, `.amxd`, parser or progress library changes, merge/review, physical Live acceptance.
- **Files owned and changed:** `setlist-touch/README.md`; `device/lib/app.js`; `device/web/index.html`, `style.css`, `js/app.js`, `js/view-state.js` (page preference only), new `js/monitor-view.js`, `js/monitor-render.js`; `test/app.test.js`, `test/view-state.test.mjs`, new `test/monitor-view.test.mjs`; task 0008 acknowledgement and return handoff.
- **Do not touch:** all other files. `fake-bridge.js` and `dev.js` needed no changes. The ledger and answers document came from the lead's main commits; the implementation did not edit them.

## Acceptance criteria
- [x] Read-only Monitor tab, remembered per device; no scene, transport or send control on the page.
- [x] Current/next scene metadata works for pre-title, title and normal scenes. Only a literal leading `* ` is stripped for display. Song subtitle uses only `playingSongId`.
- [x] Existing calculated `pos` supplies matching-scene bar count/fill; untimed scenes show title only. Same barline spacing and bounded density as Scenes.
- [x] Queued scene pulses until launch; relaunching the current scene works; reduced motion CSS supplies a solid highlight.
- [x] Stopped, untracked Playing and disconnected states clear stale current scene content from view.
- [x] Transport hidden on Monitor even with `?transport=1`; existing Scenes/My mix/transport tests pass.
- [x] Optional screen Wake Lock requested on Monitor, released on leaving/hiding, and requested on return; errors are silent.
- [x] Tests pass and browser checks complete at 390×844, 844×390 and 1280×800.
- [x] Scope audit and `git diff --check` clean; draft PR updated on same branch.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH npm test
SETLIST_TOUCH_PORT=5280 /home/shaun/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node device/dev.js
# Browser: http://localhost:5280/?transport=1
```
Node 22.23.4 verification (Node 16 test runs explicitly waived by the answers):
```text
1..148
# tests 148
# suites 0
# pass 148
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2898.751434
```
Latest verification includes three review regressions described below. Tests cover pre-title/title/normal current and next metadata, null/deleted scenes, pre-title and title renames, connect snapshots, existing SSE set suppression, pure view timing/queue/relaunch/song/transport/disconnection rules and page preference round trips. Existing 136 tests continue to pass.

### Review follow-up (2026-10-31)

Addressed all four findings in the changes-requested review of `3d646ab`:

1. **Blocker — stale scene metadata during re-index:** `sceneDetails()` returns null while valid progress is incomplete. `onProgress()` refreshes play and broadcasts it if changed, both clearing published current/next immediately on scan start and restoring metadata on completion. This covers fresh Live indexes arriving while the old raw scene map is retained. Existing play indexes/song ID semantics are unchanged; Monitor falls back to its neutral state and indexing banner.
2. **Reconnect flash after stop:** connect snapshots now publish known transport before play, so stopped transport is already available before retained scene metadata can be rendered.
3. **Faint fill:** `.monitor-fill` now uses `rgba(0,0,0,.28)`, matching Scenes.
4. **Pale-colour pulse visibility:** added this explicitly to the user's Live checks here and in the Monitor README. The ring design stays unchanged pending physical evidence; no physical contrast validation is claimed.

Regression tests in `test/app.test.js` failed before the fix and pass after it. They cover both production (`scenes → complete progress → play`) and fixture (`scenes → play → complete progress`) event orders, immediate invalidation on progress start, shifted playing/fired indexes, matching-index position updates, connect snapshots mid-index and restoration on final progress without another play. A separate regression requires stopped transport to precede retained play in the connect snapshot. Full suite: 148 passed, 0 failed on Node 22.23.4. `git diff --check` passes. No finding was left unaddressed; finding 4 is the requested physical-check follow-up, rather than an unverified visual redesign.

Browser checks below are evidence from the original implementation, not a new browser run for this review revision. This revision is covered by the server regressions and the full suite; the only visual code change matches the existing Scenes fill opacity.

### Browser check results
Automated browser against unchanged dev.js fixture on port 5280:

| CSS viewport | Result |
| --- | --- |
| 390×844 | Portrait current/queued cards fit; current title 36 px and queued title 30 px; 91 grid taps sent zero POSTs. Screenshot inspected. |
| 844×390 | Landscape current/queued cards side by side, no overflow; current title 36 px, queued title/counter 30 px; 84 grid taps sent zero POSTs. Screenshot inspected. |
| 1280×800 | Current title 64 px, queued title/counter 51.2 px; no overflow; 252 grid taps sent zero POSTs. Screenshot inspected. |

- Grid checks dispatched pointerdown/up and click to hit-tested elements across the Monitor content. A real browser click on the current card also sent no POST. A fetch spy observed zero app POSTs from these interactions. Explicit harness POSTs to the local fixture's `/api/fire` and `/api/transport` were used separately to create queue/launch/stopped test states; those are not Monitor interactions.
- Queued box had one active `monitor-pulse` animation, with border opacity visibly changing over 300 ms. On launch it hid and had zero active animations; current title followed the launched scene.
- Timed cards had the expected 15/31 barlines for 16/32 bars, matching Scenes. `{EMPTY}` displayed title only, with counter, fill and barlines hidden.
- Transport stayed hidden with `?transport=1`. Switching to My mix still rendered its page; switching back restored Monitor.
- Reload retained Monitor from local storage. Stopping the fixture server showed Reconnecting and hid current/next; restarting recovered the scene on Monitor without selecting it again.
- Stopped transport hid both scene cards and displayed Stopped, despite the fixture retaining a playing index.
- Reduced-motion CSS rules were inspected in-browser: animation disabled, solid inset border. OS reduced-motion emulation was not available through the shared browser tools.
- Wake Lock lifecycle exercised with an injected API stub: `request('screen')`, release on leaving, request on return. Actual secure-context/OS Wake Lock permission is browser dependent.

Local screenshots (outside git, for inspection):
- Portrait: `/home/shaun/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvvmuzou-196ad702.png`
- Landscape: `/home/shaun/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvvmvdto-91a801d1.png`
- Desktop: `/home/shaun/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvvmvi36-9d9f03c7.png`

## Known gotchas / decisions already made
- GBrain was available; the project search returned no relevant pages. No GBrain pages used or written; implementer leaves promotion to lead.
- Consume `pos` calculated by the existing server `progress()` instead of duplicating its math.
- Keep canonical page preference in view-state/shell, leaving the unowned mix reducer unchanged. Monitor maps to the mix reducer's Scenes state, keeping mix faders unavailable.
- Load Monitor renderer on first entry; it registers no command handlers. Shell additionally guards scene launch and transport availability on Monitor.
- Preserve suppression of identical `set` events while refreshing `play` when omitted scene metadata changes.
- Title scenes have no `playingSongId` in the existing parser contract, so the song subtitle is empty for them, exactly as the answers specify.

## Open questions
None.

---
## Receiver ack
For lead acknowledgement through the main-checkout ledger; implementer did not edit the ledger.

---
## Return
- **Outcome:** done
- **PR:** https://github.com/pepperhorn/ableton-control/pull/6
- **What changed:** complete read-only Monitor and the approved bounded play metadata addition.
- **Decisions made:** listed above; no further scope expansion or ADR proposed.
- **Out-of-scope issues found:** none remaining after the approved answers resolved the data gap.
- **Follow-ups:** lead cross-family review and merge. User checks real-phone readability on a mic stand and flash timing against real queued scenes in Live, including whether the white pulse ring is noticeable on pale scene colours at arm's length. The known empty timing slot/no stop button limitation remains as specified. Plain HTTP LAN/tailnet does not supply Wake Lock's secure context.
- **For GBrain (lead to promote):** Monitor can cover scenes outside parsed song rows with just current/next scene metadata in play; refresh these on raw scene changes even if parsed set JSON is identical. Browser fixture evidence does not certify real-phone/Ableton timing or OS Wake Lock behaviour.
