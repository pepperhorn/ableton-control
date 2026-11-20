# Handoff: 0015-t4 — X32 in the server (codex → lead)

- **Date:** 2026-11-20
- **Type:** return
- **Ledger:** 0015-t4
- **Spec:** [approved design](../superpowers/specs/2026-11-19-x32-mixes-design.md)
- **Plan:** [Task 4](../plans/0015-x32-mixes.md)
- **Dispatch / acknowledgement:** [lead to codex](2026-11-20-0015-t4-x32-server--lead-to-codex.md)
- **Branch:** orch/0015-t4-x32-server
- **Worktree:** /home/shaun/.t3/worktrees/m4l-control/t3-d5e11f0e-026c031a12ebe217
- **Base commit:** c86eaa005e867d090e87c94d297203205553fd6c (contains required e0df6a8)
- **PR:** draft PR for this branch against main; URL supplied in implementer return message
- **Port:** 5354 (fake dev smoke completed; stopped)
- **Status:** closed (implementation done, review pending)

## Goal
Task 4 wires the existing X32 client into the server, with config migration, bus permissions, hidden lists, fail-closed/coalesced writes and filtered SSE. Task 5 can build its UI against the contracts below.

## Scope
- **Owned implementation:** `setlist-touch/device/lib/{app,access,config,x32-mix}.js`, `setlist-touch/device/{setlist-server,dev}.js`, `setlist-touch/test/app-x32.test.js`, and 0015-t4 handoffs.
- **Existing fixtures:** `test/app.test.js` now includes new member defaults in one fixture; server VM fixtures in `test/{device,mix,clipboard}.test.js` stub the new X32/UDP dependencies, keeping those legacy tests isolated from network traffic. No legacy assertions weakened.
- **Out / untouched:** UI, README, X32/OSC/fake modules, LiveAPI/Max code, other docs, ledger. Ableton handlers remain unchanged.

## Acceptance criteria
- [x] Every named Task 4 scenario covered (related scenarios share tests), plus level dedupe, permission revocation, SSE filtering and metadata refresh.
- [x] Full suite: 391 tests passed, zero failures.
- [x] Fake dev on 5354: connected Fake X32, 15 buses including linked 5/6, 48 sources.
- [x] Device build leaves generated files unchanged; whitespace and scope checked.
- [x] Only implementation/handoff files and existing test fixtures changed.

## Verify with
```bash
cd setlist-touch
PATH=/home/shaun/.nvm/versions/node/v22.22.1/bin:$PATH npm test
python3 device/build_device.py
git status --short
```
Final test tail:
```text
1..391
# tests 391
# suites 0
# pass 391
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
New tests were run before implementation: 9 failing, 0 passing. Final focused suite has 12 passing tests. Build printed `wrote SetlistTouch.maxpat, SetlistTouch.amxd`; neither generated artifact changed. `git diff --check` passed.

Fake smoke:
```bash
SETLIST_TOUCH_FAKE_X32=1 SETLIST_TOUCH_PORT=5354 node device/dev.js
curl -fsS http://127.0.0.1:5354/api/x32
```
Readback: `status={state:'connected',host:'192.168.1.32',name:'Fake X32',model:'X32'}`, 15 buses, 48 sources, bus 5 linked. No real desk, Ableton, Windows or physical touch/audio validation. Runtime uses Node 16-compatible syntax and built-ins; execution was Node 22.22.1, not Node 16.

## Decisions made / exact API contract for Task 5
- Config normalizes `mixSource` to `x32` for new installs and `ableton` for existing member return assignments; explicit saved choice wins. `x32Host` is a manual IPv4 override or null. `x32LastHost` separately records the last connected address, best effort, without turning discovery into a manual override. Automatic discovery continues on startup when no manual override is set. Damaged config is never overwritten for this convenience field.
- Members normalize `buses:[]`, `hidden:{}`; legacy configs remain valid. `POST /api/members` accepts both fields and preserves them if omitted for an existing member. Bus numbers 1–16 and known source-id syntax are validated; master cannot enter any hidden list. A toMain assignment saves and adds `warning:'Bus 5 is routed to Main LR'` to the existing me response (first matching warning if several buses feed Main).
- `can(identity,'busSend',bus,busFor)` compares mapped permissions and targets. `meFor` / `/api/me` adds `mixSource` and `buses` (`'all'` for admin/open, number array for members, [] for none). Existing identity cookies still determine the member when access is off.
- **GET `/api/x32[?member=id]`:** `{mixSource,status,buses,sources,levels,hidden,unavailableBuses}`. `status` is the unchanged client status. `buses` is the permitted client Bus array (`bus,name,color,linked,toMain,master,sends`), sorted with the identified member's first mapped bus first. `sources` is the client Source array (`id,kind,number,name,color`) plus `unnamed:boolean`. Blank names get client `defaultLabel` fallbacks. `levels` is keyed by bus number then source id or `master`, with each entry `{value,label}` using `levelToDb`. `hidden` is keyed by canonical bus number with source-id arrays; absent saved lists default to unnamed sources, while explicit [] means show everything. `unavailableBuses` lists assigned canonical bus numbers missing from the snapshot; a member with no bus has empty buses and unavailableBuses. Only admin can select another member's hidden lists with the query; permissions still show all admin buses. During loss the snapshot-derived fields are empty and status drives disabled faders.
- **POST `/api/x32-send`:** JSON `{bus,source:'master'|sourceId,value:0..1}`, success 204. Bad shape/source 400, no bus authority 403, wrong mode/disconnected/unloaded/missing bus 409. Permission checks map even linked buses to odd. Requests coalesce per canonical `(bus,source)` at 50 ms, last value wins. Every delayed flush rechecks current identity, config, snapshot and bus. Status/snapshot/config changes cancel pending values; reconnect never writes saved levels.
- **PUT `/api/x32-hidden`:** JSON `{bus,hidden:string[],member?:id}`, success 204. Member edits their own assigned bus; admin can target a member. Open access still needs member identity to save a personal list. 403 for another member or forbidden/unassigned bus, 409 for unavailable snapshot/bus, 400 for invalid ids including master. Lists use canonical odd bus keys and remove equivalent even keys. Full state is refreshed after saving.
- **GET `/api/x32-settings`:** admin only; `{mixSource,host,lastHost}`. **PUT** accepts `{mixSource?,host?}`, admin only; returns `{mixSource,host}`. Host is dotted IPv4 or null. Save completes before changing the client host; failed save does not apply settings. Changed host calls `setHost`; changed settings cancel queued writes and broadcast `access` plus full X32 state.
- **SSE `x32`:** same full filtered GET state, emitted on connection, snapshot, metadata and status; `?member=id` works for admin SSE too. Each connection re-evaluates its identity against current config/cookie expiry. Existing Ableton event ordering is preserved by appending the initial X32 event after existing initial events.
- **SSE `x32level`:** `{bus,source,value,label}`; filtered per current identity, at most one per 100 ms per canonical target per client, trailing latest value wins. Snapshot seeds dedupe, and unchanged subsequent values never emit. Pending level events are discarded on snapshot/status/config changes and connection close. Backpressure limit also applies to X32 events.
- The server owns the UDP socket, binds it before starting the X32 client, and stops/closes it on SIGTERM or HTTP startup failure. App close removes listeners and cancels its own queued timers; socket ownership remains with the server. Dev fake uses the real client and merged fake desk over an in-memory socket, with no desk network traffic.

## Known gotchas / GBrain
GBrain search for `m4l-control X32` returned no relevant project page among its ranked results and reported partial indexing. No GBrain claim informed implementation; repo spec/plan and Task 1 return contract govern. Implementer did not write to GBrain. Real desk echo, idle subscription, linked addressing and dB behavior remain Task 1's hardware gates.

## Open questions
None blocking. Task 5 and cross-family review remain with lead.

## Receiver ack
Lead acknowledges through the ledger.

## Return
- **Outcome:** done
- **What changed:** server/config/access integration, X32 mix helper, fake-dev wiring, 12 new regressions and legacy fixture updates.
- **Out-of-scope issues:** none changed.
- **Follow-ups:** request cross-family PR review; Task 5 consumes contracts above; real-X32/Live/Windows checks remain.
- **For GBrain (lead to promote):** clear delayed writes on snapshot/status/settings changes, recheck identity at delayed boundaries, and seed level dedupe from authoritative snapshots. Last discovered IP is stored separately from the manual override.
