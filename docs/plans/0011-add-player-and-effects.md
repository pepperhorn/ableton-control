# Plan 0011 — Add player and effects in in-ear mixes

- **Spec:** ../superpowers/specs/2026-11-01-add-player-and-effects-design.md
- **Base:** main
- **Verification (whole item):** `cd setlist-touch && npm test && python3 device/build_device.py`

## Approach
A new ES5 script, `device/players.js`, owns every set-changing action and the output-list reads, so `mix.js` stays read-and-fader only. `mix.js` gains effect sends in its scan. Node validates and permission-checks, then forwards to Max on the deferred path. The web admin page gains the form; the mix page gains effect rows.

**Tech:** ES5 Max `js`, Node 16+ built-ins only, vanilla ES modules, `node --test`.

## Global constraints
- This is the first feature that changes the set. Every Live API here is **unverified** (spec Risks 1–6). Each must fail safe: a failed or unexpected result gives the admin a clear message and writes nothing further. Never guess.
- Nothing is deleted. The only set changes are: create a return, name it, set a return's output, write an effect → player send.
- A return on Main is never re-routed, by any path.
- Only effect → player sends are written, at the final boundary. Never effect → effect, player → anything, or a regular track → effect.
- ≤ 150 LiveAPI operations per tick. Output lists are read only on request while the admin form is open, never at startup.
- Set-changing routes: admin only, 403 for anyone else, Origin check as other POSTs. Access off (`open`) from a phone is **not** admin for these routes: only `admin` kind may use them.
- Disabled return sends: user decision, no detection and no note. README line only.
- Contextual class names (`add-player`, `add-player-output`, `add-player-warning`, `mix-effect-row`), Poppins.

## Review focus
Each line gets a test.
1. **Effect send mapping.** A wrong index writes to the wrong player. Map from return A's `mixer_device sends` to player return P only by proof: read the sends count and each send parameter's `name` if it identifies the target. Accept positional when count equals return count; accept skip-own when count equals return count − 1 (index shifts down after the effect's own slot). Anything else: no rows for that effect, one `post()` diagnostic stating count and names, so the user's first Live test explains itself. Test all three with the harness.
2. **Final-boundary recheck for effect writes:** return ids, effect and player names, and routing (effect still on Main, player still not), as `send` does.
3. **Mid-add failure:** return created, routing fails: no member added, return stays, form message per spec; Add again links it. Create failing: no member, nothing else attempted.
4. **Name round trip:** read the name back after setting. Compare with the same rule used for mix permissions. If Live adds a prefix or the name differs, use the read-back name for the member's mix and show it, so the permission doesn't fail closed.
5. **Link rules:** existing return on Main is refused; existing non-Main return only re-routes if the admin picked a different output.
6. **Existing member** updated, never duplicated (name match ignoring case); first member still turns access on and never off.
7. **Concurrency:** one add at a time; a second is 409. A pending add that gets no reply from Max times out with a failure message, and the lock clears. Device removal clears it too.
8. **Live playing:** server refuses an add without `confirmPlaying:true` while the transport runs (409), so the warning can't be bypassed by a stale form.
9. **Mix re-read:** the new return triggers the existing observer rebuild; faders fail closed until it finishes (0007). Member add happens only after Live confirms the return, not after the rebuild.

## Tasks
A single dispatch (K = `0011`). In order, one worktree, as they share `lib/app.js`.

### T1 — Live side
- **`players.js`** (new, ES5, new `js` object in `build_device.py`, regenerate `.amxd`/`.maxpat`):
  - `outputs [returnIndex]`: reads `available_output_routing_types`, then channels for an external type, and replies via Dict + outlet. Finding channels: first from an existing non-Main return; if none, from a return being set up; don't change the set just to read (Risk 5). If types can only be read and channels can't, reply with what's known; the form falls back to creating the return, then offering channels.
  - `add requestId name typeId channelId`: find an exact-name return or `create_return_track`; set name; read back; set routing unless already matching and only if not on Main-as-existing; read back; reply `playerResult requestId ok|error message returnName`.
  - Undo: use `begin_undo_step`/`end_undo_step` on `live_set` if callable, inside try/catch; a failure there mustn't fail the add. Record the outcome in the return handoff.
  - Runs from `deferlow`, like `send`.
- **`mix.js`:** after track sends, a bounded `effects` phase. For each effect return (routed to Main) and player return, publish `snapshot.effects = [{index, name, color, sends:{<playerReturnIndex>: level}}]`, observing values, same `level`-style echo with a distinct message `effectLevel`. Add `effectSend(effectIndex, returnIndex, value, expectedEffectName, expectedReturnName)`. See review focus 1, 2. Existing track fader behaviour unchanged.
- **Harness tests:** `test/players.test.js`, extend `test/mix.test.js`: risks' three send shapes, budget assertions, retirement of new observers, inert callbacks after `notifydeleted`.
- **Owns:** `device/players.js`, `device/mix.js`, `device/build_device.py`, `device/SetlistTouch.amxd`, `device/SetlistTouch.maxpat`, `test/players.test.js`, `test/mix.test.js`, `test/device.test.js`

### T2 — Server
- Routes (admin kind only): `GET /api/player-outputs`, `POST /api/players {name, sendName, typeId, channelId, confirmPlaying}`; `/api/effect-send` needs the mix permission for the return resolved from `returnIndex` in the current `mix`, as `/api/send`.
- Extend `lib/parse-mix.js`, `lib/fake-bridge.js` (simulated create, failure modes, effects) and `dev.js`, `setlist-server.js` handlers. SSE: `effectLevel`.
- Member write reuses the 0009 validate-and-save path and `access` broadcast.
- **0010:** a server restart mustn't reset a saved mix tab or land someone on another player's mix; stale `.damaged` copy mustn't make the warning wrong; damaged-config warning says restart.
- **Owns:** `device/lib/app.js`, `device/lib/parse-mix.js`, `device/lib/access.js`, `device/lib/config.js`, `device/lib/fake-bridge.js`, `device/dev.js`, `device/setlist-server.js`, `test/app.test.js`, `test/access.test.js`

### T3 — Web
- Admin form per spec: player name, send name (follows player name until edited), output list with in-use labels, no-outputs and 12-return messages, warning plus second confirmation while playing, failure message.
- Effect rows after track rows, marked as effects, sharing the existing fader behaviour; default level is whatever Live reports (off in a new send).
- README: add-player guide, the disabled-send line, routing prerequisites in Live's audio preferences.
- **Tests:** pure view logic for form state and rows; 0010's tab case.
- **Browser check** against `dev.js` at 390×844 and 1280×800: add new, link existing, Main refused, failure message, playing warning, effect fader on a phone.
- **Owns:** `device/web/**`, `test/*-view.test.mjs` and new web tests, `setlist-touch/README.md`

## Live-only checks, for the user
Risks 1–6, plus: undo as one step, add while playing doesn't stutter, an enabled effect send is audible only in that player's output.

## Merge order
Single PR.
