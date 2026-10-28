# Setlist Touch — design

Date: 2026-10-29 · Status: approved 2026-10-29

## Intent

The user runs live sets (grouped into categories such as DINNER) from Ableton Live 12 **Session view** on a Windows touch laptop. Each song is a block of scenes; each scene is a song section or part of one. The arrangement is built on the fly: the user launches sections in whatever order the moment needs, vamps as long as needed, and moves on.

Today they use a third-party Max for Live setlist device (by abletondrummer) that lists songs and jumps between them, and they navigate scenes with arrow keys in Live's tiny scene column. They want a **large, touch-first view of the current song's scenes** they can tap to launch, with the same colours and titles as Live's scene column and a bar-accurate progress bar — plus a setlist to browse songs. It should also be usable from a browser, including a phone over Tailscale, held by the user or a bandmate.

Success: mid-gig, the user (or a bandmate on a phone) can see where the song is, see how many bars are left in the current section, and tap the next section confidently — without ever triggering the wrong thing or having the screen move under their finger.

## Anti-goals (would make this a failure even if it "works")

- **An incorrect trigger.** A scroll, drag, brush or accidental touch launches a scene.
- **A jump.** The screen switches to a different song by itself, or the music jumps somewhere the user didn't intend.

Every behaviour below is subordinate to these two.

## How the set is encoded (the user's existing convention — read, don't change)

Everything is derived from scene names and colours in the Live set.

| Scene name pattern | Meaning |
| --- | --- |
| `* [[ NAME ]]` | **Category** heading (e.g. `* [[ DINNER ]]`). Contains every song after it until the next category. |
| `* Title` (any other `* ` prefix, star + space) | **Song title** scene (white, no audio). E.g. `* RISE >>`, `* GIVING YOU THE BEST THAT I'VE GOT` |
| anything else | A **section scene** belonging to the most recent song title |
| empty name | Spacer. Songs end with one or more of these before the next title. |

Tags and colours inside section names are the user's own cues and are **displayed as-is, never acted on**:

| Tag | Colour | Meaning (handled by the user's clip follow actions, not by us) |
| --- | --- | --- |
| `[V]`, `[V4]` | yellow | vamp / loop |
| `[N]`, `[N32]` | green | go to next (automatically after 32 bars) |
| `[S]`, `[S2]` | red | stop after x bars |
| — | purple/pink | prep and count-in (READY, COUNT IN) |

**Song extent:** from the scene after its title up to (not including) the next `* ` scene. Of the trailing empty-named scenes, **the first one is kept** as the song's last row, because the user sometimes launches it to end a song (it hits the stop buttons). Any further trailing empty scenes are hidden. Empty-named scenes in the middle of a song are shown too. No end marker is needed.

**Timing track:** the **last regular track** — the one immediately left of Master in the screenshot (named "CLIC…"). In each section's row it holds a clip whose **loop length** defines the section length. The clip may be empty or audible (the user's click; READY and COUNT IN rows play audible ready and count-in cues). Only the clip's loop length and play position are read, never its audio, and READY and COUNT IN get bar lines and progress like any other row. Bars = loop length in beats ÷ beats-per-bar, using the scene's time signature if the scene has one set, otherwise the song's.

The timing clips carry the same follow actions as the music (user confirmed), so the timing track's playing/fired slots are the **source of truth** for which section is playing, which is queued, and the bar counter.

Screenshot reference of a real set: user attachment `1000038323.png` (RISE, HOW DEEP, GIVING YOU…, `[[ DINNER ]]`).

## What the user sees

Validated mockups: layout "B + C's setlist" (big full-width list + setlist sidebar).

**Header row:** sidebar toggle · ◀ previous song · current song title (centred, `* ` prefix stripped) · next song ▶.

**Setlist sidebar** — slides in/out (toggle). Contains:
- **Category filter pills** at the top (`All` + one per category).
- The song list grouped under category headings. Songs before the first category go under no heading. *(my call)*
- Tapping a song, or ◀/▶ in the header, **only brings that song's scenes into view**. It never launches anything and never interrupts playback.

**Scene list** — the current song's section scenes as full-width rows, in set order:
- Background = the scene's Live colour; label = the scene's exact name.
- Rows are as tall as possible while fitting the whole song in view; below a minimum touch height (~44 px) the list scrolls instead.
- **Bar lines** across each row from the timing-track clip length, thin per bar and thicker every 4 bars. Rows with no timing clip show no bar lines.
- **Progress:** while a scene plays, a darker shade of its own colour sweeps left→right across the row, snapped to musical position (not a free-running timer), with a `bar / total` counter (e.g. `11 / 32`).
- **Playing** scene: solid white outline. **Queued** (launched, waiting for quantisation): dashed white outline.
- Tap a row → launch that scene (Live's `fire`, so global quantisation applies exactly as clicking the scene in Live).
- Tapping the scene that's already playing **restarts it, like Live** (user's decision).

**No automatic jumps:** the view never changes song on its own. If the playing scene belongs to a different song than the one on screen, a **"Now playing: SONG"** banner appears; tapping it brings that song into view.

**Touch safety (anti-goal 1):**
- A launch fires only on a clean tap: pointer down and up on the same row, movement under ~10 px, held under ~500 ms. Scrolling or dragging never launches.
- Multi-touch gestures never launch.
- Empty-named rows are tappable (the user uses them to end songs). They show as grey rows labelled **■ End** so they can't be mistaken for a section. *(label is my call)*
- Each screen has a **lock** toggle that disables launching on that screen (for a phone in a pocket or a bandmate who should only watch). *(my call)*

**Look:** dark background like Live; Poppins font, bundled locally (gigs may be offline).

## Where it runs

- **Inside Live:** a Max for Live device (MIDI Effect) dropped on any track. It has a small in-rack panel with an "Open" button and the server address. "Open" shows a resizable, full-screen-capable window showing the UI.
- **In a browser:** the same UI at `http://localhost:<port>` on the laptop, or `http://<laptop-tailscale-name>:<port>` from a phone/tablet on the user's tailnet.
- Several screens can be open at once. **Each screen browses independently** (its own current song, sidebar state, lock). Playback state is shared because it comes from Live. *(my call)*
- **Network access (user's decision):** reachable from localhost, the tailnet, and anyone on the local network. Everything except localhost requires **HTTP basic auth** (username/password set in the device). Note: on the local network that is plain HTTP, so the password isn't encrypted in transit; over Tailscale it is.
- Target: Live 12 Suite (Max for Live included) on Windows. No extra installs.

## How it's built (decided)

- Max for Live device. The **UI is a web page**: shown inside Live in a Max `jweb` window, and served to browsers by a small HTTP + WebSocket server running in **Node for Max** (`node.script`) inside the device. One UI codebase for both.
- The device reads and observes the Live set through the Live API and launches scenes through it.
- **Risk:** touch inside `jweb` on Windows may arrive as emulated mouse events. Spike this early. If it's unreliable, the main laptop surface becomes a full-screen browser window (e.g. Edge app/kiosk mode) at `localhost`, and the `jweb` window stays as a convenience. *(my call)*

## Left to the builder

- Port number and how it's shown/changed.
- Exact LOM observation strategy (scene names/colours, scene list changes, the timing track's playing/fired slot indexes, clip loop length, playing position) and update throttling to the clients. It must pick up renamed/recoloured/added/moved scenes while running.
- How "playing" and "queued" are determined for scenes without a timing clip.
- Window management for the jweb window, persistence of window size, and whether the server starts on device load.
- Visual polish within the mockups' direction; contextual class names on UI elements alongside any utility classes.
- Tests and how to exercise the UI without Live (e.g. a fake set feed).

## Non-goals (v1)

- Acting on `[V]` / `[N]` / `[S]` tags or creating follow actions — the user's clip follow actions already do this.
- Editing the set, renaming or reordering scenes.
- Transport controls (play/stop all/tempo).
- Replacing the earlier SceneNav prev/next device in this repo; both can coexist.
- Authentication beyond basic auth (no per-user accounts or permissions).

## Phase 2 (requested, design pending): in-ear mix pages

Pages in the same web app where each musician controls their own in-ear mix. One page per send master (return track). Each page shows a send level for every channel feeding that return. Where channels are in a group, it shows only the group's send. Built into the same device as scene control, sharing its server, auth and UI shell. *(my recommendation, awaiting confirmation)* Details to be designed after Phase 1 is agreed.
