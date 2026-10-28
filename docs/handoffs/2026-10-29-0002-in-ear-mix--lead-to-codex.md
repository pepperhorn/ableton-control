# Handoff: 0002 — In-ear mix pages (lead → codex)

- **Date:** 2026-10-29
- **Type:** dispatch
- **Ledger:** 0002 · **Spec:** docs/superpowers/specs/2026-10-29-in-ear-mix-design.md · **Plan:** docs/plans/0002-in-ear-mix.md (T1 → T2 → T3, in order, one worktree)
- **Branch:** orch/0002-in-ear-mix · **Worktree:** created by T3
- **PR:** (opened by implementer)
- **Base commit:** (filled in at dispatch, main after 0001 merges)
- **Port (if running a server):** 5220 (`SETLIST_TOUCH_PORT=5220 node device/dev.js`)
- **Status:** open

## Goal
Add in-ear mix pages to the Setlist Touch web app. Each player has a tab, and each tab has one fader-bar row per `+ `-tagged track or group, controlling that track's send to the player's return in Live. Every screen stays in sync, and accidental changes are impossible. Done means the plan's acceptance criteria are met, `npm test` passes, and a draft PR is open.

## Context you need
- The spec (the what and why) and the plan (files, interfaces, tests): see the links above.
- Phase 1, the code you're extending: `setlist-touch/` (merged from PR #1) and its spec, `docs/superpowers/specs/2026-10-29-setlist-touch-design.md`. Follow its patterns: dict snapshot + small messages, SSE, POST validated with 409, pure modules tested with `node --test`.
- The user's set (track names and colours): `/home/shaun/.t3/userdata/attachments/2a1726d4-33d1-42ae-ac20-afd6d5fa81e7-799a177d-5b60-4de4-9543-b4ed559e8a37.png`
- Validated look: mockup option B. The row is the fader, filled from the left in the track's colour, with the name at the left and Live's value text at the right, on a dark background.

## Scope
- **In:** plan T1–T3.
- **Out:**
  - mute, solo and pan
  - presets
  - per-player permissions
  - metering
  - automation handling (the user confirmed no in-ear sends are automated)
  - any change to phase 1's scene behaviour
- **Files you own:** the union of the plan's T1–T3 **Owns** lists, plus your handoff files for key `0002`.
- **Do not touch:**
  - `setlist-touch/device/lom.js`
  - phase 1 parse, progress, auth and config modules (except where the plan lists them)
  - root `device/`, root `README.md`
  - `docs/` outside your handoff files

## Acceptance criteria
- [ ] Plan T1, T2 and T3 acceptance are met.
- [ ] `cd setlist-touch && npm test` passes, including all phase 1 tests.
- [ ] Code works on Node 16, with zero npm runtime deps. `mix.js` is ES5.
- [ ] Every new UI element has a contextual class name, and Poppins is used, as in phase 1.
- [ ] Headless browser screenshots (phone and laptop sizes) are attached to, or described in, the PR.

## Verify with
```bash
cd setlist-touch && npm test
python3 device/build_device.py && python3 -c "import json;json.load(open('device/SetlistTouch.maxpat'))"
SETLIST_TOUCH_PORT=5220 node device/dev.js   # then check the UI with a headless browser at http://localhost:5220/
```

## Known gotchas / decisions already made
- Tracks are included only by the `+ ` prefix (plus and a space). There's no automatic hiding by audio or group level. Grouped child tracks can be tagged individually.
- Returns are included when they're not routed to Main ("Main" in Live 12, "Master" earlier).
- Anyone can change anyone's mix (user decision). The lock toggle also locks faders.
- Moves are relative, horizontal only and single-pointer. A tap never changes a level.
- The phase 1 timing track is unaffected: the user confirmed there's an empty track immediately before Main.
- GBrain: no project pages yet for m4l-control.

## Open questions
None.

---
## Receiver ack

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
