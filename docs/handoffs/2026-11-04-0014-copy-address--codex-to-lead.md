# Handoff: 0014 — Copy device address (codex → lead)

- **Date:** 2026-11-04
- **Type:** return
- **Ledger:** 0014 · **Spec / plan:** [0014-copy-address](../specs/0014-copy-address.md) (single task)
- **Dispatch:** [lead-to-codex](2026-11-04-0014-copy-address--lead-to-codex.md)
- **Branch:** orch/0014-copy-address
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-ff47b6b8
- **Base commit:** b01210305b7d9d2e0d20d1000190c4a6c2663f9c (dispatch HEAD afff9f0)
- **Port:** 5340 (no server started)
- **PR:** https://github.com/pepperhorn/ableton-control/pull/11 (draft against main)
- **Status:** closed

## Goal
Click the device panel address to copy only the ready phone URL, with temporary confirmation and reliable restoration of current panel status. Implementation is complete; Windows/Ableton acceptance remains with the lead/user.

## Context you need
The linked spec is the plan and acceptance source. The dispatch acknowledgement was committed first as 0d01d65. Read the implementation commit immediately following it and this return before reviewing.

## Scope
- **In / files owned:** device/build_device.py, regenerated SetlistTouch.maxpat and .amxd, device/setlist-server.js, new device/lib/clipboard.js, README.md and tests under setlist-touch; own 0014 handoffs.
- **Out:** web copy buttons, address selection/listing, unrelated runtime behavior.
- **Do not touch:** ledger, other docs, root device/, lom.js, mix.js, players.js, lib/app.js. None changed. No GBrain writes.

## Acceptance criteria
- [x] Address output goes exclusively through `t b` → `copyAddress` → Node. Message text cannot reach route/LOM.
- [x] Only the separately retained ready phone URL is copied, excluding the port note and newline.
- [x] No copy or panel change before listen success or following startup failure.
- [x] Two-second success/failure feedback restores the latest normal status, including indexing updates/completion and port changes.
- [x] Copy failure displays the URL and logs its cause to the Max console.
- [x] Injected subprocess tests verify clip.exe / pbcopy, argument array, shell:false, UTF-8 stdin and failure handling. Built-ins only; no new ES5 Max scripts or Node >16 runtime APIs.
- [x] Full tests pass; rebuilt artifacts are deterministic.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
python3 device/build_device.py && git status --short
```

## Known gotchas / decisions made
- GBrain searched for `m4l-control setlist-touch`: no relevant project pages returned; none used. No writes.
- Panel updates store their latest selector/arguments while feedback is visible. Restoration replays the latest update, preserving existing progress patch wiring.
- URL is separate from displayed text; neither progress, port notes nor clipboard feedback can enter the copied text.
- Subprocess success requires close code 0. Errors on spawn/stdin, nonzero exit/signals and a five-second timeout reject; timed-out processes are killed. No shell or npm dependency.
- Unsupported platforms show the prescribed failure rather than introducing extra clipboard dependencies.
- Repeated clicks supersede older async feedback and reset its timer. Results for a changed URL are ignored by the panel.
- Existing VM-based device/mix tests now resolve the clipboard helper from the device directory.
- No ADR proposed.

## Open questions
None.

## Return
- **Outcome:** done
- **Commits:** acknowledgement 0d01d65, implementation 25ef372, then this return and its PR-link update.
- **What changed:** click wiring, clipboard helper, readiness/status feedback, README line, nine focused regression tests and existing VM loader adjustments.
- **Verification output:**
```text
1..307
# tests 307
# suites 0
# pass 307
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12280.583905

wrote SetlistTouch.maxpat, SetlistTouch.amxd

deterministic build: both generated files byte-identical
```
`git diff --check` passed. Only owned files changed. Tests ran on Node 22; Node 16 compatibility was checked by API/syntax inspection, not a Node 16 execution. Initial test failures from missing VM helper resolution and two new test assertions were corrected before the passing full run.
- **Out-of-scope issues found:** none.
- **Follow-ups / Windows checks:** copy the entire device folder, load in Ableton, click and paste into a browser; confirm exact URL without port note or trailing newline. Confirm “Copied” lasts about two seconds, normal text/port note returns, and indexing started during feedback restores current progress. Check repeated clicks and clicks before readiness/after startup failure. Verify no unexpected console errors. If feasible, deny/unavailable clip.exe to confirm failure message and console error. macOS pbcopy was covered by injection only and needs a real Mac check if used.
- **For GBrain (lead to promote):** clipboard URL is separate from panel status; status updates must continue to be recorded while temporary feedback is visible. Physical clipboard and Max interaction are not established by VM/subprocess mocks.
