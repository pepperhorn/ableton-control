# Handoff: 0002 — In-ear mix pages (codex → lead)

- **Date:** 2026-10-29
- **Type:** return
- **Ledger:** 0002 · **Spec:** [in-ear mix design](../superpowers/specs/2026-10-29-in-ear-mix-design.md) · **Plan:** [0002](../plans/0002-in-ear-mix.md), T1 → T2 → T3
- **Dispatch:** [lead-to-codex](2026-10-29-0002-in-ear-mix--lead-to-codex.md)
- **Branch:** `orch/0002-in-ear-mix`
- **Worktree:** `/home/shaun/.t3/worktrees/m4l-control/t3-1fa7b284`
- **PR:** https://github.com/pepperhorn/ableton-control/pull/2 (draft; head `orch/0002-in-ear-mix`, base `main`).
- **Base commit:** `cf7d724e9d49e5b296d6dd5ef8ac2eb40922b474` (main after phase 1 merge and dispatch docs)
- **Initial implementation commit:** `910fabbf10dfb162a70e5ea2903b22be227d6512`
- **Review-fix code commit:** `44a743639b653b48d26f2c0852a69f1f8af00099` (response to review 5686435613 on `75d511e`)
- **Receiver acknowledgement commit:** `eb364b2`
- **Port:** 5220, `SETLIST_TOUCH_PORT=5220 node device/dev.js`
- **Status:** closed (review fixes complete; cross-family re-review and real Live verification remain with lead/user)

## Goal
Add player mix pages to Setlist Touch: each externally routed return has a tab, each literal `+ ` track/group has a coloured relative fader, and levels stay synchronized across screens. Local lock, horizontal-only single-pointer gestures and validated sends protect against accidental changes.

## Context you need
Read the linked spec, plan and dispatch. The phase 1 scene code remains the source of scene behavior. This branch implements the parallel mix lane in the same device/server, without npm runtime dependencies. No review was delegated from this implementer worktree.

## Scope
- **In:** all of plan T1–T3; settings Space typing and connected-empty-set status follow-ups.
- **Out:** mute/solo/pan, presets, permissions, metering, automation, phase 1 scene behavior changes and the extra position-update reads in `lom.js`.
- **Files owned/changed:** exactly the plan's T1–T3 Owns lists, plus this return handoff and the dispatch Receiver ack. `view-state.js` changes prefs only. Device binaries/patch were regenerated from the owned builder.
- **Do not touch:** `lom.js`, phase 1 parse/progress/auth/config, root `device/`, root README, the ledger, other docs.

## Acceptance criteria
- [x] T1 parser/server/fake bridge lane: strict prefix and routing filters, full mix SSE on connect, cached level updates, validated POST, latest-value coalescing and stale queued-target cancellation.
- [x] T2 ES5 observer-driven LiveAPI lane and regenerated Max wiring; sends run through `deferlow`.
- [x] T3 Scenes/My mix switch, named player tabs, local preferences, fader bars, live sync and shared local lock.
- [x] Tap, native vertical scroll and multi-touch produce no send commands; horizontal motion is relative; final release value is sent.
- [x] Remote values remain underneath an active local drag; the committed release stays visible until the next level event for that fader or a 1 s timeout, then the current server value appears. 409 restores server snapshot and flashes the row.
- [x] All 80 tests pass after review fixes, including phase 1; build, JSON and ES5 syntax checks pass.
- [x] Poppins and contextual class names; 390×844 phone and 1280×800 laptop screenshots captured and described below.
- [ ] User's real Live 12/Windows device, routing, labels and touch checks (not available in this environment).

## Verify with
```bash
cd setlist-touch
npm test
python3 device/build_device.py
python3 -c "import json;json.load(open('device/SetlistTouch.maxpat'))"
# External development tooling already present locally; no runtime dependency added:
node /tmp/setlist-touch-checks/node_modules/acorn/bin/acorn --ecma5 device/mix.js > /tmp/0002-mix-es5-ast.json
PLAYWRIGHT_MODULE=/tmp/setlist-touch-checks/node_modules/playwright node scripts/browser-check.cjs
SETLIST_TOUCH_PORT=5220 node device/dev.js
# Against that dev server, in another shell from the repo root:
node /tmp/0002-browser-check.cjs
node /tmp/0002-touch-sync.cjs
```

## Initial implementation verification output

This section records the original pre-review evidence. Current review-fix evidence is in the next section.
Test runtime: Node `v25.9.0`. Node 16 compatibility was checked with an ES2021 syntax parse of every new/modified server runtime module; an actual Node 16 runtime was not used.

```text
ℹ tests 71
ℹ suites 0
ℹ pass 71
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
wrote SetlistTouch.maxpat, SetlistTouch.amxd
maxpat JSON: PASS
mix.js ES5 and Node 16 runtime syntax: PASS
Owned-file scope: PASS (23 files before this return)
```

The existing phase 1 browser check passed: 11 RISE rows fit at laptop size, zero drag/multi-touch/lock/keyboard launches, two clean tap launches, stale-409 handling, settings, touch diagnostic, reconnect/empty-set browsing preservation and no phone overflow or page errors.

The new headless phone/laptop check passed: Shaun/Keith/Sam tabs only, ten mix rows, zero tap/native-vertical-scroll/locked/multi-touch sends, relative horizontal drag with throttled requests and final value, remote level hidden until release, 409 row flash/restoration, restored page/tab, literal spaces in settings, neutral connected-empty-set message, no horizontal overflow or page errors. The last run recorded 7 requests over a 192 ms horizontal drag including its final release. The dev log confirms coalesced `setSend` calls.

A separate native-touch CDP check passed: horizontal touch drag sent 6 requests, final value `0.5666666666666667` from `0.4 + 60/360`, both independent browser contexts converged to the same level over real SSE, and lock/tab selection remained independent.

Local artifacts (development fixture evidence, not Live evidence):
- `/tmp/0002-in-ear-mix/phone-390x844.png`: compact Scenes/My mix header, lock/settings, Shaun/Keith/Sam pills, coloured bar rows with names left and dB badges right; vertical list scroll exposes the final CUE GROUP row.
- `/tmp/0002-in-ear-mix/laptop-1280x800.png`: centered wider mix panel, same pills and colour fills, shared header controls; rows scroll vertically when necessary.
- `/tmp/0002-tests.log`, `/tmp/0002-browser-results.json`, `/tmp/0002-touch-sync-results.json`, `/tmp/0002-dev.log`.
- Browser scripts and screenshots live outside Git because they are not in the owned source list; screenshot descriptions are included in the PR.

## Review fixes — 2026-10-29

Addressed [review 5686435613](https://github.com/pepperhorn/ableton-control/pull/2#pullrequestreview-5686435613) of head `75d511e3e7cfa58ea434c1cab045606514e3fe69`, in the same worktree/branch. The user explicitly authorized these six fixes and retaining the approximate text/threshold. No other scope was added.

1. **Routing blocker (review #1):** accept both unwrapped routing JSON and `{"output_routing_type":{"display_name":…}}`. When the inner key exists it is authoritative, including null/invalid inner values, which remain excluded. The harness now returns wrapped JSON as an array containing a JSON string, matching the requested LiveAPI.get shape. Tests cover wrapped Main/Master, external output, invalid inner values, unwrapped compatibility and a valid write with wrapped routing.
2. **Release snap-back (review #3):** retain each fader's locally committed release value until that fader receives a level event or 1 s expires. Other faders' events cannot clear it. A second drag starts from the displayed value. Cancellation, structural rebuild and send errors clear held values. Pure tests exercise same/other fader echoes, expiry, replaced timers and cancellation. A headless browser reproduced the old 81% → 64% release snap-back, then passed with the held release, echo restoration and timeout.
3. **Failed rebuild recovery (review #5):** schedule retries using the existing debounce, with 1, 2, 4 and then at most 8 s delays; reset to 1 s after a successful rebuild. Stale controls stay unavailable during failure. Partial observers/cached APIs are released; retry cancellation on deletion is covered. Tests inject repeated metadata failures and a failed observer subscription, verify the cap/reset, and recover without another Live edit.
4. **Send auth regression coverage (review #6):** non-loopback without credentials returns 401 with a challenge; no configured password returns 403; an untrusted Host on loopback returns 401 with a challenge; authenticated cross-origin sends return 403. Every rejected case asserts no setSend call, and the authorized positive control still sends once. Auth runtime code is unchanged.
5. **Space target safety (review #7):** check `e.target instanceof Element` before calling `closest`. The focused browser check reproduced the original document-target error, then verified a document-target Space event is prevented without an exception and literal spaces still type in settings inputs.
6. **LiveAPI writes (review #4):** reuse the current generation's track-name observer, return-name observer and send-value observer for writes. Writes allocate no new LiveAPI objects; the root structure, names and routing are still reread at the final boundary. Rebuild, failed rebuild and deletion release the cache through the observer registry. A failed subscription releases its object immediately; property clearing and id-zero release are attempted separately. Tests verify 20 writes allocate zero objects, use the observed send API, and release old generations on rebind/deletion.

**Explicitly unchanged:** approximate `≈` dB text during drag (review #2) and the 8 px gesture threshold (review #8). The user will assess these on stage. The hold also retains the existing local value label until an echo/timeout; no new taper calculation was introduced.

Current verification on the review-fix code:

```text
cd setlist-touch && npm test
ℹ tests 80
ℹ suites 0
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
python3 device/build_device.py
wrote SetlistTouch.maxpat, SetlistTouch.amxd
maxpat JSON: PASS
acorn --ecma5 device/mix.js: PASS
git diff --check: PASS
```

The generated Max patch/container have no changes after regeneration. The existing phase 1 headless regression suite also passed again: no drag/multi-touch/locked/keyboard launches, two clean taps, stale handling, settings, reconnect and empty-set browsing preservation, with no page errors. The focused review browser check passed release retention, same-fader echo, unrelated-fader isolation, one-second timeout, document-target Space and settings Space typing, with no page errors.

Local review artifacts: `/tmp/0002-review-tests.log`, `/tmp/0002-review-browser-results.json`, `/tmp/0002-review-mix-es5-ast.json`; focused browser command from repo root: `node /tmp/0002-review-browser.cjs` (self-starts and closes fixture server on 5220). These remain fixture/harness evidence. Actual Live 12/Windows routing, send labels/taper, latency and jweb touch still need the user's verification. Cross-family re-review remains with the lead; implementer did not self-review or merge.

## Known gotchas / decisions already made
- GBrain was searched for `m4l-control`; no relevant project pages returned. No GBrain writes: implementer records notes here for the lead.
- Literal plus-and-space opt-in is enforced in both Max and parser, including grouped children. `+Kick` and a plus followed by a tab are excluded, following the explicit spec/dispatch.
- Unknown/unparseable routing is excluded. Main/Master comparisons are case-insensitive. Track and return metadata observers rebuild after 200 ms; value observers batch at 33 ms, without polling.
- Official API references consulted: [Track routing dictionaries](https://docs.cycling74.com/apiref/lom/track/), [DeviceParameter.str_for_value](https://docs.cycling74.com/apiref/lom/deviceparameter/). These support the API choices; they do not verify the user's Live installation.

## Open questions
None blocking review. The manual Live checks below remain required before claiming device readiness.

---
## Receiver ack
Lead acknowledges this return through the ledger; reviewer acknowledgement belongs in the PR review comment.

---
## Return (implementer → lead)
- **Outcome:** done within the implementation scope; ready for independent review.
- **PR:** https://github.com/pepperhorn/ableton-control/pull/2 (draft).
- **Commits:** `eb364b2` acknowledgement, `910fabb` implementation, `44a7436` review fixes, then return-document commits.
- **What changed:** complete mix snapshot/level/send pipeline; fixture/dev support; ES5 observer module and deferred device wiring; safe fader UI and preferences; assigned Space/status fixes.
- **Decisions made:**
  - POST body uses `trackIndex`, `returnIndex`, `rawName`, `returnName`, `value`. A 409 returns `{mix}` so clients can restore authoritative rows immediately.
  - Bridge's three-argument `setSend` interface is retained. Internally, Node attaches expected track/return names to the Max message; Max checks those against its snapshot and rereads Live names, structure and routing before writing. This protects delayed commands across observer rebuilds as well as the Node validation window.
  - Sends are serialized per fader on the client and coalesced per fader on the server. Local release always queues the final value and holds its display until an echo for the same fader or 1 s; lock, structural changes, scroll cancellation and connection loss discard unsent work.
  - Live's label is used whenever available. If `str_for_value` fails, or a local drag value has no Live label yet, the UI explicitly marks its computed dB approximation with `≈`. That fallback may differ from Live's send taper. The fake bridge's dB labels are simulated.
  - Mix readiness is tracked independently from scene readiness, so player mixes can work without encoded songs; both use the same connection bar and local lock. Connected empty scene sets retain the previous browsed song and display `Waiting for Live set…`.
- **Out-of-scope issues found:** extra LiveAPI reads per position update remain in `lom.js`, as directed by dispatch.
- **Follow-ups:** user in Live 12 on Windows must verify externally routed return tabs (including actual `output_routing_type` JSON/display names), actual `str_for_value` labels/taper, send knob → phone sync within about 0.2 s, phone drag → send knob, prefix add/remove/reorder observation, and touch in jweb. Existing phase 1 window/END-row checks remain the user's gate.
- **For GBrain (lead to promote):** accept wrapped/unwrapped routing JSON from LiveAPI.get; use bounded rebuild retries and generation-owned observed API caches; retain committed release feedback until echo/timeout. Original lessons: strict `+ ` opt-in, fail-closed unknown routing, deferred write commands carrying expected names, and fixture/headless proof versus real Live/Windows verification boundary. No ADR proposed.
