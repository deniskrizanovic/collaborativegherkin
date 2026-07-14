# Architectural decisions

---

## TypeScript for both front end and back end
Alternatives considered: Python (FastAPI) backend + TypeScript frontend.
Reason: Node.js handles many simultaneous WebSocket connections efficiently,
which is a core requirement for real-time collaboration. Same language on
both sides reduces context switching.
Date: 2026-05-16

---

## Next.js as the full-stack framework
Alternatives considered: Vite (frontend only) + Express (separate backend).
Reason: Next.js provides a built-in server alongside the frontend in a single
project, reducing operational complexity. The existing Vite scaffold was
replaced because it had no production code worth keeping.
Date: 2026-05-16

---

## Tiptap as the editor
Alternatives considered: raw Y.js with a custom editor, Slate.js, ProseMirror.
Reason: Tiptap provides a Notion-style block editor with Y.js real-time
collaboration as a first-class feature. Custom Gherkin node types can be
defined without writing low-level editor plumbing from scratch.
Date: 2026-05-16

---

## Gherkin structure is enforced, not warned
Alternatives considered: warn on invalid sequences but allow them.
Reason: the app's core purpose is to produce valid Gherkin. Allowing invalid
sequences degrades the output quality and shifts the burden of correctness
back to the user.
Date: 2026-05-16

---

## SQLite for local development, PostgreSQL for production
Alternatives considered: PostgreSQL from day one.
Reason: SQLite requires no installation and runs as a local file, which
removes a setup step while the app is being proved out. The switch to
PostgreSQL is deferred until the app is production-ready. Prisma makes
this swap a one-line change in schema.prisma plus a new DATABASE_URL.
Date: 2026-05-16

---

## Session data is transient — export is the record of truth
Alternatives considered: treating the app as a permanent archive.
Reason: users confirmed they are happy to export after each session and store
in Jira. This simplifies the database schema and backup requirements.
Date: 2026-05-16

---

## Hosting deferred until local version works
Alternatives considered: Heroku Private Space.
Reason: app is primarily for non-Salesforce users. Hosting choice deferred
until the app runs locally and basic tests pass, as per safety guidelines.
Date: 2026-05-16

---

## Pino for logging
Alternatives considered: winston, console.log.
Reason: Pino is the fastest structured logger for Node.js, widely used, and
its output format is easy to search and read back when diagnosing issues.
Date: 2026-05-16

---

## Y.js sync server runs as a separate process, not a Next.js API route
Alternatives considered: WebSocket handler inside Next.js (e.g. via a custom
server.js or a Route Handler).
Reason: Next.js App Router does not support long-lived WebSocket connections
in its standard server model. The sync server is a standalone Node.js process
(`y-websocket-server.mjs`) that listens on port 1234. Run it alongside the
Next.js dev server with `npm run dev:ws`.
Date: 2026-05-17
**Superseded 2026-07-14 by "Consolidate Next.js and Y.js sync into one custom
server" below (ENG-005).**

---

## Consolidate Next.js and Y.js sync into one custom server (`server.js`)
Alternatives considered: (a) keep two processes and add token-in-URL auth to the
standalone `.mjs`; (b) two processes behind a reverse proxy sharing one origin.
Reason: the standalone WebSocket accepted any connection on any room with no
authentication — the real access-control boundary deferred by ADR-0005. A custom
Node server (`server.js`) that serves HTTP via Next's request handler and attaches
a `ws` server on the HTTP `upgrade` event puts both on one origin, so the browser
sends the httpOnly NextAuth session cookie on the upgrade automatically. The
handler verifies that JWT (`AUTH_SECRET`, salt `authjs.session-token`) and rejects
unauthenticated or malformed-room upgrades before any room is joined. Authorization
follows ADR-0005's capability model (signed-in + holds the `session-{id}` room
name; no ownership lookup). Token-in-URL was rejected (tokens leak to logs; needs a
separate origin check); a reverse proxy was rejected (extra per-host infra breaks
the one-artifact goal). The custom server rules out serverless/Vercel — accepted,
since the in-memory Y.js `rooms` Map already required a persistent host. `dev:ws`
and `dev:all` are removed; `dev` and `start` both run `node server.js` (dev flag
from `NODE_ENV`). The sync/awareness protocol was relocated verbatim; only its
logging (Pino, not `console.*` — closes MIN-003) and the auth gate are new.
Date: 2026-07-14

---

## Tiptap Paragraph node extended with data-gherkin-type attribute
Alternatives considered: defining a fully custom ProseMirror node type for
each Gherkin block (Feature, Scenario, Given, etc.).
Reason: extending the built-in Paragraph node with a single attribute is
significantly simpler — Tiptap handles all the rendering and serialisation
plumbing. The trade-off is that Gherkin block identity lives in an attribute
rather than a distinct node type, which means ProseMirror cannot enforce
node-level schema constraints. Sequence enforcement is handled instead by the
`canFollow()` function in `src/lib/gherkin.ts` at interaction time.
Date: 2026-05-17

---

## Session id is a capability URL — open read/write, owner-only delete
See ADR-0005. A compliance review flagged open GET/PATCH on `/api/sessions/[id]`
as an IDOR; a first fix added owner-only guards and broke link-sharing.
Alternatives considered: owner-only read/write (contradicts ADR-0003 and the
"Copy invite link" feature); a revocable collaborator ACL (deferred future work).
Reason: the session id is an unguessable `cuid`, so holding it is equivalent to
holding the invite link. GET/PATCH stay open to any authenticated holder; only
the irreversible DELETE is owner-gated. Reaffirms ADR-0003.
Date: 2026-07-09
