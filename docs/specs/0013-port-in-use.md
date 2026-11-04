# 0013 — Port already in use

Date: 2026-11-04 · Status: approved (user, 2026-11-04: "Next free port")

## Problem (user report, Windows, larger set)
The device "grabbed a port that was already taken" and Windows never prompted to allow Node through the firewall.

Today `setlist-server.js` calls `app.listen(config.port)`. On failure it only `max.post`s to the Max console. The panel stays on "Starting Setlist Touch…". Settings are served by that same server, so the admin can't fix the port from the UI. The firewall prompt never appears because Node never listens on a non-loopback address.

Windows has a second trap. Binding `0.0.0.0:8765` can **succeed** while another process holds `127.0.0.1:8765` (or another specific address) without exclusive use. `localhost` then reaches the other program, so jweb shows the wrong app and nothing errors.

## Behaviour (user decision: next free port)
1. **Detect busy, including the shadowed case.** A port counts as busy if:
   - bind fails, or
   - after binding, a loopback request to `127.0.0.1:<port>` does not reach this server.
   Prove reachability with a per-process nonce endpoint or header, so another program answering on loopback counts as busy.
2. **Fall forward.** If the configured port is busy, try the next ports in order (`port+1` …, a bounded number of attempts, e.g. 20, never above 65535). Use the first that passes check 1.
3. **Persist.** Save the port that worked to config.json, so phones keep a stable address next time even if the old port frees up. Never overwrite a damaged or unreadable config (0009 rule): in that case use the port in memory only and say so.
4. **Tell the user on the panel**, not only the Max console:
   - fallback: `Port 8765 was busy — now on 8766` plus the usual phone address
   - nothing free within the attempts: `Ports 8765–8784 are busy. Close the other program or set "port" in config.json, then reload the device.`
   - The web settings page shows the same fallback note once it loads.
5. **Settings port change** (already binds before save, 0002) uses the same busy check, including the shadowed case. It does **not** fall forward: the admin asked for a specific port, so it reports it as busy.
6. **README:** explain the fallback. Add a firewall note: Windows prompts only on first listen for a given `node.exe` path. If a rule was made earlier (allowed or blocked), there is no prompt. Check Windows Security → Firewall → "Allow an app through firewall" for Max's `node.exe`. Also show how to find who holds a port: `netstat -ano | findstr :8765`, then `tasklist /fi "pid eq <PID>"`.

## Non-goals
- Killing or identifying the other program from inside the device.
- Changing the default port.
- Creating firewall rules automatically.

## Anti-goals
- The panel stays on "Starting…" with no explanation.
- The device silently serves on a port where `localhost` reaches another program.
- A damaged config gets overwritten.

## Added 2026-11-04: Open button does nothing (user report)
The device's **Open** button has never opened the window on the user's machine. Current chain (`build_device.py`):
`live.text` (mode 0) → `sel 1` → `showwindow` → `p touch-window` → `js touch-window.js` sets `this.patcher.wind.visible`.

Suspected causes:
- in button mode `live.text` may output a bang, which `sel 1` never matches
- setting `wind.visible` from js inside a device subpatcher may not open the window

Fix:
- Open fires on any output from the button.
- Open the subpatcher through the standard `pcontrol` → `open` into `p touch-window`.
- Still send `showwindow`/bang to `touch-window.js` so the jweb resizes.
- Bring the window to front if it is already open.
- Keep the build deterministic.
- Add a test that inspects the generated patch wiring: the Open path reaches a `pcontrol` that is connected to the window subpatcher.
