# Handoff: 0003 — Transport header (codex → lead)

- **Date:** 2026-10-29
- **Type:** return
- **Ledger:** 0003 · **Spec:** [0003](../specs/0003-transport-header.md) · **Plan:** [dispatch handoff](2026-10-29-0003-transport-header--lead-to-codex.md)
- **Branch:** `orch/0003-transport-header`
- **Worktree:** `/home/shaun/.t3/worktrees/m4l-control/t3-79b65641`
- **PR:** https://github.com/pepperhorn/ableton-control/pull/3 (draft)
- **Base commit:** `303ad27` (`origin/main` at dispatch)
- **Implementation commit:** `80ecb7c`
- **Receiver acknowledgement commit:** `db8e55c`
- **Port:** 5230
- **Status:** closed (implementation done; awaiting lead review)

## Goal
Provide the opt-in `?transport=1` row on Scenes and My mix: clean-tap Play, cancellable one-second Stop and Arrangement Record holds, and observed playing/recording/tempo/bar.beat state. Deliver a tested branch and draft PR for review, with actual Live acceptance left to the user.

## Context you need
- [Approved spec](../specs/0003-transport-header.md)
- [Dispatch, file ownership, plan and receiver acknowledgement](2026-10-29-0003-transport-header--lead-to-codex.md)
- [Setlist Touch design](../superpowers/specs/2026-10-29-setlist-touch-design.md)
- [In-ear mix design](../superpowers/specs/2026-10-29-in-ear-mix-design.md)
- API reference checked: https://docs.cycling74.com/apiref/lom/song/

## Scope
- **In:** the complete single-task dispatch plan: LiveAPI transport lane, authenticated/validated POST, SSE snapshots and 10 Hz updates, fixture simulation, device wiring, opt-in shared UI, pure hold/position tests, HTTP and device tests, browser checks, short README Transport section.
- **Out:** tempo editing, metronome, loop/punch, Session record, overdub, stop-all-clips, deployment and actual Live/Windows acceptance.
- **Files owned/changed:** `setlist-touch/device/transport.js`, `device/lib/transport.js`, `device/lib/app.js`, `device/lib/fake-bridge.js`, `device/dev.js`, `device/setlist-server.js`, `device/build_device.py`, generated `device/SetlistTouch.amxd` and `.maxpat`, `device/web/index.html`, `device/web/style.css`, `device/web/js/app.js`, `device/web/js/hold.js`, `device/web/js/transport-render.js`, `test/app.test.js`, `test/device.test.js`, new `test/hold.test.mjs`, `test/transport.test.js`, `test/transport-render.test.mjs`, and `setlist-touch/README.md`; all abbreviated paths after the first are under `setlist-touch/`. Also the acknowledgement section of the dispatch handoff and this return handoff.
- **Do not touch:** `lom.js`, `mix.js`, other existing web modules/tests, root `device/`, root README, ledger or other docs. None changed.

## Acceptance criteria
- [x] Opt-in transport on both pages; no Stop or Rec command from a single tap.
- [x] One-second visible hold; early release, leaving/reentering, second pointer, lock and connection loss cancel.
- [x] Explicit recording targets on the HTTP and deferred Max paths, including changes made by another screen during a hold.
- [x] Fresh snapshot plus existing `canLaunch(state)` required; lock disables all three.
- [x] Full test suite passes, including all existing tests; zero new runtime dependencies. LiveAPI script uses ES5 syntax. Tests ran on Node v25.9.0; Node 16 itself was not executed.
- [x] Device build succeeds deterministically.
- [x] Browser check results recorded below and in the draft PR body.

## Verify with
```bash
cd setlist-touch
npm test
python3 device/build_device.py
SETLIST_TOUCH_PORT=5230 node device/dev.js
# Browser: http://localhost:5230/ and http://localhost:5230/?transport=1
# Viewports: 390x844 and 1280x800
```

## Known gotchas / decisions already made
- GBrain was searched for `m4l-control` and returned no relevant project page. No GBrain content was relied on; write-back belongs to the lead.
- Recording means Arrangement `record_mode`, never Session record.
- The existing `route fire address url ready send` object is preserved. Its unmatched outlet feeds a new `route transport`, then `deferlow`, then `js transport.js`. This preserves all existing selectors and the existing mix wiring test without editing the unowned `test/mix.test.js`.
- Wire shape is `POST /api/transport {command:'play'|'stop'|'record', value?:0|1}`. Only record accepts/requires `value`. Invalid payloads return 400; valid requests call the bridge and return 204. Existing route-wide auth and origin checks apply.
- Transport snapshots retain Live property names plus the server-formatted `position`. Position uses quarter-note time and denominator beat units, so 6/8 has six eighth-note beats per bar. Live and server output are each limited to 10 Hz; hold-fill animation uses animation frames.
- Rec captures its intended target on pointerdown and carries that target through completion. Another screen changing recording mid-hold cannot turn that hold into the opposite action.
- HTTP completion does not optimistically change displayed state; observed SSE state drives indicators. Transport snapshot is cleared on SSE open/error, so old state cannot enable the controls during reconnect.
- A completed hold fires before release and cannot fire again on release. Browser-native/keyboard clicks do not control transport; Space suppression and settings-input spaces retain existing behaviour.
- A settings port redirect preserves the per-screen query string.

## Open questions
None.

---
## Receiver ack
Lead to acknowledge through the ledger after reviewing this branch and its draft PR.

---
## Return (implementer → lead)
- **Outcome:** done
- **PR:** https://github.com/pepperhorn/ableton-control/pull/3 (draft)
- **What changed:** independent observer-driven transport lane and deterministic patch wiring; validated HTTP/SSE and fake transport; opt-in touch controls, progress fills, disabled-state handling and Live readouts; tests and documentation.
- **Verification output:**

```text
$ cd setlist-touch && npm test
ℹ tests 95
ℹ suites 0
ℹ pass 95
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1552.469605

$ python3 device/build_device.py
wrote SetlistTouch.maxpat, SetlistTouch.amxd

$ git diff --check
(no output)
```

The device test rebuilds and byte-compares both generated artifacts. Unit tests also exercise observer teardown, 100 ms coalescing, explicit repeated Rec writes, bridge forwarding, auth/origin/Host checks, reconnect snapshots and cancellation before a fresh snapshot.

### Browser results
Used T3 shared-browser automation against `dev.js` on port 5230. At **each** of 1280×800 and 390×844, 24 assertions passed using timed pointer events and actual animation frames/HTTP/SSE:
- fresh snapshots enable controls; tempo has two decimals and position is bar.beat;
- no horizontal overflow;
- Play taps post play; Stop/Rec taps post nothing;
- fill advances without early fire; Stop fires after one second while still pressed, exactly once;
- Stop and Play state is observed and rendered;
- both recording directions require holds and send explicit 0/1 targets; recording styling follows observed state;
- leaving/reentering and a second pointer outside the row cancel;
- locking during a hold cancels, all three buttons disable and locked gestures post nothing;
- native/programmatic click handlers and keyboard events cannot bypass gesture handling;
- transport remains visible and Play operates on My mix.

At both viewports, the address **without** `?transport=1` had the transport row hidden with zero layout height. A separate native browser click on each transport button produced **only** `{command:'play'}`. The longer hold/cancellation scenarios used synthetic touch PointerEvents in the real browser, not a physical touchscreen.

- **Decisions made:** listed above; no new ADR proposed.
- **Out-of-scope issues found:** none requiring scope expansion.
- **Follow-ups:** lead to arrange independent Claude-family review and update the ledger. User to verify in Live 12/Windows: actual Song observers and direct Live changes reach all screens; start/stop act on the running set; Arrangement Record toggles correctly in both directions and remains idempotent on duplicate target writes; tempo/signature/position agree with Live; Node-ready/load refresh works in the built device; Windows jweb and phone touch handle a one-second hold, leaving, multiple fingers, lock and reconnect correctly. Existing phone auth/firewall acceptance remains separate.
- **For GBrain (lead to promote):** transport opt-in is per URL; Arrangement Record uses target-state writes; the unmatched Max route outlet extends command routing without changing existing lane selectors. Link this handoff, spec and PR when recording the merged outcome.
