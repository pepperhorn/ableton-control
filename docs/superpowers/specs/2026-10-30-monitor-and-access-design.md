# Band Monitor tab and member access (Setlist Touch)

Date: 2026-10-30 · Status: approved (user, 2026-10-31: "Go for it")
Builds on: Setlist Touch (0001), in-ear mix pages (0002), transport header (0003), large-set work (0005, 0007), all merged under `setlist-touch/`.

This covers two pieces of work, built in this order:
1. **Monitor tab** (ledger 0008): a small, read-only page for players.
2. **Band members and access** (ledger 0009): names on first connect, and admin-controlled page access.

The Monitor tab must ship and work on its own, without part 2.

## Intent
The leader triggers scenes from the laptop while the band plays. Players need to see what is playing and what the leader has triggered next, on a phone at a glance, with no way of launching anything by accident.

The leader also wants a way to give each player only the pages they need, including keeping a player off another player's in-ear mix.

## Part 1: Monitor tab

### Goals (user)
- A separate tab from the trigger interface, so there are no accidental triggers. The user decided that separate tabs are enough for now; nothing has to stop a player switching tab.
- Shows the **current scene**: highlighted, with the bar count and progress when the section has a timing clip.
- Shows the **next scene** if it has been triggered, flashing.

### Behaviour
- **Tab:** a third page beside "Scenes" and "My mix", in the existing page switch, labelled "Monitor".
- **Current scene:** large, in the scene's Live colour, with its exact title.
  - With a timing clip: the `bar / total` counter and progress fill, using the same calculation and bar lines as the Scenes rows.
  - Without one: the title only.
- **Next scene:** appears only while a scene is queued (Live's `fired_slot_index`), in that scene's colour, flashing until Live moves to it. When nothing is queued the box is not shown.
- **Nothing playing:** a calm "Stopped" state, with no stale scene left on screen.
- **Scenes with no timing clip (my call):** the app only knows what plays through the timing track (the last regular track). If Live's transport is running but no timed scene is playing, show a neutral "Playing" state, not "Stopped", using the transport state that already reaches every browser. Known limit: if a scene with an empty timing slot and no stop button is launched, the old timing clip keeps playing and Monitor keeps showing the old scene. That can't be detected without a Live-side change, so it's out of scope here.
- **Connection lost:** the existing reconnecting bar. The screen must not keep showing a scene as playing once the connection is lost.
- **Read-only:** no element on this page launches anything. The page registers no tap handlers that reach `/api/fire`, `/api/transport` or `/api/send`.

### My calls (the user can overrule these)
- The song title (the most recent `* ` scene above the playing one) sits small at the top.
- Sized for a phone on a mic stand, readable at arm's length, in portrait and landscape. Poppins, with contextual class names (`monitor-page`, `monitor-song`, `monitor-current`, `monitor-next`, `monitor-counter`, `monitor-fill`).
- It always follows what Live is playing; there is nothing for a player to tap or choose.
- The transport row doesn't appear on this page, even with `?transport=1`.
- The flash is a slow pulse, not a strobe, and stays readable throughout. Respect `prefers-reduced-motion` by showing a solid highlight instead.
- The screen is kept awake with the Wake Lock API where the browser allows it. It needs a secure context, so it won't work over plain `http://` on a LAN or tailnet; failing silently is acceptable.
- The tab choice is remembered per device, as "Scenes" and "My mix" already are.

### Data
All of it already reaches the browser: scenes, `play` (playing and fired indexes) and `pos`. No Live or server change should be needed.

## Part 2: Band members and access

### Goals (user)
- One shared band password, as today. No per-member passwords.
- A player gives their name on first connect.
- An admin decides who has access to what, including limiting access to another player's in-ear mix page.
- The admin has access to all pages.

### Accepted limit
The name is an honour system. With a shared password, anyone can pick another name. This prevents mistakes and keeps people to their own pages; it doesn't stop a bandmate who deliberately pretends to be someone else. The user accepted this.

### Behaviour
- **Members list:** the admin keeps a list of member names. Each has permissions for:
  - `monitor`
  - `scenes` (the trigger page)
  - `transport`
  - each in-ear mix, by return name
- **New members default (my call):** `monitor`, plus the mix whose return name matches theirs exactly, ignoring case. Nothing else until the admin ticks it.
- **First connect:** after the band password, the player picks their name from the list. The device remembers it. A "Change name" control sits in settings.
- **Access control switch (my call):** a stored `accessEnabled` setting decides whether restrictions apply. It's separate from the list length, so an empty list can't remove restrictions by accident.
  - **Off (the default, and all existing config files):** nothing changes: no name prompt, and every page works as it does today.
  - **On:** it turns on when the first member is added, and it can only be turned off from the laptop.
  - **Last member removed:** access stays on, so phones go to the name picker with nobody to pick and see Monitor only. The laptop still has full control.
- **Damaged config (my call):** invalid `members` or `accessEnabled` values mean access on with no members, so it fails closed. Only that field is dropped; the password and port are kept, so a bad value can't lock every phone out mid-show.
- **Transport row (my call):** `?transport=1` stays as it is, a per-screen opt-in. The `transport` permission only decides whether that person can use it: without it, the row doesn't appear and the server refuses commands. Admin follows the same flag. `transport` is a capability, not a page, so it never appears in the page switch.
- **Blocked pages:** they disappear from that player's page switch. The server also refuses their commands, so hiding a button isn't the only protection:
  - `/api/fire` needs `scenes`
  - `/api/transport` needs `transport`
  - `/api/send` needs the mix for that return
  - refused commands return **403**
- **Live updates:** an admin change applies to connected players without a reload. If the page a player is on is taken away, they move to their first allowed page.
- **Removed member:** their device goes back to the name picker.
- **Renamed return:** the permission no longer matches, so it fails closed. The admin page shows a mix permission whose return no longer exists, so it can be fixed.

### Admin
- **The laptop running Live is always admin** (the existing trusted loopback rule, which includes the jweb window).
- **A separate admin password** lets the user do the same from a phone. The name picker has an "Admin" entry that asks for it. A player who knows the band password can't reach the admin page without it.
- **Admin sign-in from a phone:** the admin password is first set in settings on the laptop. Until then, phone admin isn't available. Once it's set, an "Admin" link appears in the name picker and in settings, so a phone can reach it even with no members yet.
- **The admin page** sits in the settings area and shows the member list, a tick box per permission, and add, rename and remove. Admin sees and controls every page.
- **What a phone admin can change (my call):** members and permissions only, through a new admin-only route. Port, band password, admin password and turning access off stay on the laptop, because changing them from a phone could disconnect the band with no way back mid-show. `/api/config` stays loopback-only, and the admin password is never sent to a browser.

### Technical direction
- **Identity:** after picking a name, the server sets an `HttpOnly`, `SameSite=Strict` cookie holding an HMAC-signed token (member id, or admin). It works with `EventSource` without extra code. The signing secret is generated once and stored in `config.json`.
- **Member ids:** stable generated ids, so renaming a member keeps their permissions and their devices.
- **Storage:** `members`, `adminPassword` and the secret go in the existing `%USERPROFILE%\Documents\SetlistTouch\config.json`, still written with mode `0600`. `validConfig` must accept old config files unchanged.
- **Admin password comparison:** constant-time, as `checkBasic` does.
- **Band password stays HTTP basic auth,** and it stays the first gate. Identity is a second layer on top of it.
- **Order of checks:** basic auth, then identity, then permission. Keep the existing 400/409 validation.
- **Read access:** a blocked mix's data may still reach the browser and be hidden there (my call). This is an honour-system feature, and every write is enforced on the server.
- **Node 16, built-ins only:** `crypto` covers everything needed. No new dependencies.

## Non-goals
- Per-member passwords or real accounts.
- Stopping a determined bandmate from impersonating another.
- HTTPS.
- Per-scene or per-song permissions.
- Footswitch support (0004) and Build timing clips (0006).

## Anti-goals
- A tap on the Monitor tab launches a scene.
- Monitor shows a scene as playing when it isn't.
- Adding access locks the leader out, or stops anything working mid-show. The laptop must always have full control, even if config or cookies are broken.
- Existing setups with no members behave differently.

## Left to the builder
- Monitor layout details within the behaviour above.
- Whether Monitor is a new module (preferred: a pure `monitor-view.js` plus a render module, tested with `node --test`).
- Exact shapes of the new API routes and SSE events, following existing patterns.
