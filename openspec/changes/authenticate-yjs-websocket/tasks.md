## 1. Custom server scaffold

- [x] 1.1 Add `server.js` at repo root: `http.createServer` delegating to `next({ dev }).getRequestHandler()`, `dev` derived from `NODE_ENV`, listening on `PORT` (default 3000).
- [x] 1.2 Fail fast on startup if `AUTH_SECRET` is unset (log via Pino and exit), so WS upgrades never verify against an empty secret.

## 2. Relocate the Y.js sync protocol (verbatim)

- [x] 2.1 Move `getRoom`/`closeRoom`, the `ydoc.on("update")` broadcast, awareness handling, sync step 1, and the message loop from `y-websocket-server.mjs` into `server.js` without changing the CRDT/sync logic.
- [x] 2.2 Replace `console.*` calls in the moved code with the Pino logger (closes MIN-003).
- [x] 2.3 Attach a `ws` `WebSocketServer` (noServer mode) to the HTTP `upgrade` event.

## 3. Authenticate and authorize the upgrade

- [x] 3.1 Parse the `authjs.session-token` cookie from `req.headers.cookie` and verify it with `@auth/core/jwt` `decode` using `AUTH_SECRET` and salt `authjs.session-token`.
- [x] 3.2 On missing/invalid token: respond 401 on the upgrade, `socket.destroy()`, do not call `getRoom()`, and emit a content-free security log event via Pino.
- [x] 3.3 Derive the room from the upgrade URL and reject any room name not matching the `session-{sessionId}` form (defense against an authenticated client probing arbitrary rooms).
- [x] 3.4 On success, complete the WebSocket handshake and hand the socket to the existing room/sync flow — no ownership or membership lookup (ADR-0005 capability model).

## 4. Client transport (same-origin)

- [x] 4.1 Derive the WS URL from the current page origin (`ws://`/`wss://` + host) in `GherkinEditor.tsx`/`useCollabProvider.ts`, replacing the hardcoded `ws://localhost:1234` default.
- [x] 4.2 Ensure the disconnected/unauthorized state surfaces in `connStatus`; update the "Sync server disconnected" hint text (remove the `npm run dev:ws` instruction).

## 5. Scripts, config, and cleanup

- [x] 5.1 Update `package.json`: `dev` → `node server.js` (dev env), `start` → `NODE_ENV=production node server.js`; remove `dev:ws` and `dev:all`.
- [x] 5.2 Update `playwright.config.ts`: drop the port-1234 `webServer` entry; run everything through the single server on `:3000`.
- [x] 5.3 Delete `y-websocket-server.mjs`.
- [x] 5.4 Update docs referencing the two-process model: `CLAUDE.md`, `README.md`, `docs/technical.md`, `docs/DECISIONS.md` (and note the same-origin URL where `ws://localhost:1234` was cited).

## 6. Tests and verification

- [x] 6.1 Unit test the upgrade auth gate: valid JWT accepted; missing/invalid rejected (401, no room join); malformed room name rejected.
- [x] 6.2 Add an e2e/integration negative test asserting an unauthenticated WebSocket upgrade is refused (no document/awareness sent).
- [x] 6.3 Run the existing `e2e/collaboration.spec.ts` and `e2e/session-access-control.spec.ts` suites through the single server; confirm green (sync still works, access contract unchanged).
- [x] 6.4 Update the `> **Tests:**` lines in the change delta specs (`specs/realtime-collaboration/spec.md`, `specs/gherkin-editor/spec.md`) — replace each `none` with the real path/case from 6.1/6.2 so the traceability is accurate when the delta is archived into `openspec/specs/`.
- [x] 6.5 Run `npm run test:all` (lint, spec traceability, given-clause, typecheck, unit, e2e) and confirm green.
