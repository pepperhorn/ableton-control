<img src="assets/icon.svg" width="64" height="64" alt="">

# ableton-control

Max for Live tools for running a live band set from **Ableton Live 12 Session view**: touch-first scene launching, a setlist built from your scene names, and phone control of in-ear mixes.

| Device | What it does | Status |
| --- | --- | --- |
| [Setlist Touch](#setlist-touch) | Large touch screen for the current song's scenes, with a setlist sidebar and bar-accurate progress. Works in Live and in any browser, including a phone over Tailscale. | Built and reviewed; needs a check in Live on Windows |
| [In-ear mix pages](#in-ear-mix-pages) | Setlist Touch pages where any player adjusts any player's in-ear mix from their phone | Built and reviewed; needs a check in Live on Windows |
| [SceneNav](#scenenav) | Prev / Launch / Next scene buttons you can map to computer keys or a MIDI controller | Usable, not yet tested in Live |

Requires Ableton Live 12 Suite (Max for Live included). Setlist Touch targets a Windows touch laptop.

## Setlist Touch

A Max for Live MIDI Effect that runs a small web server inside Live. It shows the current song's scenes as large, full-width rows in your scene colours with your exact titles. Tap a row to launch it, with normal Live quantisation.

- **Setlist sidebar:** songs grouped by category, with filter pills. Choosing a song only brings it into view and never launches or interrupts playback.
- **Progress:** bar lines on each row from the clip length on your timing track, plus a fill and a `bar / total` counter while a scene plays. A solid outline marks the playing scene and a dashed one the queued scene.
- **Touch safety:** only a clean tap launches. Drags, scrolls, long presses and multi-touch don't. The screen never switches song by itself; a "Now playing" banner offers the way there. Each screen has a lock.
- **Transport (opt-in):** add `?transport=1` to the address for Play (tap), Stop and Arrangement Rec (1-second hold), plus tempo and bar.beat position.
- **Monitor tab:** a read-only page for players: the current scene with its bar count, and the next scene flashing once it's triggered.
- **Band access (optional):** add members in admin, and each picks their name on first connect. You choose who gets which pages and mixes. It's on one shared band password, so names are an honour system. The laptop is always admin.
- **Anywhere:** a window inside Live, `http://localhost:8765` on the laptop, or `http://<laptop>:8765` from phones on your LAN or tailnet, behind a username and password.

### Scene naming convention

Everything is read from scene names. Nothing in your set is changed.

| Scene name | Meaning |
| --- | --- |
| `* [[ DINNER ]]` | Category: groups the songs after it |
| `* Song Title` | Song title scene (`* ` = star and a space) |
| anything else | A section of the current song, e.g. `[V4] Intro`, `[N32] AA`, `[S] Last Chord` |
| empty | Spacer. The first empty scene after a song shows as a tappable `■ End` row. |

Tags like `[V]`, `[N32]` and `[S]` are only labels. Your clip follow actions do the work.

**Timing track:** the last regular track, just left of Main. In each section's row it holds a clip (MIDI or warped audio) whose loop length sets the section's bar count. It should carry the same follow actions as the music.

Install, settings, networking and the touch check are covered in [`setlist-touch/README.md`](setlist-touch/README.md).

## In-ear mix pages

A "My mix" page in Setlist Touch, with one tab per player:
- **Tabs:** every return track that isn't routed to Main (e.g. `Shaun`, `Keith`) gets a tab. Reverb and delay returns that feed Main are left out.
- **Faders:** every track or group whose name starts with `+ ` (e.g. `+ DRUMS`, `+ CLICK`) gets a fader bar for its send to that player.
- **Touch safety:** a tap never changes a level. Faders move with a horizontal slide, relative to where they were.

Design: [`docs/superpowers/specs/2026-10-29-in-ear-mix-design.md`](docs/superpowers/specs/2026-10-29-in-ear-mix-design.md) · Plan: [`docs/plans/0002-in-ear-mix.md`](docs/plans/0002-in-ear-mix.md)

## SceneNav

A small MIDI Effect with **◀ Prev**, **Launch** and **Next ▶**. These launch the scene above or below the selected one, or relaunch the selected one, and move the selection with it. A **Wrap** toggle loops from the last scene back to the first.

1. Put `device/SceneNav.amxd` and `device/SceneNav.js` in the same folder, then drop the `.amxd` on any MIDI track.
2. **Keyboard:** press Ctrl/Cmd+K, click a button, press a key, then exit. Live reserves the arrow keys.
3. **Controller:** press Ctrl/Cmd+M, click a button, press a pad, then exit.

If the `.amxd` won't load, create a Max MIDI Effect and paste in the contents of `device/SceneNav.maxpat`. Rebuild with `python3 device/build.py`.

## Development

```sh
cd setlist-touch
npm test                         # node --test, no npm dependencies
node device/dev.js               # run the UI against a fake set, no Live needed
python3 device/build_device.py   # regenerate the .amxd / .maxpat
```

The server is CommonJS on Node 16+ with built-ins only. The LiveAPI scripts are ES5 (classic Max `js`). The web UI is plain ES modules with Poppins bundled locally.

Work is planned and reviewed through the docs in [`docs/`](docs/README.md): specs, plans, handoffs and a progress ledger. [`AGENTS.md`](AGENTS.md) describes the agent workflow.
