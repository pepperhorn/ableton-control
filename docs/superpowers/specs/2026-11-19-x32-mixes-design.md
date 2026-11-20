# X32 in-ear mixes, upcoming scenes and personal links (Setlist Touch)

Date: 2026-11-19 · Status: approved (user, 2026-11-20: "Go. Build it")
Builds on: in-ear mix pages (0002), Monitor and band access (0008, 0009), add player (0011), port fallback and copy address (0013, 0014). All are merged under `setlist-touch/`.

## Intent
The band wants one web page on each musician's phone that shows the upcoming scenes and controls that musician's own in-ear mix. Today the in-ear mixes are Ableton return tracks. The band's interface is a Behringer X32, so the mixes should live on X32 mix buses, the way Behringer's own apps (X32-Q, Mixing Station) do it. The difference from those apps is that scenes and mixes are in one web app, behind the same members and permissions as Setlist Touch.

## The gig setup (user)
- An Apple router is plugged into the X32's Ethernet port, and the X32 is a client of that router. The laptop (Ableton + Setlist Touch) and every phone join the router's Wi-Fi. There's no Tailscale and no internet.
- Joining the Wi-Fi needs the router's password, and that is the real access gate.
- Phones open the laptop's address in a browser. There's no PWA or app install (user decision). The address is shared by copying it from the device panel (0014).

## Goals
1. **Upcoming scenes.** On the Monitor tab, in large text, show the current scene with N scenes before and after it. Each one shows its Ableton name, its Ableton colour, and its bar count when known. N is set in a system setting for before and after separately. The default is 2 before and 2 after.
2. **X32 mixes.** Each member is assigned an X32 mix bus. Their mix page controls the send levels into that bus on the X32, plus the bus master level.
3. **Personal links.** `http://<laptop-ip>:<port>/<member-slug>` (e.g. `/shaun`) opens straight into that member's view without the name picker.
4. **Optional password.** A blank band password means phones on the LAN can connect with no login.

## Decided by the user
- **Mixes run on X32 mix buses, not Ableton sends**, "like you would with the Behringer apps".
- **Mix page layout:** X32 channels in a horizontal scroll, desk style. Each strip has the name and a fader. **Show/hide:** a hidden channel is dimmed and moved to the end of the list until it is activated again. **The musician's bus master is always the first strip and is sticky:** it stays put while the others scroll.
- **Monitor tab:** full, large text with scenes before, the current one and the next ones, on its own tab. Touch lock is on by default. Admin can release triggering (launching scenes) to musicians by name.
- **Mix view:** a slim combined scene bar across the top, which each musician can hide.
- **Who they are:** an overlay on load to pick their name, saved as a cookie, expiring after 24 hours or on log out.
- **Scene window:** a system config option for how many scene labels to show before and after. Each shows the bar count if available, in Ableton scene colours. The default is 2 before and 2 after.
- **No PWA:** share the server IP.
- **Personal page per user**, e.g. `http://IP/shaun`.
- **Password is optional.** It stays basic HTTP auth when set. Users already need the access-point password to get on the network.
- **No Raspberry Pi for now.** The server stays inside the Live device.

## Approaches considered
1. **X32 control inside the existing Node server in the device (chosen).** The server already serves the phones and holds members and permissions. Node's built-in `dgram` speaks OSC over UDP to the X32. It can be tested against a fake X32, the way the fake Live bridge works today.
2. **Max `udpsend`/`udpreceive` in the device patch.** This would mean more patch wiring and would be hard to test, for no gain over 1.
3. **A separate program, or a Raspberry Pi, outside Live.** Phones could keep mix control if Live crashes. But the X32 keeps its mixes on its own anyway, the scenes still need Live, and it is a second thing to start at every gig. The Pi 1 and 2 are also a poor fit for current Node. Not now. The X32 code is kept in its own module so it could be lifted out later.

## Behaviour

### Upcoming scenes (Monitor tab)
- **Settings:** two system settings, scenes before (0–8) and scenes after (0–8). Both default to 2. They live in admin and apply to every phone.
- **The list:** a vertical list with the current scene in the middle.
  - The current scene is largest, with its progress bar and `bar / total`.
  - Earlier scenes are dimmed. Later ones are at normal weight.
  - The queued scene keeps its existing flash (0008).
- **Each row:** the scene's exact name, its Ableton colour, and its bar count (`8 bars`) when the timing track gives one (0006). The bar count is left out when there isn't one.
- **Song edges:** the window stops at the current song's edges. It never shows a category row or another song's sections. The `■ End` row (0001) counts as a scene. Near the edges, it shows fewer rows rather than padding.
- **Large text:** the Monitor tab is sized to read from a mic stand. Rows use large type, and the current scene is largest.
- **Touch lock on by default:** the Monitor tab opens locked. Unlocking uses the existing lock control (0001).
- **Launching from Monitor:** while unlocked, tapping a row launches that scene, with the same clean-tap rules as Scenes. This only works for members admin has released triggering to. Admin does this per member by name, using the existing scene-launch permission (the `scenes` page permission in 0009, labelled "Can launch scenes" in admin). Everyone else's Monitor stays read-only, unlocked or not.
- **When nothing is playing:** keep the existing Monitor states ("Stopped", "Playing" with no tracked scene). Showing a window around the selected scene when stopped is left to the builder (see below).

```
  [V2] Verse        8 bars    (dimmed)
  [C1] Chorus       8 bars    (dimmed)
▶ [V3] Verse     3 / 8 ▓▓▓░░░
  [C2] Chorus       8 bars
  [B]  Bridge       4 bars
```

### Mix source setting
- **Setting:** a system setting chooses the mix source, **X32** or **Ableton returns**.
  - New installs default to X32.
  - An existing config that has members with Ableton-return mixes stays on Ableton returns until admin switches.
  - The Ableton returns mode (0002, 0011) keeps working unchanged.
- **One source at a time.** Pages, permissions and faders follow the selected source.

### X32 connection
- **Finding the desk:** the server discovers the X32 on the LAN, the way the Behringer apps do (`/xinfo` on UDP 10023, broadcast). Admin can also enter or override the X32's IP, and a manual IP wins over discovery. The last good IP is saved.
- **Staying subscribed:** the server keeps the desk's update subscription alive (`/xremote`, renewed well within the desk's ~10 s window) so desk-side changes reach phones.
- **Reading from the desk:** names, colours and levels are read from the desk. Phones never talk to the X32 directly.
- **Status:** shown in admin and on mix pages: connected, searching, or lost, with the IP.
  - When the connection is lost, mix faders are disabled until the server has fresh values from the desk. This is the same fail-closed rule as 0007.
  - The server reconnects on its own.
- **Desk state is the source of truth.** The server never pushes saved levels to the desk on connect. It only reads them.

### Assigning a bus
- **Per member:** admin assigns each member one X32 mix bus (1–16), or none. Two members may share a bus.
- **Stereo-linked pairs:** if the desk has the bus linked to its partner (e.g. 5/6), it shows as one mix named after the odd bus. Writes go to whatever address the desk uses for a linked pair (left to the builder; see below).
- **Permissions:** a member's mix permission in X32 mode is the list of buses they may control. By default that is their own bus. Admin can grant more, as with today's mixes.
- **Personal page tabs:** the mix page shows one tab per bus the member may control. Their own bus comes first.
- **Admin:** sees and can edit every bus. To edit a member's view, admin picks the member, then one of their buses, and edits that member's hidden list. *(Lead's call.)*
- **Buses that feed the PA:** if an assigned bus is routed to Main LR on the desk, admin sees a warning on the assignment. It isn't blocked: admin chooses the buses. *(Lead's call.)*

### The mix page in X32 mode
- **Layout:** strips in one horizontal row that scrolls sideways.
- **First strip:** the member's bus master. It is labelled with the bus name from the desk, or `BUS 5` if unnamed. It is always first and sticky at the left edge. It controls that bus's master fader.
- **Other strips:** one per X32 source that can send to a mix bus. That is inputs 1–32, aux ins 1–8 and FX returns 1–8, in desk order.
  - Each strip shows the scribble-strip name and colour, a vertical fader, and the level as dB text.
  - Sources with no name on the desk start hidden.
  - FX returns are how a musician adds the house reverb or delay to their mix.
- **Show/hide:**
  - Each strip has a hide control. A hidden strip is dimmed and moved to the end of the row. Its fader is inert until the strip is shown again.
  - Showing it returns it to its desk-order place.
  - Hidden lists are per member, per bus. They are saved on the server, so they follow the member to any phone.
  - Admin viewing someone's bus sees that member's hidden list.
- **Fader behaviour (carried over):**
  - A tap never changes a level. Movement is relative to where the fader was.
  - The lock is respected.
  - Values sync both ways.
  - A moved fader holds its value briefly against echoes, as 0002 does today.
- **Scroll versus fader:**
  - A drag that starts mostly sideways scrolls the row, even if it starts on a fader.
  - A drag that starts mostly vertical on a fader moves that fader.
  - The direction is decided once, early in the gesture, and holds until release.
- **Desk-side changes:** a change made on the desk, or in another app, to a level, name or colour shows on every phone that has that bus open.

```
┌─────────┬────┬────┬────┬────┬─ → scroll
│ SHAUN   │KICK│SNR │BASS│KEYS│ …  ░VOX2░ (hidden, dimmed)
│ BUS 5   │    │    │    │    │
│   ┃     │ ┃  │ ┃  │ ┃  │ ┃  │
│   █     │ ┃  │ █  │ ┃  │ ┃  │
│   ┃     │ █  │ ┃  │ █  │ █  │
│ -6.0    │-12 │-3.5│-8  │-10 │
└─sticky──┴────┴────┴────┴────┘
```

### Scene bar on the mix view
- **What it shows:** a slim bar across the top of the mix page with the current scene and its `bar / total` progress, then the next one or two scenes with bar counts, in Ableton colours. It is read-only and never launches anything.
- **Hiding it:** each musician can hide or show it with a toggle on the mix page. The choice is saved on that phone in local storage, because it's a display preference only.
- **Faders:** the strips use the height left below the bar. They get the full height when it is hidden.

```
┌ ▶ [V3] Verse 3/8 ▓▓░  → [C2] Chorus 8 ┐  [hide]
├─────────┬────┬────┬────┬─ → scroll    │
│ SHAUN   │KICK│SNR │BASS│ …            │
│  faders …                             │
```

### Who they are (name picker)
- **Today (0009):** a "Choose your name" overlay appears on first connect. The choice is saved in a signed, HttpOnly cookie for a year, and there's no log out.
- **Change:**
  - The overlay appears on load whenever the phone has no current identity. It lists member names as large buttons.
  - The choice is saved in the same signed cookie, now **expiring after 24 hours**. The server must read identity on every request and on the live connection, so a cookie fits, not local storage.
  - The server checks the expiry, not only the browser.
- **Log out:** a "Log out" control, shown with the member's name in the page header or menu, clears the cookie and brings back the overlay.
- **Personal link:** `/<slug>` sets the same 24-hour cookie and skips the overlay.

### Personal links
- **Address:** `/<slug>` opens the app identified as that member. It does the same as choosing that name in the picker: it sets the existing member cookie, then shows the member's default page.
- **Slugs:**
  - The member's name in lowercase, with runs of non-alphanumerics turned into `-` (`Keith Ray` → `keith-ray`).
  - Admin refuses a new member name whose slug is empty, collides with another member's slug, or collides with an app route (`admin`, `api`, `js`, `css`, `fonts`, `settings`, `diagnostic`, and any other existing top-level path).
  - Renaming a member changes their link, and admin shows the current one.
- **Admin page:** lists each member's full link (IP and port as shown on the panel), with a copy button.
- **Unknown slug:** falls back to the normal page with the name picker.
- **Plain `/`:** works as today.
- **Honour system, as today:** anyone on the network can open anyone's link.
- **Identity with member access off:** a personal link, or a name picked in the overlay, still records who the musician is when member access restrictions are off. Permissions then stay fully open, as today. Identity is still used for their own bus first, their hidden lists and the Log out label. *(Lead's call.)*
- **Admin sign-in survives links:** on a phone with an admin session, opening a personal link keeps admin. It sets the member identity only for display (which bus comes first, which hidden list). *(Lead's call.)*

### Optional password
- **Explicit switch, off by default:** a new admin setting, "Allow phones without a password", decides whether a blank password lets LAN clients in. With the switch off, a blank password keeps today's 403, so existing installs don't open up when they update. *(Lead's call.)*
- **Blank password with the switch on:** LAN clients can connect without credentials. This replaces today's 403 "Set a password in Setlist Touch settings on the laptop." Admin still requires the laptop (loopback) or the admin password, as in 0009.
- **Password set:** HTTP basic auth, as today.
- **README:** say plainly that with no password, the router's Wi-Fi password is the only gate.

## Non-goals
- PWA or app install, HTTPS, Tailscale use.
- A Raspberry Pi or other separate host.
- Pan, mute, EQ, sends on/off, or any control other than send level and the member's bus master.
- Controlling Main LR, matrices, DCAs, or any bus a member isn't permitted.
- Editing names or colours on the desk from the app.
- Saving or recalling mix snapshots. The desk's own scenes handle that.
- Other Behringer/Midas desks. M32/X32 variants that speak the same OSC may work but aren't targeted.

## Anti-goals
- A phone changes what the audience hears (Main LR, or any bus that feeds the PA).
- A fader writes to the wrong bus or the wrong source.
- A sideways scroll moves a fader.
- Phones show stale levels as if live after the desk connection is lost.
- Anything here stutters Live or blocks the show.

## Constraints
- **Same stack:** Max for Live device with Node for Max. Runtime code uses Node built-ins only and must run on Node 16+. Max `js` stays ES5. No npm dependencies.
- **Live:** X32 traffic must not touch the LiveAPI budget (0005). It runs in Node, not Max `js`.
- **Fake X32:** a fake X32 for `node --test` and for `dev.js`, like the fake Live bridge.
- **UI:** contextual class names (`scene-window`, `mix-strip`, `mix-strip-master`, `mix-strip-hidden`, `member-link`) and Poppins.

## Left to the builder
- **OSC details.** Exact addresses, value scaling (the X32's 0–1 fader law to dB text) and linked-bus write addresses, from the X32 OSC reference (the unofficial Maillot "X32/M32 OSC Remote Protocol" document). State each assumption in the return handoff as a check on the real desk.
- **Rates.** Throttling and coalescing of fader writes and of fan-out to phones.
- **Stopped transport.** Whether the scene window centres on the selected scene when transport is stopped.
- **Admin layout** for the X32 settings, bus assignment and member links.
- **Page names** where the existing ones still fit ("My mix").

## Risks (checks on the real X32 after the build)
1. Discovery by broadcast on the Apple router. The manual IP is the fallback.
2. `/xremote` renewal timing and the volume of updates while someone moves faders on the desk.
3. Linked-bus behaviour and addresses.
4. Fader law and dB text match what the desk shows.
5. Many phones moving faders at once: desk responsiveness.
