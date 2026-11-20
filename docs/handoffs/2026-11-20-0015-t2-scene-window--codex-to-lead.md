# Handoff: 0015-t2 — Scene window, Monitor launch, scene bar (codex → lead)

- **Date:** 2026-11-20
- **Type:** return
- **Ledger:** 0015-t2
- **Spec:** [X32 mixes design](../superpowers/specs/2026-11-19-x32-mixes-design.md)
- **Plan:** [0015 Task 2](../plans/0015-x32-mixes.md)
- **Dispatch/ack:** [lead to codex](2026-11-20-0015-t2-scene-window--lead-to-codex.md)
- **Branch:** orch/0015-t2-scene-window
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-e090eac8-aab883a6930b4a70
- **Base commit:** 57df4758d8d47c80d3385da4657ada04960f2548
- **Implementation commit:** 1914987f002186967e2956fd5b40a5a69b511f33
- **PR:** draft against main, opened from the branch above after this handoff commit; URL in implementer final response.
- **Port:** 5352 (fixture server stopped)
- **Status:** closed

## Goal
Deliver Task 2's bounded scene window, permission-gated Monitor taps, read-only mix scene bar, and the two admin settings. Outcome: done; ready for independent review.

## Scope
- **In / owned:** device/web/js/scene-window.js, scene-window-render.js, monitor-view.js, monitor-render.js, app.js; device/web/index.html and style.css; device/lib/config.js and app.js for the two settings only; related tests; the two 0015-t2 handoffs.
- **Authorised extension:** the lead explicitly authorised device/web/js/access-render.js for the single admin label change to “Can launch scenes” in this session. No other edits to that file.
- **Out:** Tasks 1/3/4/5, 0012, 0004, OSC/X32, lom.js, mix.js, players.js, root device/, other docs, ledger, GBrain writes.
- **Scope audit:** git diff --stat main...HEAD contains only the above paths. Related existing shell test harnesses in access-view.test.mjs and transport-render.test.mjs now supply the new scene imports/form nodes.

## Acceptance criteria
- [x] Every named Task 2 test exists and passes.
- [x] Full npm test passes: 319 tests, zero failures.
- [x] Runtime uses built-ins only and Node 16 syntax; no Max js changes or dependencies.
- [x] Browser checked at 390×844 and 1280×800 with device/dev.js, port 5352.
- [x] Only owned files plus the explicitly authorised label changed.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
git diff --check
git diff --stat main...HEAD
```

## Known gotchas / decisions already made
GBrain search for m4l-control scene window returned unrelated results and an incomplete embedding notice; no GBrain page was relied on. Repo spec/plan govern. Older local memory reinforced the distinction between fixture proof and physical acceptance.

## Open questions
None. Independent review and real Live/Windows touch checks remain for the lead/user.

## Return
- **Outcome:** done
- **Commits:** 1fdb3f7 (receiver ack), 1914987 (implementation), plus this return handoff commit.
- **What changed:** Pure sceneWindow returns exact names, timing bars, roles, matched progress and the current scene index, clipped to the song's parsed rows including End. Monitor uses the large shared renderer, opens locked even when access redirects to Monitor, rechecks permission/connection/lock before POST, and keeps queued flash and neutral states. Mix mounts the read-only current-plus-two window with a guarded phone-local toggle. Admin can edit before/after counts; /api/me exposes sceneWindow to every identity. Stored invalid counts independently fall back to 2; invalid updates are refused.
- **Verification output:**
```text
1..319
# tests 319
# suites 0
# pass 319
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11762.313239
```
  git diff --check passed. Initial red run: 65 passed / 5 failed (new imports/settings/gate absent), before implementation.
- **Browser evidence:** At 390×844, five Monitor rows measured 358px wide, other rows 70px high and current 120px; no document horizontal overflow. At 1280×800, rows measured 1224px wide, other rows 86px and current 120px; no horizontal overflow. Fixture pointer test: locked tap sent zero /api/fire requests, unlocking then clean tap sent one. Mix bar had three rows, zero buttons, 50px height on desktop; hiding stored st.sceneBar='0'. Admin form loaded 2/2; PUT saved/read back 0/1, then restored 2/2. No runtime console errors observed in the snapshot. Preview tab closed and fixture server stopped.
- **Decisions made:** No stopped-scene window: retain Stopped. Scenes outside a parsed song retain the prior read-only raw current display. Queue outside the bounded window retains its separate flashing card. Inside the window the queued row flashes. Empty End names remain exact in pure data and launch requests; display uses ■ End. currentIndex is the Live scene index, consistent with row.index. Bar preference helpers receive storage explicitly so exceptions are testable.
- **Interfaces / additions:** No deviation from named interfaces. Added admin-only GET/PUT/POST /api/settings with flat sceneBefore/sceneAfter, since there was no settings endpoint; /api/config also round-trips these fields. Mounted the scene bar in index.html/app.js without changing mix-render.js or its fader lifecycle.
- **Out-of-scope issues found:** None requiring code changes.
- **Follow-ups:** Verify mic-stand readability, clean touch vs scroll/multitouch, queued scene flash, real timing and re-indexing in Live/Windows jweb and on phones. Browser pointer events and fixture/API tests do not certify physical devices or Live.
- **For GBrain (lead to promote):** Task 2 publishes sceneWindow({songs,play,pos,before,after}), renderSceneWindow(el,view,options), /api/me.sceneWindow and sceneBefore/sceneAfter settings. Keep the mix bar read-only when adding X32 strips in Task 5. No GBrain writes made as implementer.
