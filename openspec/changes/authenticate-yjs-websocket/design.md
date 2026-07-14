## Context

Real-time collaboration runs over a standalone Y.js WebSocket server
(`y-websocket-server.mjs`) on `ws://localhost:1234`, a separate Node process from
the Next.js app. It accepts any connection, on any room (room name = raw request
URL), with no authentication, origin check, or session scoping. The Gherkin
document body — the actual session content — flows over this socket, entirely
outside the Next.js auth gate.

The REST access model was settled in ADR-0005: a session id is an unguessable
`cuid` treated as a **capability URL**, so authorization is "you are signed in
**and** you hold the id." `GET`/`PATCH` are open to any authenticated holder;
`DELETE` is owner-only. That resolution explicitly deferred the WebSocket as
"the real security boundary" (ADR-0005 Consequences → residual exposure). ENG-005
is that deferred work, and it is now step 6 / the primary open boundary.

Constraints:
- **Deployment must target both Railway and EC2** from one artifact. Both are
  long-lived hosts; neither is serverless. The Y.js `rooms` Map is in-process
  mutable state, so a serverless model was never viable regardless.
- **Do Not Touch (CLAUDE.md):** the Tiptap + Y.js collaboration configuration and
  the sync protocol must not be rewritten. This change relocates that logic
  verbatim and confines new code to the connection gate + client transport.
- The e2e suite (`e2e/global-setup.ts`) already mints a NextAuth JWT cookie
  (`authjs.session-token`, salt `authjs.session-token`, signed with `AUTH_SECRET`)
  on `domain: localhost`. Any auth mechanism must remain compatible with it.

## Goals / Non-Goals

**Goals:**
- No unauthenticated client can read or write any session document over the socket.
- The WebSocket authorization matches the REST contract exactly (capability model:
  signed-in + holds the `session-<cuid>` room name).
- One server artifact (`server.js`) runs identically in dev, Railway, and EC2.
- The Y.js sync/awareness behaviour is byte-for-byte unchanged; collaboration keeps
  working after the change.

**Non-Goals:**
- Persisting Y.js documents across restarts (OPS-001) — separate fast-follow.
- Per-room ownership enforcement stricter than the capability model — ADR-0005 says
  holding the id is sufficient; matching REST is the target, not exceeding it.
- MFA (SEC-003), rate limiting, or message-level validation of Y.js payloads.
- Changing the CRDT conflict-resolution or Tiptap binding.

## Decisions

### D1: Consolidate into a single custom Next server (`server.js`)

Run one Node process that creates the HTTP server, delegates normal requests to
Next's request handler (`next({ dev }).getRequestHandler()`), and attaches a
`ws` `WebSocketServer` on the HTTP `upgrade` event. `NODE_ENV` toggles the `dev`
flag so the same file serves dev and prod.

- **Why:** a single origin means the browser sends the `httpOnly` session cookie on
  the WebSocket upgrade automatically — no token-in-URL, no ticket endpoint, no
  second verification path. One artifact deploys to Railway (one service) and EC2
  (one process) identically.
- **Alternatives considered:**
  - *Keep two processes, add token-in-URL auth to the standalone `.mjs`.* Rejected:
    tokens in URLs leak to logs; needs an explicit origin check; dev/prod diverge;
    two connection paths to keep auth-consistent.
  - *Two processes behind a reverse proxy (one origin, nginx/Caddy).* Rejected: adds
    infra that must be re-created per host (breaks the "one artifact for both hosts"
    goal); still a standalone process that must independently verify the JWT.
- **Cost accepted:** a custom server opts out of Vercel/serverless. Irrelevant here —
  the in-memory Y.js state already precluded serverless.

### D2: Authenticate the upgrade via the same-origin NextAuth JWT cookie

In the `upgrade` handler, parse the `authjs.session-token` cookie from
`req.headers.cookie` and verify it with `@auth/core/jwt`'s `decode` using
`AUTH_SECRET` and salt `authjs.session-token`. Invalid/missing → destroy the socket
before the WebSocket handshake completes (respond `401` on the upgrade and
`socket.destroy()`); do not call `getRoom()`.

- **Why:** reuses the exact token NextAuth issues and e2e already mints — no new
  auth surface, no new secret. Verification is a pure function of the cookie +
  `AUTH_SECRET`, so it works in-process without importing NextAuth's full config.
- **Alternatives considered:** minting a short-lived room ticket via a Next API route
  (approach C). Rejected as unnecessary once the origin is shared — the cookie is
  already present and sufficient; a ticket adds an endpoint and moving parts.

### D3: Authorize by the ADR-0005 capability model (no ownership lookup)

Once authenticated, the client is authorized for room `session-<id>` iff the room
name is well-formed. Knowing the id **is** the capability; no DB lookup of
ownership or membership. This mirrors REST `GET`/`PATCH` exactly.

- **Why:** consistency with ADR-0005 — adding an ownership gate here would break
  link-sharing collaboration just as it did on REST (the reason those guards were
  reverted). The `cuid` id space defends against enumeration.
- **Validation performed:** the room name must match `session-<cuid>` shape; reject
  malformed/`default` room names so an authenticated client cannot join an
  unstructured room. (Authentication already stops the anonymous case; this is
  defense against a signed-in client poking arbitrary room strings.)

### D4: Relocate the sync protocol verbatim; log via Pino

Move `getRoom`/`closeRoom`, the `ydoc.on("update")` broadcast, awareness handling,
sync step 1, and the message loop from `y-websocket-server.mjs` into `server.js`
unchanged. Swap `console.*` for the Pino logger (closes MIN-003). Delete the `.mjs`.

- **Why:** honors Do Not Touch — the collaboration logic is preserved, only its host
  process and its logging change. Deleting the `.mjs` removes the second, now-dead
  connection path so dev and prod share one path.

### D5: Client connects same-origin

`GherkinEditor` / `useCollabProvider` derive the WS URL from the current page
origin (`ws://` or `wss://` + host, same port) instead of the hardcoded
`ws://localhost:1234`. The provider passes no token — the browser attaches the
cookie automatically on a same-origin upgrade.

- **Why:** same-origin is what makes cookie auth work; also removes the hardcoded
  host so `wss` works in prod behind TLS without a config change.

## Risks / Trade-offs

- **Custom server rules out serverless / Vercel.** → Accepted; the stateful Y.js
  rooms already required a persistent host. Documented so it is a decision, not a
  surprise.
- **Change touches the sync code path (Do Not Touch adjacency).** → Relocate
  verbatim, do not refactor; gate the change behind the existing e2e collaboration
  and access-control suites (must stay green). The proposal states the sync protocol
  is moved, not rewritten.
- **Cookie not sent on cross-origin / non-same-site upgrade.** → With one origin this
  is the desired behaviour (it blocks CSWSH). Ensure the client always uses the
  same-origin URL; a mismatched URL would fail to authenticate rather than fail open.
- **Playwright currently starts a port-1234 `webServer`.** → Remove that entry; run
  everything through the single server on `:3000`. The minted cookie already targets
  `localhost` and `authjs.session-token`, so authenticated WS upgrades work in e2e
  unchanged. Add/keep a collaboration test that would fail if the socket fell open.
- **`AUTH_SECRET` unset in some environment.** → The server must fail fast on startup
  if `AUTH_SECRET` is missing (it is already required by NextAuth); log and refuse to
  accept WS upgrades rather than verifying against an empty secret.
- **Dev-server ergonomics.** → `next({ dev: true })` still provides HMR; the only loss
  is some `next dev` conveniences, acceptable for this app.

## Migration Plan

1. Add `server.js`; move sync logic in from the `.mjs`; add the auth gate.
2. Repoint the client to a same-origin WS URL.
3. Update `package.json` (`dev` → `node server.js`; `start` → `NODE_ENV=production
   node server.js`; remove `dev:ws`/`dev:all`) and `playwright.config.ts` (drop the
   1234 `webServer`).
4. Delete `y-websocket-server.mjs`.
5. Update docs (`CLAUDE.md`, `README.md`, `docs/technical.md`, `docs/DECISIONS.md`)
   to describe the single-process model.
6. Verify: unit test for the cookie-verify gate (accept valid JWT, reject
   missing/invalid, reject malformed room); e2e collaboration + access-control suites
   green; a negative test asserting an unauthenticated upgrade is refused.

**Rollback:** revert the branch; the deleted `.mjs` and two-process scripts return.
No data migration is involved (Y.js state is ephemeral), so rollback is code-only.

## Open Questions

- None blocking. Deployment host is "both Railway and EC2" (settled); auth is the
  same-origin cookie (settled); authz is the capability model (settled).
