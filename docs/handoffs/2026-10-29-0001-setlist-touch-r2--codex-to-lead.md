# Handoff: 0001 — Setlist Touch review fixes r2 (codex → lead)

- **Date:** 2026-10-29
- **Type:** return
- **Ledger:** 0001
- **Spec:** [Setlist Touch design](../superpowers/specs/2026-10-29-setlist-touch-design.md)
- **Plan:** [Phase 1 implementation](../superpowers/plans/2026-10-29-setlist-touch.md)
- **Branch:** local `feat/setlist-touch-r2`; push destination `origin/feat/setlist-touch`
- **Worktree:** `/home/shaun/.t3/worktrees/m4l-control/t3-f6cd9154`
- **PR:** https://github.com/pepperhorn/m4l-control/pull/1
- **Base commit:** `c1267f09e7240c9285e6911e2e5a56986e2550ea`
- **Port:** ephemeral port for fixture checks; no server left running
- **Status:** closed (implementation returned; independent review pending)

## Goal

Resolve every finding in [review 5685971687](https://github.com/pepperhorn/m4l-control/pull/1#pullrequestreview-5685971687), preserving phase 1 touch safety, independent browsing, Node 16 support, zero runtime dependencies and ES5 Max scripts. Update the existing PR without opening a new PR, merging or touching main.

## Context you need

The user supplied explicit fix directions for findings 1–5, required MIDI/warped-only beat timing and supplied the reference AMXD header bytes. This feature branch predates the orchestration files: AGENTS.md was read before switching, and the ledger/index/template were read with `git show origin/main:<path>`. No dispatch handoff exists for ledger item 0001. The branch setup and destination follow the user's explicit brief rather than the newer generic orch naming convention.

## Scope

- **In:** all nine findings, focused regression coverage, regenerated device artifacts, README corrections and this return document.
- **Out:** phase 2, deployment, merging, Windows/Ableton verification, real set performance measurement.
- **Files owned/changed:** `setlist-touch/README.md`; `device/{build_device.py,SetlistTouch.maxpat,SetlistTouch.amxd,lom.js,setlist-server.js,touch-window.js}`; `device/lib/{app.js,auth.js}`; `device/web/js/{app.js,render.js,view-state.js}`; `scripts/browser-check.cjs`; `test/{app.test.js,auth.test.js,device.test.js,lom.test.js,view-state.test.mjs}`; this document.
- **Do not touch:** main, ledger, other handoffs, specs/plans, unrelated project files or saved user configuration.

## Acceptance criteria

- [x] Space never acts on the page; Space/Enter cannot fire scenes; rows leave focus after a tap and are excluded from tab navigation.
- [x] Node withholds `set` until Live supplies scenes. Empty client snapshots keep the prior song visible and launching disabled; real snapshots reconcile to that song.
- [x] Node sends `fire <index> <name>`; LiveAPI rereads the exact name at fire time, rejects stale/missing names and logs a rejection.
- [x] Identical content skips Max dict writes, scenes messages, Node set broadcasts and client DOM replacement/gesture cancellation. The 5s loop poll remains and uses cached scene metadata.
- [x] Auth bypass/settings access require both a loopback peer and an exact localhost/127.0.0.1/[::1] Host hostname.
- [x] Config GET/POST responses contain `hasPassword`, never the password; blank password submissions preserve the existing value.
- [x] Unwarped audio has unknown beat timing and no bar lines/progress; MIDI and warped audio retain timing.
- [x] Resize polling stops while the window is closed, resumes on Open and only writes changed dimensions.
- [x] The builder documents the reference AMXD format; tests assert exact header bytes, chunk length, JSON and LF/NUL terminator.
- [x] Position updates no longer measure row layout on every event.
- [x] Required tests/build pass, with runtime compatibility checks and fixture browser regression checks.

## Verify with

```bash
cd setlist-touch
python3 device/build_device.py
npm test
# Optional fixture browser check using the already installed external tools:
PLAYWRIGHT_MODULE=/tmp/setlist-touch-checks/node_modules/playwright \
CHROMIUM_PATH=/home/shaun/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome \
node scripts/browser-check.cjs
```

ES5 parsing used external `/tmp/setlist-touch-checks/node_modules/acorn` with `ecmaVersion:5` for both Max scripts. Node 16.20.2 from `/home/shaun/.npm/_npx/f0bb8567a63c9b80/node_modules/node/bin/node` parsed all server runtime sources and passed an HTTP/auth/config/SSE smoke using synthetic credentials. No dependencies were added to the device.

## Known gotchas / decisions already made

- GBrain was available and searched for `m4l-control setlist-touch`; no relevant page was returned or used. No implementer writeback was made.
- Empty snapshots are ignored for client content and freshness; prior rows stay visible but disabled until a nonempty set/play snapshot arrives. The reducer also independently retains songKey/order/filter on an empty set.
- Explicit Max `refresh` still resends a snapshot, even when content is unchanged, because a restarted Node process needs its first snapshot. The unchanged 5s poll does not resend it.
- A final LiveAPI stale-name rejection is a no-op with a Max console log, per the lead's direction; the existing HTTP 409 behavior handles stale requests already detectable in Node. A 204 from Node acknowledges dispatch, not actual firing in Live.
- Exact name comparison is the authorized stale guard; it does not distinguish different scenes with identical names.
- Settings no longer return saved passwords. To intentionally clear one, edit the local config file and reload; the form's blank field means unchanged.
- Window Open now sends `showwindow` through the control inlet to the helper. The helper makes the window visible and starts polling; a visibility check cancels polling after closure. Uses the documented [Max Wind visible/size API](https://docs.cycling74.com/apiref/js/wind/).
- README explains that a local proxy rewriting Host to localhost can bypass device auth and must supply its own auth/settings restrictions.
- AMXD bytes already matched the user-supplied reference. This round adds evidence/commentary and regenerates the patch for window wiring; it does not establish that Ableton loads the device.

## Open questions

None blocking this fix round. Independent review and the existing Windows/real-Live acceptance checklists remain pending.

---
## Receiver ack

Lead should acknowledge this return through the main ledger; no implementer dispatch acknowledgement was applicable because the brief was delivered directly and the ledger has no dispatch handoff.

---
## Return (implementer → lead)

- **Outcome:** done
- **PR:** https://github.com/pepperhorn/m4l-control/pull/1
- **Commits:** review base `c1267f0` through the commit containing this return document; final SHA is recorded in the PR comment and implementation response.
- **What changed:** findings 1–9 addressed as enumerated above. All implementation changes are within Setlist Touch, plus this owned handoff.
- **Verification output:**

```text
npm test (Node 25.9.0):
tests 49
pass 49
fail 0
cancelled 0
skipped 0

python3 device/build_device.py:
wrote SetlistTouch.maxpat, SetlistTouch.amxd
Deterministic device rebuild: PASS
lom.js: ES5 PASS
touch-window.js: ES5 PASS
Zero npm runtime dependencies: PASS
v16.20.2: runtime syntax, HTTP/auth/config and SSE smoke PASS

Fixture Chromium integration:
result PASS; RISE rows 11; desktop clientHeight/scrollHeight 673/673
keyboard/drag/multitouch/locked launches 0; clean tap launches 2
identicalSetKeepsGesture true; stale409 true
reconnectKeepsBrowsedSong true; emptySetKeepsBrowsedSong true
settings/touchDiagnostic true; phoneOverflow false; pageErrors []
```

- **Decisions made:** listed under Known gotchas. No new ADR proposed.
- **Out-of-scope issues found:** none requiring expansion of this fix round. Test harness adjustments accounted for retained sidebar preferences and the phone sidebar overlay; product behavior was not changed for these.
- **Follow-ups:** independent exact-head review, then existing plan Task 4/7 Windows/real-Live checks, including jweb touch/multitouch, Open/resize/reopen, Max atom preservation of exact names (including blank names), MIDI Effect loading, real clip follow actions, phone auth and full-set performance.
- **For GBrain (lead to promote):** retain exact-name validation at the final LiveAPI boundary; a Node snapshot alone cannot prevent a launch into an index changed by a recent structural edit. Suppress identical snapshots at every layer to preserve active touch gestures.
