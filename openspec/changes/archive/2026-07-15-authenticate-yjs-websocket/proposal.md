## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/32

## Why

The Y.js WebSocket sync server (`y-websocket-server.mjs`) accepts any connection,
on any room, from anyone — no authentication, no origin check, no session scoping.
It runs as a separate process on `ws://localhost:1234`, entirely outside the
Next.js auth gate, yet it carries the actual session document (the Gherkin body).
The REST resolutions (ENG-001/ENG-002, ADR-0005) narrowed the REST surface on the
premise that the `cuid` session id is an unguessable capability and the caller is a
signed-in user. The WebSocket enforces *neither* half of that: an unauthenticated
client that reaches the port can read and write any `session-<id>` document. This
makes ENG-005 the primary access-control boundary (step 6 of the remediation
roadmap) and the resolutions above give false assurance until it is closed.

## What Changes

- Consolidate Next.js and the Y.js sync server into a **single custom Node server**
  (`server.js`) that serves HTTP and handles the WebSocket `upgrade` on the same
  origin/port. This one artifact is used identically in local dev, Railway, and EC2.
- **BREAKING (dev workflow):** delete `y-websocket-server.mjs`; replace `next dev`
  and `next start` with `node server.js` (the `dev` flag toggles on `NODE_ENV`).
  Remove the `dev:ws` / `dev:all` scripts. The standalone WS process and port 1234
  no longer exist.
- The WebSocket `upgrade` handler **authenticates** the connection by verifying the
  NextAuth JWT from the same-origin `authjs.session-token` httpOnly cookie using the
  shared `AUTH_SECRET`. Unauthenticated upgrades are rejected (connection refused /
  closed), and the rejection emits a content-free security log event via Pino.
- **Authorization** follows ADR-0005's capability model: signed-in **and** holding
  the `session-<cuid>` room name is sufficient. No per-session ownership lookup —
  this matches the REST contract exactly.
- The Y.js **sync/awareness protocol is moved unchanged** from the `.mjs` into the
  server's upgrade handler (rooms, sync step 1, awareness broadcast). The CRDT ↔
  Tiptap collaboration configuration is not touched.
- The client connects to a **same-origin** WebSocket URL (derived from the current
  host) instead of the hardcoded `ws://localhost:1234`, so the browser sends the
  session cookie on the upgrade automatically.
- Replace `console.*` in the moved sync code with the Pino logger (closes MIN-003).

Out of scope (noted as fast-follows, not included here): persisting Y.js documents
(OPS-001), MFA (SEC-003), and per-room ownership enforcement stricter than the
capability model.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `realtime-collaboration`: add a requirement that the WebSocket connection is
  authenticated (valid NextAuth JWT) and authorized by the capability model
  (signed-in + holds the room id); unauthenticated connections are rejected.
- `gherkin-editor`: the "Loading" requirement's WebSocket target changes from the
  hardcoded `ws://localhost:1234` to a same-origin URL, and establishing the
  connection now requires an authenticated session.

## Impact

- **New:** `server.js` (custom Next + WS server) at repo root.
- **Removed:** `y-websocket-server.mjs`; `dev:ws` and `dev:all` npm scripts.
- **Modified:** `package.json` scripts (`dev`, `start`); `src/components/GherkinEditor.tsx`
  and `src/components/useCollabProvider.ts` (same-origin WS URL, connection/auth
  status handling); `playwright.config.ts` (drop the port-1234 `webServer`, run
  everything through the single server); docs referencing the two-process model
  (`CLAUDE.md`, `README.md`, `docs/technical.md`, `docs/DECISIONS.md`).
- **Auth:** the WS upgrade handler reads `AUTH_SECRET` and verifies the same JWT
  (`authjs.session-token`, salt `authjs.session-token`) that `e2e/global-setup.ts`
  already mints — so e2e auth works unchanged over the single origin.
- **Do Not Touch:** honored — the collaboration/CRDT configuration and sync protocol
  logic are relocated verbatim, not rewritten; the change is confined to the
  connection-acceptance gate and the client transport wiring.
- **Dependencies:** no new runtime deps (`ws`, `next`, `@auth/core` already present).
