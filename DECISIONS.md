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
