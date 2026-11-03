# 0006 — Timing clips on the device track

- **Status:** approved (user, 2026-11-03: "yes", the device track is the timing track; follow actions are always scene follow actions)
- **Ledger:** 0006 · **Plan:** docs/plans/0006-timing-clips.md
- **Author:** lead · **Date:** 2026-11-03

## Problem
Bar counts and the playing section come from the last regular track's clips. The user's device track (`32 MIDI`, also the last track) is empty, so there are no counts, and the user must hand-make a clip per scene in a 683-scene set.

## User facts
- The device sits on its own MIDI track; that track is the timing track.
- Sections either vamp until the next scene is triggered, or move on by **scene** follow actions (never clip follow actions). A scene follow action fires the next scene, which launches that row's timing clip, so generated clips stay in step with no follow actions of their own.

## Behaviour
1. **Timing track = the device's own track** (`this_device canonical_parent`). If the device isn't on a regular track (a return or Main), fall back to the last regular track, as today, and say so in the Max console.
2. **Build timing clips** (admin only, from the web settings/admin area, with confirmation; second confirmation while Live is playing):
   - For each scene whose device-track slot is **empty**, create an empty MIDI clip whose loop length is the **longest loop in that scene row** across the other tracks (MIDI clips, and warped audio clips; unwarped audio is ignored because its length isn't in beats).
   - Rows with no usable clip are skipped and counted in the result.
   - Slots that already have a clip are **never touched**. Deleting a clip and pressing Build again regenerates it. Hand-prepared clips always win.
   - Clip name: `⏱ <bars> bars` (my call), so they're recognisable.
   - Runs chunked within the 0005 budget, shows progress (`Building timing clips n / total`) in the web app and device status, and can't run during indexing or while another build runs.
   - One undo step if the API allows; otherwise not, and the README says so.
   - Result message: created, skipped (already had a clip), skipped (no source clip).
3. **Counts without built clips (my call):** none. Bar counts and progress come only from device-track clips, so what the screen shows is always what Live is playing. The Build button is how a set gets counts.
4. **No songs message:** when the set arrives with no `* ` song scenes, the page says `No songs found. Name a scene "* Song title".` instead of "Waiting for Live set…".

## Non-goals
Copying clip follow actions; per-scene follow-action reading; deleting or resizing existing clips; a timing-track picker.

## Risks (user checks in Live)
`this_device canonical_parent` path form; `clip_slot.call('create_clip', beats)`; clip `name` set; undo grouping; build time on 683 scenes; that a scene follow action launches the generated clip with the row.
