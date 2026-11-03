# Plan 0006 — Timing clips on the device track

- **Spec:** ../specs/0006-timing-clips.md · **Base:** main · **Verify:** `cd setlist-touch && npm test && python3 device/build_device.py`

Single dispatch (K = `0006`), one worktree.

## Owns
`setlist-touch/device/lom.js`, new `setlist-touch/device/timing-clips.js` if you prefer a separate `js` (else in `lom.js`), `device/build_device.py`, `device/SetlistTouch.amxd`, `device/SetlistTouch.maxpat`, `device/setlist-server.js`, `device/lib/app.js`, `device/lib/fake-bridge.js`, `device/dev.js`, `device/web/**`, `setlist-touch/README.md`, `test/lom.test.js`, `test/device.test.js`, `test/app.test.js`, web tests, new tests.

## Review focus (each gets a test)
1. **Never touches an existing clip.** Re-check `has_clip` at the final boundary before each create; a slot that gained a clip mid-build is skipped.
2. **Budget:** ≤150 LiveAPI ops and ≤3 scene rows read per tick; a 683-scene × 32-track build in the harness stays in budget and reports total time.
3. **Longest loop:** MIDI and warped audio only; unwarped audio, empty slots and the device track itself are ignored; ties fine.
4. **Device track binding:** found from `this_device canonical_parent`; fallback to last regular track with a console line; track add/remove/reorder rebinds; the existing playing/position logic is unchanged apart from which track it reads.
5. **Concurrency:** no build during indexing; a second request is 409; set structure change (scenes or tracks list) mid-build stops the build cleanly with a message; device removal stops it.
6. **Admin only:** 403 for others including `open` phones; Origin check; `confirmPlaying` required while playing (409).
7. **No-songs message** shown only when a set arrived with zero songs, not while connecting or indexing.

## Live-only checks for the user
Risks list in the spec, plus: generated clip launches with its scene, both by tap and by scene follow action; counts appear after Build.
