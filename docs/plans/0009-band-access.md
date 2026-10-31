# Plan 0009 — Band members and access

- **Spec:** ../superpowers/specs/2026-10-30-monitor-and-access-design.md (Part 2; Part 1 shipped as 0008)
- **Base:** main after 0008 merged
- **Verification (whole item):** `cd setlist-touch && npm test`

## Approach
A second layer on top of basic auth. A pure `lib/access.js` holds all permission logic: signing identity cookies and deciding what an identity may do. `lib/app.js` calls it on each request. The web app reads a small `me` snapshot and hides what's blocked. No Live, `.amxd` or Max change.

Order of checks in `handler`: `authorize` (basic auth / loopback) → origin check → resolve identity → permission → existing 400/409 validation.

**Tech:** CommonJS, Node 16+, built-ins only (`crypto`). Vanilla ES modules, `node --test`.

## Global constraints
- One shared band password stays. Identity never replaces basic auth.
- Trusted loopback (`isTrustedLoopback`) is always admin, whatever the config or cookies say.
- `accessEnabled` false (default, and all existing config files): behaviour is identical to today.
- The admin password and the signing secret are never sent to a browser.
- Refused commands return **403**. Existing 400/409 behaviour is unchanged for allowed callers.
- `/api/config` stays loopback-only.
- Contextual class names and Poppins, as elsewhere.

## Review focus
Each line gets a test in the owning task.
1. **Saving laptop settings must not wipe members.** `/api/config` POST today rebuilds `cfg` from `{port, username, password}` and `saveConfig` writes only what it's given, so a naive change deletes `members`, `accessEnabled`, `adminPassword` and `secret`.
2. **Tampered or stale cookie:** a bad signature, a member id that no longer exists, or a secret that changed all mean "no identity", never an error and never admin.
3. **Damaged config:** invalid `members` or `accessEnabled` fails closed for those fields only. Password and port are kept. A broken config still leaves the laptop fully in control.
4. **Permission change while connected:** a player with an open SSE stream and a phone admin session pick it up without a reload, and a removed member returns to the picker.
5. **Mix permission by return name:** a renamed return fails closed and shows as orphaned on the admin page. A send to a blocked return is refused even if the request's `returnName` is forged to an allowed name: resolve the return from `returnIndex` in the current `mix`.

## Shared types
```
Member   = { id, name, pages: ('monitor'|'scenes'|'transport')[], mixes: string[] /* return names */ }
Config  += { accessEnabled: boolean, members: Member[], adminPassword: string, secret: string }
Identity = { kind: 'open' } | { kind: 'admin' } | { kind: 'member', member } | { kind: 'none' }
Me       = { accessEnabled, kind, name|null, pages, mixes|'all', members: {id,name}[], adminAvailable }
```
`open` means access is off. `none` means access is on and this device hasn't picked a valid name: Monitor only, plus the picker.

## Tasks
A single dispatch (K = `0009`). The steps run in order in one worktree, because they share `lib/app.js` and `web/js/app.js`.

### T1 — config and pure access logic
- **Owns:** `setlist-touch/device/lib/config.js`, new `setlist-touch/device/lib/access.js`, `setlist-touch/test/access.test.js`, new or existing config tests
- **Config:** `loadConfig` validates the new fields separately, so a bad one doesn't reset the password and port:
  - both new fields absent: `accessEnabled:false, members:[]`
  - either one invalid: `accessEnabled:true, members:[]`
  - `adminPassword` invalid: `''`
  - `secret` missing: generate 32 random bytes as hex, and save on first use
- **`lib/access.js`:**
  - `sign(payload, secret) -> string`, `verify(token, secret) -> payload|null` (HMAC-SHA256, constant-time compare)
  - `identify({trusted, cookie}, cfg) -> Identity`
  - `can(identity, action, returnName?) -> boolean`, where action is `'fire'|'transport'|'send'|'admin'`
  - `meFor(identity, cfg) -> Me`
  - `newMember(name, returnNames) -> Member`: pages `['monitor']`, mixes the return whose name matches exactly ignoring case
  - `checkAdminPassword(given, cfg) -> boolean`: constant-time; `false` when no admin password is set
- **Tests:** review focus 2 and 3; `open` and `admin` can do everything; `none` can do nothing; member rights per action; default member; a token signed with another secret fails.
- **Acceptance:** `npm test` passes; old config files load unchanged.

### T2 — server routes and enforcement
- **Owns:** `setlist-touch/device/lib/app.js`, `setlist-touch/test/app.test.js`
- **Cookie:** `st_id`, `HttpOnly; SameSite=Strict; Path=/`, long-lived. No `Secure`, because it's plain HTTP.
- **Routes** (all behind basic auth):
  - `GET /api/me` → `Me`
  - `POST /api/identify {memberId}` → sets the cookie; 404 for an unknown member
  - `POST /api/admin-login {password}` → sets an admin cookie, or 403; rate limit to one attempt per second per address, as the band password could otherwise be tried freely
  - `POST /api/forget` → clears the cookie
  - `GET /api/members`, `POST /api/members` (admin) → the list, plus `orphanMixes` per member; POST replaces the whole list, validates it and saves. The first member sets `accessEnabled:true`. It never sets it false.
- **`/api/config`:** stays loopback-only. Add `adminPassword` (blank keeps the current one) and `accessEnabled` (loopback may turn it off). Merge into the existing `cfg` before saving, so members and secret survive.
- **Enforcement:** `/api/fire` needs `fire`, `/api/transport` needs `transport`, `/api/send` needs `send` for the return resolved from `returnIndex` in the current `mix`. 403 before the existing validation.
- **SSE:** add an `access` event with no payload, broadcast when members change. Clients re-fetch `/api/me`.
- **Tests:** review focus 1 and 5; each route's refusals; forged cookie; `/api/members` refused for a player and for `open`/`none` from a phone; loopback admin with a corrupt cookie; `access` broadcast; access off keeps every existing test passing untouched.

### T3 — web: picker, hidden pages, admin page
- **Owns:** `setlist-touch/device/web/index.html`, `setlist-touch/device/web/style.css`, `setlist-touch/device/web/js/app.js`, `setlist-touch/device/web/js/view-state.js`, new `setlist-touch/device/web/js/access-view.js`, new `setlist-touch/device/web/js/access-render.js`, `setlist-touch/test/access-view.test.mjs`, `setlist-touch/README.md`
- **Pure `access-view.js`:** `allowedPages(me) -> pages[]`, `pageFor(page, me) -> page` (the current page if allowed, otherwise the first allowed), `allowedTabs(mix, me)`, `showPicker(me) -> boolean`.
- **UI:**
  - The picker is shown when `me.kind === 'none'`; it lists members, plus "Admin" when `adminAvailable`.
  - A "Change name" control is available on every page once access is on.
  - The page switch and mix tabs show only allowed items. The transport row needs `?transport=1` and the permission.
  - The admin page opens from `#admin`, for admin only: members, a tick box per page and return, add, rename, remove, and orphaned mixes flagged.
  - Laptop settings gain the admin password field and the access off switch.
  - Class names: `name-picker`, `name-choice`, `admin-page`, `admin-member`, `admin-permission`, `admin-orphan`.
- **Live updates:** on the `access` event, re-fetch `/api/me`, apply `pageFor`, and cancel gestures if the page changes.
- **Tests:** review focus 4's client side; page fallback; tabs filtered; a member with `transport` only keeps Monitor; no picker when access is off.
- **Browser check** against `dev.js` at 390×844 and 1280×800: access off looks the same as today; add a member from the laptop; on a second context pick the name and confirm hidden pages; change permissions and see it apply live; try a blocked POST and get 403.

## Merge order
0008 → 0009

## Risks
- Basic auth runs before the picker, so the browser's own password dialog comes first. That's expected.
- Live-only checks, for the user: jweb on the laptop stays full admin, and phones keep their name after a browser restart.
