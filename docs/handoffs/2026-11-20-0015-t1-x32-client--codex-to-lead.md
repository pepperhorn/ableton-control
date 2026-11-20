# Handoff: 0015-t1 — X32 OSC client and fake desk (codex → lead)

- **Date:** 2026-11-20
- **Type:** return
- **Ledger:** 0015-t1
- **Spec:** [approved design](../superpowers/specs/2026-11-19-x32-mixes-design.md)
- **Plan:** [Task 1, global constraints and review focus](../plans/0015-x32-mixes.md)
- **Dispatch:** [scope and receiver ack](2026-11-20-0015-t1-x32-client--lead-to-codex.md)
- **Branch:** orch/0015-t1-x32-client
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-22cae3b8-50cbef180f1f5202
- **PR:** https://github.com/pepperhorn/ableton-control/pull/12 (draft)
- **Base commit:** fc1fe8de0a6dc92f2c6eb30c086d371c159ef7d5 (contains dispatch base 57df4758d8d47c80d3385da4657ada04960f2548)
- **Implementation commit:** c0849a0499383e519d9b942144a2221efebedb8d
- **Port:** no application server started; UDP test uses ephemeral loopback ports.
- **Status:** closed (implementation complete, review pending)

## Goal
Task 1 is complete: standalone OSC codec, X32 client, fake desk and tests. Lead should arrange the cross-family review and consume these interfaces in Task 4. Real hardware verification remains outstanding.

## Scope
- **In / owned files:** new `setlist-touch/device/lib/{osc,x32,fake-x32}.js`, new `setlist-touch/test/{osc,x32}.test.js`, and these two 0015-t1 handoffs.
- **Out / untouched:** all existing runtime/test files, server and UI integration, config, device patch, ledger, other tasks, other docs.

## Acceptance criteria
- [x] Every scenario named in Task 1 is covered and passing (some closely related scenarios share a test).
- [x] Full suite passes: 336 tests, including 29 new tests (7 added for review r2).
- [x] Only owned files changed; scope checked against `main...HEAD`.
- [x] Protocol assumptions and remaining real-desk checks are listed below.

## Verify with
```bash
cd setlist-touch && PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
```
Final output:
```text
1..336
# tests 336
# suites 0
# pass 336
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11700.514538
```
`git diff --check` and staged whitespace check passed. Initial tests failed because the new modules did not yet exist. Focused tests cover full OSC scalar handling and malformed packets, fake-time connection/loss/retry/renewal, partial loads, live topology and metadata, non-mutating snapshot reads, and a real `dgram` loopback fake-desk load/write/echo. No Node 16 executable is installed here: runtime uses Node 16-compatible built-ins and syntax, but execution was verified on Node 22.22.1 only.

## Decisions made / interfaces
- No named interface deviations. `connected` is emitted only after every required value has been read; `snapshot()` is null during load, loss, stop and host change. Both writes refuse until connected and loaded. No saved levels are written during connection/reconnection.
- Reads use 40 queries per 50 ms tick, at most 100 outstanding, below the plan's 200 ceiling. Retry unanswered reads after 1 s, twice; an exhausted read invalidates the whole load. UDP loss never fabricates a default as a fresh value.
- Bus links are read first. A desk-side link change invalidates the snapshot and reloads all topology/values. Changes to `toMain` emit a refreshed snapshot; name/color and level changes emit the specified events.
- Snapshot events/accessors return copies; each successful send/master write is followed by a read of the same address, so the snapshot and level events use desk replies even without write echoes.
- The caller owns and binds the UDP socket before `start()` (bind to an ephemeral port and await `listening`), and closes it after `stop()`. The client removes its listeners, cancels timers and never closes the caller's socket. Message rinfo must contain `address` and `port` as supplied by `dgram`.
- Fake fixture arrays are partial overrides of a complete desk: `buses: [{bus,name,color,master,sends,toMain,linked}]`, `sources: [{id,name,color}]`, `linked: [oddBusNumber]`, `toMain: [busNumber]`. Its returned `state` is an OSC address → scalar map; mutate a scalar and deliver `osc.encode(address,[value])` through the test/dev socket to simulate desk changes. `writes` contains only accepted fader writes. `echoWrites` defaults to true; false suppresses write replies but still answers reads.
- `setHost(null)` returns to broadcast discovery when `discover` is enabled; `discover:false` with no manual host sends nothing.

## Desk protocol assumptions — each requires a real-X32 check
The plan supplies these assumptions; primary reference entry points are [Maillot's X32 documentation](https://sites.google.com/site/patrickmaillot/x32) and [the author's protocol utility sources](https://github.com/pmaillot/X32-Behringer). The fake and loopback tests do not certify them.

- [ ] On the Apple router, broadcast `/xinfo` reaches UDP 10023 and replies contain four strings (IP, name, model, version). Replies originate from the actual desk IP and UDP port 10023. Manual host discovery also works. The client trusts the packet source IP, not its advertised IP string.
- [ ] OSC scalar messages use four-byte-padded UTF-8 strings and big-endian `s/i/f`; read requests use an empty type tag string `,`. Verify no needed updates arrive only in OSC bundles (bundles are not supported).
- [ ] `/xremote` renews subscriptions every 8 s, with desk-side updates delivered to the same bound UDP socket. Each renewal (including the first) also sends `/xinfo` directly to the connected host; verify those replies keep an idle desk alive without snapshot reloads. Silence for 20 s still declares loss.
- [ ] An unanswered discovery `/xinfo` declares loss at 3 s and retries every 3 s; silence loss retries after 3 s. Reconnection reads everything again with no level writes.
- [ ] Channels 01–32, aux inputs 01–08 and FX returns 01–08 all expose `/config/name` and `/config/color`; blank names remain empty and colours are integers 0–15.
- [ ] Buses 01–16 expose `/config/name`, `/config/color`, `/mix/st` (0/1 Main LR route) and `/mix/fader` (0–1).
- [ ] `/config/buslink/1-2` through `/config/buslink/15-16` return integer 0/1. Linked pairs use only the odd bus's metadata/master/send levels; assigning even 6 maps to 5. Verify desk-side link changes produce notifications, and both send/master writes to the odd bus control the pair correctly.
- [ ] Every source supports `/<kind>/NN/mix/MM/level` into each exposed bus, including aux and FX return sources. Missing/unsupported values deliberately prevent the snapshot from becoming writable.
- [ ] The desk tolerates the chosen query pacing (40 per 50 ms, ≤100 outstanding) and responds within the 1 s retry window. Check initial full load and packet loss under simultaneous fader activity from other apps/phones.
- [ ] Only `/<kind>/NN/mix/MM/level` and `/bus/MM/mix/fader` writes are sent, as OSC floats clamped to 0–1; verify the read queries sent immediately after both types of write return authoritative levels at the same addresses, whether or not writes themselves are echoed. Confirm Main LR, matrices, DCA, pan, mute, EQ, names and colours remain untouched.
- [ ] dB labels match the supplied four-segment fader law: 0 → -inf, 0.0625 → -60, 0.25 → -30, 0.5 → -10, 0.75 → 0, 1 → +10 (displayed as `10.0 dB`). Verify taper boundaries and quantized real-desk values.

## Known gotchas / GBrain
GBrain keyword search for `m4l-control` / `X32` found the 2026-11-19 design conversation; partial index coverage was reported. No additional protocol decision was taken from GBrain. The approved repository spec and plan govern. Implementer did not write to GBrain.

## Open questions
None blocking Task 1. Hardware checks above remain for the lead/user; this change does not claim real-X32, Live or Windows validation.

## Return
- **Outcome:** done
- **What changed:** scalar OSC codec; read-first, bounded-query EventEmitter client; complete fake desk; 29 new tests including review-r2 regressions.
- **Out-of-scope issues found:** none changed.
- **Follow-ups:** review this PR; Task 4 binds/injects the UDP socket and wires fake events into dev mode. Run real-X32 checks before gig use.
- **For GBrain (lead to promote):** snapshots fail closed until all required reads complete; link changes force a fresh load; socket ownership stays with the caller. Real-desk behavior is still unverified.

## Review r2 — addressed
All review findings and suggestions on PR #12 head `6513578` were reproduced with seven failing regressions and fixed within owned files:
- Every `/xremote` renewal includes a peer-directed `/xinfo`. An online desk left idle for 60 s remains connected with exactly one snapshot load; after the initial load, the test counts seven renewal pairs (14 packets), with no metadata/level reloads.
- Both successful fader-write methods immediately read the same address. `createFakeX32({echoWrites:false})` proves authoritative send/master snapshot updates and level events without write echoes; the default remains true per the lead decision.
- A changed buslink received during content loading restarts the full load. The regression unlinks 5/6 before the first snapshot and verifies a consistent 16-bus snapshot and busFor(6) === 6.
- dB values rounding to zero display `0.0 dB`, never `-0.0 dB`.
- Both start and tick schedule only if running with no existing timer. A status listener stopping/restarting during the load-completing tick leaves exactly one timer and stop removes it.
- Status notifications compare the complete status payload and suppress unchanged searching/lost retries while preserving real transitions and host changes.

Final verification is the 336-pass suite above, plus `git diff --check`. No server integration or hardware validation was added. Lead should request the next cross-family review on the pushed head.
