<img src="assets/icon.svg" width="64" height="64" alt="">

# SceneNav — Next / Previous Scene launcher for Ableton Live 12

A Max for Live MIDI Effect with three mappable buttons:

| Button | Action |
| --- | --- |
| **◀ Prev** | Launch the scene above the selected one and select it |
| **Launch** | Re-launch the selected scene |
| **Next ▶** | Launch the scene below the selected one and select it |

It works from the **selected** scene, so arrow-key browsing still works: arrow to a song, then press Next/Prev from there. **Wrap** jumps from the last scene back to the first (and the other way). The display shows the scene number and name.

## Install

1. Copy `device/SceneNav.amxd` **and** `device/SceneNav.js` into the same folder, e.g. `User Library/Presets/MIDI Effects/Max MIDI Effect/SceneNav/`.
2. Drag `SceneNav.amxd` onto any MIDI track. A spare track works, and so does the track holding your setlist device. MIDI passes through unchanged.
3. Optional: open the device in Max (the edit button) and choose **File → Freeze Device**, then save. This bundles the JS into the `.amxd` so you can move it on its own.

> If the `.amxd` won't load, make a new **Max MIDI Effect**, open it in Max, open `device/SceneNav.maxpat`, copy all of it, paste it into the device, and save it next to `SceneNav.js`.

## Map to keyboard

1. Press **Ctrl/Cmd+K** (Key Map mode).
2. Click **Next ▶** and press a key, for example `.`. Click **◀ Prev** and press `,`.
3. Press **Ctrl/Cmd+K** again to leave.

Live reserves the arrow keys, so choose other keys. Turn on the Computer MIDI Keyboard only if it won't fight with these keys.

## Map to a controller

1. Press **Ctrl/Cmd+M** (MIDI Map mode).
2. Click a button, then press a pad or footswitch.
3. Press **Ctrl/Cmd+M** again to leave.

## Notes

- Launches follow your Global Quantization, the same as clicking a scene.
- The device selects the scene again after launching it, so it stays in step even if **Settings → Record/Warp/Launch → Select Next Scene on Launch** is on.
- To rebuild after editing: `python3 device/build.py`.
