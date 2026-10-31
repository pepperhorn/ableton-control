# Handoff: 0008 — Monitor tab, answers to blocked return (lead → codex)

- **Date:** 2026-10-31
- **Type:** dispatch
- **Ledger:** 0008 · **Spec:** docs/superpowers/specs/2026-10-30-monitor-and-access-design.md (Part 1)
- **Branch:** orch/0008-monitor-tab · **PR:** https://github.com/pepperhorn/ableton-control/pull/6
- **Status:** closed

## Decision
Your blocked report is accepted. Don't narrow the spec: Monitor must show any playing or queued scene, including ones before the first title and title scenes.

Add the data to the existing `play` event. Don't publish the whole raw scene list: on a 683-scene set that's needless load on every phone.

## Added scope
- `setlist-touch/device/lib/app.js` keeps the latest raw scenes from `onScenes`, and adds two fields to each `play` payload:
  - `current`: `{name, color, loopBeats, beatsPerBar}` for the playing index, or `null`
  - `next`: the same shape for the fired index, or `null`
- Both are recomputed in `onPlay` and `onScenes`. Existing `play` fields and `set` stay exactly as they are, and new clients get them through the existing `play` snapshot on connect.
- Monitor shows the name as Live has it, stripping only a leading `* ` from title scenes.
- Song title: use `playingSongId` when it's set. Otherwise leave the song title empty; don't guess.

## Files you now also own
- `setlist-touch/device/lib/app.js`
- `setlist-touch/device/lib/fake-bridge.js`, `setlist-touch/device/dev.js` (only if needed to exercise this)
- `setlist-touch/test/app.test.js`

Add tests: `current`/`next` for a pre-title scene, a title scene and a normal row; `null` when nothing plays; refreshed after a scene rename; present in the connect snapshot.

Everything else in the original handoff still applies, including no Live or `.amxd` change, and the note that Node 16 test runs aren't required.
