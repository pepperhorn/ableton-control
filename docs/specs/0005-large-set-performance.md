# 0005 — Large-set performance and indexing progress

- **Status:** approved (user, 2026-10-29: "683" scenes; "need some sort of user feedback to see the index progress")
- **Ledger:** 0005 · **Plan:** single task, in the dispatch handoff
- **Author:** lead · **Date:** 2026-10-29

## Problem
The user dropped `SetlistTouch.amxd` on their real show set, which has **683 scenes**. Live froze after the Windows networking prompt.

The cause is `setlist-touch/device/lom.js`:
- **`rebuild()` scans the whole set in one synchronous pass.** For every scene it creates a `LiveAPI`, makes about 5 `get`s, and does a `clipAt` (2 more `LiveAPI`s and up to 4 `get`s). It then registers **5 observers per scene**, about 3,400 for 683 scenes. All of this runs on Live's thread in one go, so Live's UI blocks until it finishes.
- **The 5-second `poll` repeats much of that work.** It calls `rebuild(true)`, which runs `clipAt` for every scene. That gives a recurring stall every 5 s.
- **Any scene name, colour or time-signature change triggers a full `rebuild()`**, so editing one scene rescans all 683.
- **There is no feedback while this happens.** Live looks hung, and the user can't tell indexing from a crash.

`mix.js` registers 2 observers per track, plus sends for `+ ` tracks. That is smaller, but it is the same pattern.

## Goals
1. **Live never freezes.** On a 683-scene set, and on a 1,000-scene set in tests, no single synchronous slice of LiveAPI work exceeds a fixed budget. Indexing runs in small chunks scheduled with `Task`, so Live stays responsive (UI, transport, audio) throughout.
2. **Visible indexing progress, in two places:**
   - **In the device in Live:** the existing status text (the `address` message box) shows `Indexing scenes 340 / 683…` while it works, then returns to the address once done.
   - **In the web app** (laptop and phones): while indexing, the connection/status bar shows `Indexing Live set… 340 / 683` with a thin progress bar, instead of "Waiting for Live set…".
   - **Updates are throttled** to about 4–10 per second.
3. **No recurring full rescans.** Remove the 5-second full `rebuild(true)` poll, and replace it with targeted work.
   - Loop-length edits on the timing track are still picked up. Either:
     - re-read the **playing / queued / current song's** rows when playback changes, plus a slow chunked background sweep; or
     - use observers on the timing track's slots, created in chunks.
   - Which of these to use is the builder's choice, within the budget.
4. **Incremental updates.** A change to one scene's name, colour or time signature re-reads **only that scene** and republishes the snapshot. It does not rescan all scenes. Scene add, remove or reorder (the `scenes` list changes) triggers a chunked re-index, with progress shown.
5. **Observers are registered in chunks too.** Registering them must not create one long burst.
6. **Same budget treatment for `mix.js`** if its startup slice exceeds the budget on a 100-track set. Otherwise leave it alone and say so in the return handoff.

## Non-goals
- No change to scene-launch, setlist, mix-fader or transport behaviour or UI beyond the indexing status.
- No new settings.
- Footswitch support (0004) is out of scope.

## Behaviour details
- **First snapshot:** the web UI receives the scenes snapshot once indexing completes. Partial snapshots are not published, so the setlist never shows half a set.
- **Re-index after structure changes:** the previous snapshot stays live and launchable until the new one is ready. Validation of `fire` by expected name is unchanged and still protects against stale rows.
- **`fire` works during a re-index,** because it re-checks the name at the final boundary as it does today.
- **Playing/queued/position updates keep working during indexing** once a timing track is known.
- **Device removed or set reloaded mid-index** (`notifydeleted` / `refresh`): the in-flight scan is cancelled cleanly, with no leaked observers or Tasks.

## Constraints
- `lom.js` and `mix.js` stay ES5 (classic Max `js`): `Task` for scheduling, no Promises.
- The Node server stays on Node 16+ built-ins.
- **Budget:** keep each slice to about **≤ 25 scenes or ≤ 150 LiveAPI calls/observer registrations**, whichever comes first, with slices about 10–20 ms apart. Tune it, but keep it a named constant and record the final numbers.
- Progress goes from `lom.js` → `node.script` as `progress <done> <total>`. The server forwards it as an SSE event, and new clients get the current progress on connect.
- Contextual class names for new UI elements (`index-progress`, `index-progress-bar`, `index-progress-label`). Poppins, as everywhere else.

## Acceptance criteria
- [ ] **AC1:** a `lom.test.js` harness test with **1,000 scenes**:
  - each `Task` tick performs at most `CHUNK` scene reads and the bounded number of LiveAPI creations/observer registrations
  - the final snapshot equals the expected rows
  - `progress` outputs go from 0 to 1000 and are monotonic
- [ ] **AC2:** after indexing, no recurring Task re-reads all scenes. The harness asserts that running the remaining scheduled tasks for a simulated minute reads at most a bounded number of scenes.
- [ ] **AC3:** renaming one scene re-reads only that scene. Assert this through the harness `gets`.
- [ ] **AC4:** a scene-list change re-indexes in chunks and keeps the old snapshot until the new one is published.
- [ ] **AC5:** `notifydeleted()` mid-index cancels the scan and leaves no active observers. A following `refresh()` indexes again from scratch.
- [ ] **AC6:** the server forwards `progress` over SSE, and new clients get it in their snapshot on connect.
- [ ] **AC7:** the web UI shows `Indexing Live set… n / total` with a progress bar during indexing, and the normal UI after. Check with a headless browser against `dev.js` with a simulated slow index.
- [ ] **AC8:** while indexing, the device's status text shows `Indexing scenes n / total…`. `build_device.py` stays deterministic.
- [ ] **AC9:** all existing tests pass.

## Open questions
None.
