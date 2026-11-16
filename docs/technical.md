# Technical reference

## Architecture

### Single-server model

A custom Node server (`server.js`) serves the Next.js app over HTTP **and** the
Y.js real-time sync WebSocket on the same origin/port. One process, one command:

```bash
pnpm dev      # HTTP + WebSocket on http://localhost:3000
```

Because the sync socket shares the app's origin, the browser attaches the
httpOnly NextAuth session cookie on the WebSocket `upgrade` request. The server
verifies that cookie (`AUTH_SECRET`, salt `authjs.session-token`) before joining
any room — an unauthenticated upgrade is refused with `401` before any document
or awareness state is sent (ENG-005). Authorization follows ADR-0005's
capability model: a signed-in caller holding a well-formed `session-{id}` room
name is authorized; no per-session ownership lookup. The same `server.js` runs
in dev and production (`NODE_ENV` toggles Next's `dev` flag), so Railway and EC2
deploy one identical artifact.

### Project structure

```
src/
  app/
    page.tsx                    # Home — session list + create form
    HomeClient.tsx              # Client component for home page
    layout.tsx                  # Root layout
    globals.css                 # Global styles
    api/auth/[...nextauth]/     # NextAuth route handler
    api/sessions/               # REST API: list/create sessions (auth required)
    api/sessions/[id]/          # REST API: get/delete a session (auth required)
    sessions/[id]/page.tsx      # Session page (server component)
    sessions/[id]/SessionView.tsx  # Session page (client shell)
  auth.ts                       # NextAuth v5 config — Resend provider, JWT strategy
  middleware.ts                 # Auth middleware — gates all routes
  components/
    GherkinEditor.tsx           # Tiptap + Y.js collaborative editor
  lib/
    gherkin.ts    # Gherkin block types, validation rules, export logic
    logger.ts     # Pino logger — use this everywhere, not console.log
    db.ts         # Drizzle db singleton — engine picked from DATABASE_URL
  db/
    schema.sqlite.ts  # SQLite schema (dev, CI)
    schema.pg.ts      # PostgreSQL schema (production)
    testing.ts        # createTestDb() for unit tests
drizzle/
  sqlite/         # SQLite migrations (drizzle-kit)
  pg/             # PostgreSQL migrations (drizzle-kit)
scripts/
  seed.ts         # Dev seed — creates placeholder user
server.js               # Custom Node server — Next.js HTTP + authenticated Y.js WebSocket
```

### Editor (`src/components/GherkinEditor.tsx`)

A single client component built on:

- **Tiptap** — ProseMirror-based rich text editor
- **Y.js + y-websocket** — CRDTs powering real-time multi-user sync
- **CollaborationCursor** — shows other users' carets with coloured labels

Three custom ProseMirror node types:

| Node | Description |
|---|---|
| `GherkinParagraph` | Every text block; carries `data-gherkin-type` driving CSS keyword labels and indentation |
| `GherkinDataTable` | Inline editable table with a floating toolbar (add/delete rows and columns) |
| `GherkinImage` | Images embedded as base64 data URIs via drag-and-drop or file picker |

### Gherkin structure (`src/lib/gherkin.ts`)

All structural rules live here and nowhere else:

- `ALLOWED_AFTER` — adjacency grammar (e.g. `scenario` can only follow `feature`, `rule`, or `then`)
- `canFollow()` — enforced before inserting any block
- `NEXT_BLOCK_ON_ENTER` — what Enter produces after each block type
- `exportToText()` / `exportToMarkdown()` / `parseGherkin()` — import/export logic

### Database

SQLite in development and CI, PostgreSQL in production, via **Drizzle ORM**
(`drizzle-orm` + `drizzle-kit`, no generated client). Each dialect has its own
table builder, so there are two hand-maintained schema modules with the same
exports and SQL names:

| Schema | Driver | Migrations | Config |
|--------|--------|------------|--------|
| `src/db/schema.sqlite.ts` | `better-sqlite3` | `drizzle/sqlite/` | `drizzle.sqlite.config.ts` |
| `src/db/schema.pg.ts` | `pg` | `drizzle/pg/` | `drizzle.pg.config.ts` |

`src/lib/db.ts` picks the engine at runtime: a `DATABASE_URL` starting with
`file:` opens SQLite (the path is relative to the working directory, so
`file:./dev.db` is the repo-root `dev.db`), anything else opens PostgreSQL. It
exports `db` (typed as the PostgreSQL database; the SQLite instance is cast to
that type), the matching `tables`, and `closeDb()` for scripts. Because of the
cast, application code uses only builder operations both dialects run the same
way when awaited — the list is in the comment at the top of `db.ts`. No
synchronous `.run()`/`.all()`/`.get()`, no transactions.

**Local development** — `pnpm db:migrate` applies `drizzle/sqlite/` to
`DATABASE_URL`, then `pnpm seed`. `pnpm db:studio` opens Drizzle Studio.

**Changing the schema** — edit both schema modules identically, then
`pnpm db:generate`, which writes a migration for each engine. Commit both.

**Every production deploy** — apply pending migrations:

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate:prod
```

Four tables: `User`, `Account`, `Session`, `VerificationToken`. Ids are cuid2
(`@paralleldrive/cuid2`), generated in the application. The `Session` table
carries optional `prompt` and `model` columns for per-session coaching
configuration; both are `null` by default and fall back to the constants in
`src/lib/llm-constants.ts`. The session's `content` column stores `{}` by
default — actual document state lives in Y.js (in-memory in the WebSocket
server), not in the database.

**Tests** — `src/db/testing.ts` `createTestDb("sqlite" | "pg")` applies the
committed migrations to an in-memory better-sqlite3 database or an in-process
PGlite instance. Data-layer tests (`src/lib/session.test.ts`,
`src/lib/user.test.ts`) run every case on both engines, so the PostgreSQL
migrations and queries are exercised without a Postgres server.

**Schema parity** — because the two modules are hand-maintained, they can
drift (a column added to one engine but not the other surfaces only at runtime
in the other engine — findings ENG-030/031). The `lint:schema-parity` gate
(`scripts/lint-schema-parity.mjs`) imports both modules, reduces each table to
its columns and nullability with `getTableConfig`, and fails the build when
the table, column or nullability sets diverge (dialect column types and default
expressions may differ). It needs no database and runs in `test:all`, in CI,
and in the husky pre-commit hook, alongside `lint:specs`.

### Auth

NextAuth.js v5 (`src/auth.ts`) — magic link via **Resend**, JWT session strategy (avoids naming conflict with the Gherkin `Session` model), `DrizzleAdapter` (`@auth/drizzle-adapter`, built by `authAdapter` in `src/lib/user.ts`) for user and verification-token persistence.

- Every route is gated by `src/middleware.ts` — unauthenticated requests redirect to the NextAuth sign-in page.
- Any authenticated user can view/edit any session. Only the session owner (creator) can delete it.
- The home page lists only sessions the signed-in user created.
- `TEST_AUTH_SECRET` env var activates a `test-bypass` credentials provider for E2E tests; it must never be set in production.

---

## Visual design

Gherkin keywords are colour-coded inline via CSS `::before` pseudo-elements:

| Keyword | Colour |
|---|---|
| Feature, Rule, Background | Blue |
| Scenario | Amber |
| Given | Green |
| When | Orange |
| Then | Violet |
| And, But | Muted grey |

Scenario boundaries are visually separated by a top border. Typography: Syne (display headings) + IBM Plex Sans (body) + IBM Plex Mono (editor and keyword labels).

---

## Test coverage

- **Vitest unit tests** — `src/lib/gherkin.test.ts` (structural rules, export/import logic) and `src/app/api/sessions/sessions-api.test.ts`
- **Playwright e2e tests** — 8 spec files covering: block picker, collaboration, data tables, Enter-key progression, export, import, toolbar, and visual separation

---

## Known gaps

- Y.js document state is not persisted to the database; restarting the WebSocket server loses in-progress content
- No session deletion UI (the `DELETE /api/sessions/:id` route exists but is not exposed in the UI)
