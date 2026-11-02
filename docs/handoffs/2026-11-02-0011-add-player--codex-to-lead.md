# Handoff: 0011 — Add player and effects (codex → lead)

- **Date:** 2026-11-02
- **Type:** return
- **Ledger:** 0011
- **Spec:** [approved design](../superpowers/specs/2026-11-01-add-player-and-effects-design.md)
- **Plan:** [T1–T3](../plans/0011-add-player-and-effects.md)
- **Dispatch / acknowledgement:** [lead to codex](2026-11-02-0011-add-player--lead-to-codex.md)
- **Branch:** orch/0011-add-player
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-c5449d61
- **Base commit:** 6a1c9450a2e893ba2e010ad19d0a6611a0869cdb
- **Implementation commit:** 282606f95d2b2c34122f7bd0ef369a7b1e2f71c2
- **PR:** https://github.com/pepperhorn/ableton-control/pull/8 (draft)
- **Port:** 5310; fixture server stopped after browser checks
- **Status:** closed

## Goal
Implement the admin player/return setup form, effect-to-player mix faders and item 0010. Implementation and local acceptance are complete; real Live/Windows/audio acceptance remains for the user, as specified in the dispatch.

## Context you need
Read the linked spec, plan and dispatch. No relevant GBrain project pages were found by the project search; none used. As implementer, I made no GBrain writes and did not change the ledger.

## Scope
- **In:** T1–T3, including Max scripts, bridge/server validation, web form and faders, 0010 fixes, generated device and tests.
- **Out:** 2-track, detecting disabled sends, deletion, live deployment, physical Live/audio verification.
- **Files owned:** union of the plan's Owns lists under setlist-touch/, plus this return and the dispatch Receiver ack. Changes are limited to those files (the plan-owned package files and two handoffs).
- **Do not touch:** root device/, root README.md and other docs; all preserved.

## Acceptance criteria and review focus evidence
- [x] Admin kind only for setup routes, including open-access phones; foreign Origin refused: app tests.
- [x] Effect full-list / skip-own mappings, unknown-layout omission with diagnostic, final IDs/names/routing checks: mix harness tests.
- [x] Create failure causes no subsequent writes; routing failure retains return; manual route recovery links without duplicate creation: players harness.
- [x] Name readback, including simulated prefix, scopes member to actual name: players and app tests. Return lookup now trims, prefers exact matches, then strips a leading A–L letter plus hyphen/space and rejects ambiguous aliases. Stored permission comparison remains exact against Live readback.
- [x] Existing Main refusal and existing external no-op routing: players harness; browser form displays existing routing and selects it.
- [x] Case-insensitive existing-member update, no duplicate, access enablement: app tests.
- [x] Concurrent add refused; 11-second application timeout clears lock and ignores late success; removal rejects pending add: app tests. Max bridge also has a 10-second timeout.
- [x] Server uses current transport state to require confirmPlaying:true: app tests and both browser sizes.
- [x] Existing return observer rebuild / structural final-boundary fail-closed behavior remains tested. A real create triggering Live's return observer is Live-only.
- [x] Existing track faders and echo tests pass. Effect values use separate effectLevel messages and share web gesture/hold behavior with isolated keys.
- [x] Saved mix tab survives empty startup snapshots; stale damaged backup is not advertised as current; warning instructs repair and restart: view/access tests.
- [x] ES5 scripts manually audited and covered by syntax/modern-token checks; no dependency changes. Bounded effect scan phases and the 12-return/eleven-player case assert <=150 operations per tick; existing 100-track budget tests pass.
- [x] Deterministic generated device: byte-identical SHA-256 values after rerunning the builder.

## Verify with
```bash
export PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH
cd setlist-touch
npm test
python3 device/build_device.py
```
Final test output:
```text
1..214
# tests 214
# suites 0
# pass 214
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
`git diff --check` passed. Repeated build produced byte-identical maxpat/amxd. An initial test attempt with the cached Node 16 binary failed on existing test-runner t.after usage; the complete suite ran successfully on installed Node 22.22.1. This does not certify the Max Node runtime.

## Browser verification

The following paragraph records the first review head; the round 2 checks below supersede its auto-selection behavior.
Used the shared T3 preview against dev.js on port 5310 at **1280×800** and **390×844**. Fixture config and saves are memory-only, so adding simulated members does not alter the user's config.

At both sizes: add new player, link same player, Main return refusal, simulated routing-failure message and second confirmation while playing all passed. New names follow player names until the send field is edited. Existing return routing and channel selection were checked after the final UI change at both sizes. No horizontal overflow; phone controls measured 44 px high. Both sizes rendered two effect rows and accepted a horizontal gesture with a fixture echo. At phone size, tap produced zero requests; drag sent only effectIndex:0 → returnIndex:2 and echoed 28 / -11.1 dB. Pointer events were browser-simulated; physical touch remains unverified. Preview tabs were closed.

## Decisions made
- Effect observers use negative internal source keys; wire/API payloads expose explicit nonnegative effectIndex. This avoids collisions with track faders without changing existing track messages.
- Effect mapping metadata and effect parameter subscriptions run in separate bounded phases. Unknown counts or failed reads omit the effect rows and emit a diagnostic.
- New return creation checks count and append-only return-ID structure before naming/routing. Existing Main returns are always refused. Newly created returns may be moved from their initial Main route as part of setup.
- When channels cannot be chosen before creation, the admin must configure an external return in Live and refresh. New returns require an explicit nonempty output on the server and Live side before creation; no first-channel default or create-to-discover fallback remains. This supersedes the original plan fallback by the lead’s review decision. If routing itself fails after an explicit choice, manual routing in Live is required before retry.
- Routing identifiers are treated as opaque values from Live lists, never fabricated. Setters send JSON routing objects and verify readback; this API representation needs the user check below.
- Player result Dict wrappers are retained until Node reads and acknowledges them with forget, avoiding collection before the asynchronous bridge read.
- Undo grouping is attempted inside try/catch. Harness verifies unsupported undo calls do not fail setup. Actual Live undo support/outcome is unverified; scripts log grouping failure.
- The fake dev server now uses memory-only config/saves to keep fixture setup independent of personal settings.

## Live-only checks and API assumptions
1. **Create/name/readback:** Song.call('create_return_track') appends one return; return name is writable and readable as a symbol. Verify exact actual name and any prefix; members use the returned name. Confirm the return_tracks observer fires and the mix rebuild finishes before new faders become writable.
2. **Routing:** available_output_routing_types/channels and output_routing_type/channel are JSON objects/lists, either directly encoded or under a same-name wrapper. Entries have identifier/display_name; setters accept the JSON-encoded selected object. Verify supported Live version, channel ordering, same-output no-op and different-output change. Unexpected results stop further setup and do not save a member.
3. **Discovery before first external return:** output types may be readable on master_track when no returns exist; channels are read only from an external return/master. No temporary routing is performed for discovery. Verify empty set behavior; if channels cannot be read, configure an external return in Live before using Add. The lead explicitly removed create-to-discover fallback.
4. **Return sends:** mixer_device.getcount('sends') and per-parameter name/value/str_for_value are readable. Full count maps positionally; count-minus-one skips the effect's own slot. Verify the printed count/name diagnostic against the actual target channels before audio use. Unknown layouts fail closed. Confirm return send value is writable and observes external changes.
5. **Undo:** begin_undo_step/end_undo_step on live_set may be unsupported. Verify one undo step when supported and graceful fallback otherwise. No return is deleted automatically, including on failure.
6. **Audio/performance:** adding while playing must not stutter; effect → player sends must change only that player's external output, with house sound unaffected. Verify enabled sends, real interface routing, twelve-return behavior and the actual send taper/labels. Disabled sends remain the user's Live setting; no detection or note was added.
7. **Prior physical gates:** Windows jweb remains admin; phone identity persists across browser restart; real phone relative drag/scroll/lock and reconnect keep the intended mix. Local fixture tests do not prove those.

## Open questions
None blocking local implementation. Cross-family review and user Live checks are the lead's next steps.

## Return
- **Outcome:** done (local implementation); Live-only acceptance pending as above.
- **Verification:** 214/214 tests, deterministic build, scope audit and browser checks passed.
- **Out-of-scope issues found:** existing Node 16 test-runner limitations; no unrelated fixes.
- **Follow-ups:** cross-family PR review; run the complete Live-only checklist before live use.
- **For GBrain (lead to promote):** result Dict lifetime needs explicit retention until Node reads; effect send mappings must be proved by return-send count and rejected when unknown; fixture setup should not save personal config. Promote only after review/merge with the final PR link.


## Review round 2 — 2026-11-02

Addressed every blocking, should-fix and low-severity finding in the review of 792e856. **Skipped: none.** No scope expansion or new dependencies.

1. **Prefix retry/link:** Max, server and browser use the same trimmed exact-first lookup, followed by leading `^[A-L][- ]` normalization; ambiguous matches fail closed. Prefix-plus-routing-failure retries retain one return; successful repeat Add links. Normalized Main matches are refused. Permissions retain the actual Live name.
2. **Intent and stale routing:** output starts blank even for an existing match. Existing routing is shown as text and preserved unless the admin changes the output select. Requests carry `explicitOutput`, `reroute`, and `expectedRouting:{index,name,typeId,channelId}`. The server obtains a fresh output snapshot and returns 409 for stale reroutes, then Max rechecks the observed route immediately before writing. A return appearing after the form opened links without rerouting. Missing/invalid observed identifiers fail closed; zero identifiers are valid.
3. **Explicit new output / Main:** server and Max refuse new-return creation without explicit, nonempty output IDs. Main’s readable output is labelled in the channel list. If Main’s channel is not offered for returns it is a disabled informational entry, never a selectable default. No channel is selected automatically. The prior create-to-discover fallback is removed by the lead’s decision; configure an external return in Live when discovery cannot offer channels.
4. **Effect mapping proof:** count-derived layouts now check identifiable send letters or full return names. Contradictory layouts expose no rows. Every effect logs count, names and layout (`all`, `skip-own`, `unknown`, `contradictory` or `unavailable`), making the Live-only verification actionable. New tests cover count-valid contradictions and player-to-Main changes at the final boundary.
5. **Identifier zero:** removed truthiness rejection; harness covers zero for creation and explicit reroute.
6. **Created but unconfirmed:** a separate flag immediately after the create call reports the retained return if subsequent structural proof fails; no name/routing writes follow that failure.
7. **Unknown transport:** treated as playing and requires explicit confirmation before output discovery or set changes.
8. **Admin errors:** use error.message and strip terminal punctuation before appending the recovery message, avoiding Error prefixes and doubled periods.
9. **Player routing regression:** effect-send tests now move the target player to Main and prove the write is refused.

Verification: **214 tests passed**, zero failed on Node 22.22.1; ES5 guards and <=150-operation budget tests pass. Rebuilt device artifacts are byte-identical; `git diff --check` passes. The request timeout/removal race now also covers the fresh output preflight. The fake bridge uses the same lookup and respects keep-route intent.

Headless Chromium against the memory-only dev fixture at **1280×800** and **390×844** verified: blank output causes zero add requests; explicit 3/4 selection creates; output resets blank after success; link sends explicitOutput:false / reroute:false; ` Shaun ` matches the existing return; a separate admin route change makes the stale form receive 409. Main is labelled, controls are >=44 px high, no horizontal overflow or page errors. The disabled informational Main entry is also unit tested. Browser and fixture process were closed after verification.

Live-only gates above remain unchanged in status: APIs, physical audio isolation, undo, performance and Windows/phone behavior have not been verified in Ableton. No GBrain project page was used or written; the lead owns writeback after review/merge.
