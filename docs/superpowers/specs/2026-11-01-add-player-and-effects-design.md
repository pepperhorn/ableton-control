# Add player and effects in in-ear mixes (Setlist Touch)

Date: 2026-11-01 · Status: approved (user, 2026-11-02: "build it")
Ledger: 0011
Builds on: in-ear mix pages (0002), large-set work (0005, 0007), band members and access (0009), all merged under `setlist-touch/`.

## Intent
Setting up a new player today means working in Live: create a return, name it, route it to the right interface output, then add them in admin. The user wants one form in the web UI that does all of it, so every player is routed correctly.

Players also want to hear effects in their ears, for example wet vocals, using the band's existing reverb and delay.

## Goals (user)
- From the web UI, add a player by name and their mix send. If the send doesn't exist it's created; if it does, it's linked.
- The form names the send, scopes the player to it, and assigns the Ext. Out on the interface.
- Each player can add the already-set reverb or delay to their send, so they hear effects in their mix.

## Decided by the user
- Returns A and B stay the stock shared effects. A player gets more or less of the house reverb or delay; there are no per-player reverbs.
- 2-track output is out of scope for now.

## Add player
- **Where:** a form on the admin page (`#admin`, from 0009).
- **Fields (my call):** player name; send name, which starts as the player name and can be changed (for example `Horns IEM`, or two players sharing one mix); Ext. Out output, chosen from what Live offers.
- **Existing member:** picking a name that's already a member updates that member and adds the mix. It never creates a duplicate.
- **Result:** the device creates a return named exactly as entered, or links an existing return with that name; sets its output; adds the member with `monitor` and that mix (the 0009 default). If access control was off, adding the member turns it on, as 0009 defines.
- **Existing return:** its routing is shown and only changes if the admin picks a different output. A return routed to Main can't be linked as a player; the form says so.
- **Output choices:** read from Live for a return track: output type list, then channel list. Only external outputs are offered. If none are available, the form explains that outputs must be enabled in Live's audio preferences.
- **Outputs already in use:** shown with the return using them, not hidden, because two players may share a pair (my call).
- **Failure (my call):** a clear message and no half-finished player. If routing fails after the return is created, the return stays and the member isn't added. The form tells the admin to set that return's output in Live, then press Add again, which links it. Until then the return is on Main, so it shows as an effect row; that's accepted for this rare case. The form never re-routes a return that's on Main, so it can't convert the house reverb.
- **Limit:** Live allows 12 returns. At the limit, the form says so.

## Effects in a player's mix
- **Which returns count:** a return routed to Main is an effect. A return not routed to Main is a player. This is the existing rule from 0002.
- **Display:** each player's tab gets one fader row per effect (for example `A-Verb`, `B-Delay`), after the track rows, marked as effects. It controls that effect return's send to the player's return.
- **Default level:** off, until someone raises it. Nothing changes in anyone's ears on its own.
- **Same fader behaviour** as track rows: horizontal slide, relative, tap never changes a level, lock respected, Live's value text at the right, two-way sync.
- **Same permission:** having a player's mix permission covers its effect rows.
- **A return's send may be disabled in Live (user decision, 2026-11-02):** the user manages this in Live's UI. The app doesn't detect it and shows no note. A fader on a disabled send moves but has no effect until the send is enabled in Live. The README says so.
- **No feedback loops, by construction:** only effect → player sends are ever written. Player returns never send anywhere, and effect → effect sends are never exposed.

## Safety
- **Set-changing actions are admin only** and refused for everyone else with 403. This is the first feature that changes the user's set.
- **While Live is playing:** the form shows a warning and asks for a second confirmation (my call). Adding a return during a show shifts send layout and restarts the mix re-read.
- **Nothing is ever deleted or removed from the set.** Removing a member doesn't touch their return.
- **Undo:** the whole add is one undo step in Live where the API allows it.
- **Existing send safety stays:** any change to the return list fails closed for fader writes until the mix re-read finishes (0007).

## Also included
Item 0010: a server restart resets a player's saved mix tab, which can land them on someone else's mix. The new tab logic touches the same code, and the risk grows as more players are added (my call). The other two 0010 items (damaged-config warning wording) are included too.

## Non-goals
- 2-track output.
- Per-player reverbs or per-player reverb send levels.
- Changing a track's send to an effect from a phone: it would change the front-of-house sound.
- Deleting returns, tracks or members' returns from the web UI.
- Starter levels or copying another player's mix.

## Anti-goals
- A phone fader changes what the audience hears.
- A half-created player that looks finished.
- An effect row that writes to the wrong player's return.
- Anything here stutters Live, or blocks during a show without warning.

## Constraints
- Same stack: ES5 Max `js`, Node 16+ built-ins only, deferred writes, per-tick budget from 0005 (≤ 150 LiveAPI operations per tick).
- Live writes happen on the deferred path and re-check targets at the final boundary, as `send` does.
- Reads of the output lists happen only when the admin form is open, not on startup.

## Risks (user checks in Live after the build)
From memory of Live's API, not tested in the user's set. The user chose to build without a separate throwaway check first, so the build must fail safe on each of these:
1. `create_return_track` on the song, setting a return's name and `output_routing_type` / `output_routing_channel`, and `available_output_routing_types` / `..._channels`.
2. Whether `mixer_device sends` on a return track is readable and writable.
3. Whether undo steps can be grouped.
4. How a return's `sends` are indexed: if its own slot is skipped, effect sends can't use the positional scheme track sends use, and could write to the wrong player. If the mapping can't be proved, the row isn't offered.
5. Whether Ext. Out channels can be read before any return is on Ext. Out, without changing the set (for example from `master_track`). If not, the form creates the return first, then offers channels.
6. A create, name and read-back round trip: does Live report the name exactly as entered, or with a letter prefix? Return names identify mixes in 0009 permissions. If a prefix appears, matching must normalise it.

## Left to the builder
- Exact routes, messages and event shapes, following existing patterns.
- The form's layout, with contextual class names (`add-player`, `add-player-output`, `add-player-warning`, `mix-effect-row`) and Poppins.
