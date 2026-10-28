# Spec 0003 — Transport header (Setlist Touch)

Date: 2026-10-29 · Status: approved 2026-10-29 (user)
Builds on: Setlist Touch (0001) and in-ear mix pages (0002), both merged under `setlist-touch/`.

## Intent
The user plays the show from Session view while **Arrangement Record captures the whole show into Arrangement view**. They want Live's transport, including Rec, in the Setlist Touch header so they can start, stop and record from the laptop or any phone.

## Anti-goals
- A stray tap stops the band or starts or stops the recording.
- The transport shows a state that doesn't match Live.

## Behaviour (approved by the user)
- **Opt-in by address:** the transport row appears only when the page URL has the query parameter `transport=1`, e.g. `http://localhost:8765/?transport=1`. Without it, the app looks and behaves exactly as now. Each phone or laptop bookmarks the address it wants. It works on both the Scenes and My mix pages.
- **Play:** a normal tap starts Live's transport (`start_playing`).
- **Stop:** a **1-second press-and-hold** with a visible fill. Releasing early, moving off the button, or a second pointer cancels it. On completion it calls `stop_playing`.
- **Rec:** toggles **Arrangement Record** (`record_mode`) using the same 1-second hold, both to turn recording on and to turn it off.
- **Display:** a playing indicator, a red recording indicator, the tempo (e.g. `120.00`) and the song position as `bar.beat` from `current_song_time` and the song's time signature. Display updates are throttled to at most 10 per second. Changes made in Live itself show on every screen.
- **Safety:**
  - The per-screen **lock** locks the transport too.
  - The buttons are disabled while disconnected or before the first transport snapshot arrives.
  - Commands are validated server-side. Only `play`, `stop`, `record-on` and `record-off` are accepted, and record commands state the intended target state, so a duplicate or stale request can't flip it the wrong way.
- **Access:** any screen showing the transport, phones included, behind the existing auth.

## Non-goals
Tempo editing, metronome, loop, punch-in and punch-out, "Back to Arrangement", Session record, overdub and stop-all-clips.

## Left to the builder
- Whether the LiveAPI work goes in a new ES5 `device/transport.js` or in `lom.js`. A new file is preferred, to keep ownership clear.
- Exact SSE event and POST shapes. These follow existing patterns: a snapshot on connect, small updates, and validation with 409/400.
- Hold-fill styling within the existing look. Use contextual class names (`transport-bar`, `transport-play`, `transport-stop`, `transport-rec`, `transport-tempo`, `transport-position`, `hold-fill`).
