# Setlist Touch phase 2 — in-ear mix pages — design

Date: 2026-10-29 · Status: approved 2026-10-29
Builds on: `docs/superpowers/specs/2026-10-29-setlist-touch-design.md` (phase 1, implemented on branch `feat/setlist-touch` under `setlist-touch/`)

## Intent

Each band member hears an in-ear mix fed from Ableton Live. Each mix is a return track named after the player (e.g. "Shaun", "Keith") whose output goes to an external hardware output, not back to Main. Today, changing someone's in-ears means someone at the laptop adjusting send knobs in Live.

Phase 2 adds mix pages to the Setlist Touch web app so **any player can adjust any player's in-ear mix from their phone** (or the laptop), mid-gig, without touching Live. It is mobile-first.

Success: a player opens the app on their phone, taps their name, and slides "+ CLICK" up a little. Their in-ears change immediately, and every other open screen shows the new level.

## Anti-goals

Carried over from phase 1 and applied to faders:
- **An accidental change.** Scrolling, tapping or brushing a fader changes a level. A sudden jump in someone's ears is worse than a wrong scene.
- **A jump.** A level leaps to wherever a finger lands rather than moving from where it was.

## How the set is encoded (user's convention)

**Which returns get a page:** every return track whose **output is not routed to Main** (the main/master track) is an in-ear mix. The user's set has Ret A (reverb) and Ret B (delay), both routed to Main, so they are excluded. The player returns that follow them (Shaun, Keith, …) send to external outputs only, so they are included. The tab label is the return track's name, and returns appear in set order.

**Which tracks get a fader (user's decision):** any track or group whose name starts with **`+ `** (plus and a space), e.g. `+ DRUMS`, `+ CLICK`, `+ CUE GROUP`. This is the only rule: no automatic hiding by audio or group level. A track inside a group can be tagged on its own (e.g. `+ Kick` inside DRUMS), and both then appear. The displayed name has the `+ ` stripped. Rows appear in set (left-to-right) order with the track's Live colour.

The user expects CLICK and CUE GROUP on every mix page, which they get by tagging them `+ `.

Phase 1's timing track is unaffected. The user confirmed there is an empty track immediately before Main, off-screen to the right of LIGHT in the screenshot, so "last track" is still correct.

## What the user sees

Validated mockup: option **B, "fader bars"**, at phone width.

**Page switch:** a "Scenes / My mix" switch at the top of the app swaps between phase 1's scene launcher and the mix pages. It uses the same address, password and lock.

**Player tabs:** one pill per in-ear return, scrolling horizontally if there are many. The active one is highlighted. Each screen remembers its last tab. *(my call)*

**Fader rows:** one full-width row per `+ ` track:
- The row is the fader. A fill in the track's colour runs from the left to the current send level. The track name is at the left.
- Live's own text for the value (e.g. `-4.1 dB`, `-inf dB`) is at the right.
- Minimum row height is 44 px, and the list scrolls vertically if needed.
- The level shown is the track's send to the selected return, i.e. the same knob as in Live's mixer.

**Live sync:** a change made in Live, or on another screen, updates every open screen. If someone else moves a fader while you are dragging the same one, your drag wins on your screen until you let go, and then the screen shows the latest level. Last write wins in Live. *(my call)*

**Touch safety:**
- A tap never changes a level.
- Only a horizontal slide moves a fader. A gesture that starts mostly vertical is a scroll and never moves a fader.
- Moves are **relative**: the level changes by how far the finger slides, starting from the current level. It never jumps to the touch point.
- Multi-touch never moves a fader.
- The phase 1 **lock** toggle also locks faders on that screen. *(my call)*

## How it's built (decided)

Extends the phase 1 device and app in `setlist-touch/`. There is no new device, server, port or password. LiveAPI work stays in `lom.js`, HTTP in `lib/app.js`, and UI in `web/js/`. It follows the phase 1 patterns:
- A Max dict for the full snapshot.
- Small messages for changes.
- An SSE event to clients.
- A POST that is validated against the current snapshot, returning **409** if the target changed (e.g. a track was renamed or moved between render and drag).

## Left to the builder

- Exact LiveAPI paths and observers. These cover:
  - return tracks: name, colour, output routing
  - tracks: name, colour, and their mixer sends for each in-ear return
  - set changes: tracks or returns added, removed or renamed
- How "routed to Main" is detected. Live 12 calls it "Main", and earlier versions call it "Master". Verify against Live's routing display names.
- Rate limiting of level updates in both directions, and how setting a value is deferred safely in Max.
- Drag sensitivity (how many pixels equal the full range) and any fine-adjust behaviour.
- Whether a 0 dB marker is useful. Live's send range tops out at 0 dB, so it may just be the right edge.
- Tests, fake mix data for `dev.js`, and visual polish within the mockup's direction, with contextual class names.

## Non-goals

- Mute, solo, pan, or the reverb and delay send amounts on the mix pages.
- Saving or recalling mix presets.
- Per-player passwords or restricting who can change whose mix. Anyone can change anyone's (user's decision).
- Changing the return tracks' own volume, routing or devices.
- Metering.
- Handling automated sends. The user confirmed none of the in-ear sends have automation or clip envelopes, so the faders simply set the send value.
