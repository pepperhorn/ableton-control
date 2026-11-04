# 0014 — Click the device's address to copy it

Date: 2026-11-04 · Status: approved (user request: "clicking the http link should copy it to clipboard")

## Behaviour
1. Clicking the address text on the Setlist Touch device panel copies the phone URL (`http://<ip>:<port>`, the URL line only, never the port-fallback note) to the system clipboard.
2. The panel confirms with `Copied: http://…` for about 2 s, then restores the normal text. That includes any port note, and the indexing progress if indexing started meanwhile.
3. While the server hasn't started or failed to start, a click copies nothing and the text stays.
4. Clipboard write from Node built-ins only:
   - Windows `clip.exe`, writing UTF-8 text with no trailing newline
   - macOS `pbcopy`
   - no shell string interpolation
   - spawn with an args array and write to stdin
   If the copy fails, the panel shows `Couldn't copy — address: http://…` and logs to the Max console.
5. Clicking the message box must not send its displayed text anywhere else, e.g. into `route` or as a command.

## Non-goals
- Copy buttons in the web UI.
- Listing several addresses (Tailscale first): a separate possible item.

## Live / Windows checks
- Click copies; paste in a browser works.
- The confirmation shows and then reverts.
- No console errors.
