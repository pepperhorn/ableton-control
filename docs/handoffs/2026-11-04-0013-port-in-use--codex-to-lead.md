# Handoff: 0013 — Port fallback and Open button (codex → lead)

- **Date:** 2026-11-04
- **Type:** return
- **Ledger:** 0013 · **Spec/plan:** [0013-port-in-use.md](../specs/0013-port-in-use.md), single task
- **Dispatch:** [lead-to-codex](2026-11-04-0013-port-in-use--lead-to-codex.md)
- **Branch:** orch/0013-port-in-use
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-eede20bf
- **PR:** https://github.com/pepperhorn/ableton-control/pull/10 (draft)
- **Base commit:** aec16e0 (dispatch), ancestor 0cdf6087c6ce3d253868657206caf304f9065260
- **Scope extension:** read `origin/main:docs/specs/0013-port-in-use.md` at 6c63f86749cee61369dfff1df32b1bd23a498093 after fetching; the added Open requirements are included without editing the spec.
- **Port:** 5330 if running a preview; no preview server started
- **Status:** closed · **Outcome:** done (implementation; physical acceptance pending)

## Goal and result
Startup now tries up to 20 sequential ports, capped at 65535, and verifies that loopback actually reaches this app. It saves a successful fallback when safe and reports fallback/failure on the device panel and fallback on laptop Settings. Settings changes still require the exact requested port. Open now uses standard pcontrol opening before resizing and fronting the window.

## Scope and owned files
Changed only `setlist-touch/device/lib/app.js`, `setlist-server.js`, `build_device.py`, generated `SetlistTouch.maxpat`/`.amxd`, `touch-window.js` (lead extension), Settings files `device/web/index.html` and `device/web/js/app.js`, `setlist-touch/README.md`, tests `port.test.js`, `device.test.js`, `mix.test.js`, and the two 0013 handoffs. Existing config loading/warning behavior was reused without a config.js edit.

No ledger, GBrain, protected LOM/mix/player source, root device, or other docs edits. No merge, live writes, or firewall changes. Initial receiver ack was committed first as 1e43838; implementation and return handoff are committed as ae91410, followed by the PR-link documentation commit.

## Acceptance criteria and evidence
- Bind failure falls forward; actual HTTP listener and disk readback verify persistence.
- Shared nonce loopback check verifies exact response on IPv4 and IPv6, with a one-second absolute deadline per attempt and byte cap. Timeouts retry once; IPv6 refusal/unavailability is permitted, and foreign IPv6 answers are busy. A foreign HTTP 200 and a hanging server are rejected. Injected probe models the Windows shadowed-bind case for both startup and Settings, including release of the rejected listener. R2 also tests a real IPv6-only foreign listener (no skip on this machine), IPv6 refusal/unavailability, one timeout retry and no retry for wrong responses, plus actual bind-error handling through injected EACCES listen errors.
- Failure is bounded to 20 ports and capped at 65535, with the spec's full actionable panel text. Failure remains visible if indexing progress arrives later. Ready and jweb URL are emitted only after successful startup.
- Damaged and unreadable config tests verify no save call; damaged bytes remain intact. Write failure keeps the server running with a visible memory-only warning.
- Settings busy ports are refused without a fallback or save, preserving the old server/config. Existing occupied-bind settings test also passes.
- Panel has multiline space for fallback/address and failure; Settings reads the same `portNote` from the config API.
- Generated Open path: `live.text` → `t b b` → `open` → `pcontrol` → `p touch-window`; trigger's right outlet opens first, left sends `showwindow`. The helper calls `patcher.front()` and resets resize tracking. Wiring, reopen/front calls, ES5 syntax and deterministic generated artifacts are tested.
- README explains fallback, stable persisted port, memory-only cases, firewall prompt/rules and Windows port-owner commands.

## Verification
Run from the worktree:
```bash
export PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH
cd setlist-touch
npm test
python3 device/build_device.py
cd ..
git diff --check
git diff --stat origin/main...HEAD
```

Verification output (Node 22; built-in test runner):
```text
# tests 294
# suites 0
# pass 294
# fail 0
# cancelled 0
# skipped 0
# todo 0
wrote SetlistTouch.maxpat, SetlistTouch.amxd
```
The device test rebuilds and compares both artifacts byte for byte. `git diff --check` passed. Runtime code uses Node built-ins and Node 16-compatible APIs; Max helper remains ES5. Node 16 itself was not run. First full run found one stale Max bridge test mock; it was updated to the startup method and the full suite rerun.

## Decisions made
- Kept exact `listen()` for development/tests; added `listenWithFallback()` for device startup, sharing the same verified bind used by settings.
- Probe endpoint is random per app/process and only returns its nonce to real trusted loopback requests, before ordinary authentication so test-injected client identities cannot affect startup checks. It exposes no app data.
- Close/destroy rejected listeners and their sockets before trying another port. An already damaged/unreadable config is never automatically saved; normal startup on its original port performs no extra save. Explicit settings-save behavior remains as before.
- Only EADDRINUSE and failed nonce probes are busy. Other listen errors retain their actual message in Settings, and startup still tries subsequent ports while retaining those reasons in the success note or terminal error.
- Port notes last for the process lifetime, clearing on a successful explicit port change; a fresh clean startup has no fallback note.
- Open relies on pcontrol to open the subpatcher and `patcher.front()` to raise it, replacing the helper's direct `wind.visible` assignment.

## Windows / Live acceptance still required
1. Copy the entire rebuilt device folder into Live on Windows. Open must show the jweb window, resize correctly and bring it to the front on repeated presses, including after closing and reopening it.
2. Occupy the configured port, load the device and check the fallback text plus complete phone URL fit the panel. Confirm the embedded line break actually puts the URL on a separate line in Max. Confirm Open loads this app at `http://127.0.0.1:<port>/` on the displayed port and Settings shows the same note. Restart after freeing the old port and confirm the saved new port remains stable.
3. Where Windows permits a specific loopback listener alongside a wildcard bind, verify the foreign app is rejected and startup falls forward. Also occupy only `[::1]:<port>` and confirm startup falls forward while Open stays on 127.0.0.1. This environment tested a real IPv6-only listener and injected the IPv4 shadow case; neither establishes physical Windows behavior.
4. Exercise Settings against that shadowed port: clear busy error, no fallback, old URL still works. Occupy all candidates and check the panel failure text is legible and remains visible during indexing. Confirm `"port"` renders with plain double quotes, without visible backslashes. Test a permission-denied startup/settings bind and confirm its actual reason is shown instead of busy wording.
5. Test damaged/unreadable and unwritable config cases on a disposable copy. Confirm memory-only wording, no automatic damaged-file replacement and working Open URL.
6. Check Max's actual node.exe allow/block rule, intended-network firewall access, phone authentication and LAN/Tailscale reachability. Existing rules can suppress the first-listen prompt.

## Open questions / out-of-scope issues
None found beyond the physical checks above. No review has been requested by this implementer.

## Follow-ups / for GBrain (lead to promote)
GBrain was searched for `m4l-control port`; no relevant guidance returned and no pages were used. No GBrain writes were made. Useful lesson: Windows wildcard bind success needs a nonce-backed loopback check, and a mode-0 live.text button should not depend on `sel 1` for opening a subpatcher.

## R2 response to Opus review
Read the review on PR #10 at e49f045 and applied all four lead decisions. The nonce probe now checks `127.0.0.1` and `::1`; IPv6 refuses/unavailable is accepted, but a foreign response is not. Each timed-out address gets exactly one retry; wrong responses fail immediately. jweb's URL outlet and all README local URL examples use 127.0.0.1, and the existing Settings Host acceptance is verified. EACCES and other non-busy listen messages are preserved in Settings and startup reporting, while startup continues through the bounded port range. Panel line breaks and plain double quotes remain intact, with explicit Windows checks above. No additional scope changes or GBrain/ledger writes.
