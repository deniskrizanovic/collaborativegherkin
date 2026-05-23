# Technical reference

## Architecture

### Two-server model

The Next.js app server handles HTTP (sessions API, page rendering) while a separate standalone Y.js WebSocket server (`y-websocket-server.mjs`) handles real-time sync. Both must run concurrently:

```bash
npm run dev      # Next.js on http://localhost:3000
npm run dev:ws   # Y.js WebSocket on ws://localhost:1234
```

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
    db.ts         # Prisma client singleton
prisma/
  schema.prisma   # Database schema
  seed.ts         # Dev seed — creates placeholder user
y-websocket-server.mjs  # Standalone Y.js WebSocket sync server
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

SQLite in dev, PostgreSQL in production, via Prisma. Prisma's `provider` is a compile-time literal, not a runtime env var, so two separate schema files exist:

| Schema | Provider | Migrations |
|--------|----------|------------|
| `prisma/schema.prisma` | `sqlite` | `prisma/migrations/` |
| `prisma/postgres/schema.prisma` | `postgresql` | `prisma/postgres/migrations/` |

**Local development** — no extra steps, `prisma/schema.prisma` is the default used by `npx prisma migrate dev` and `npx prisma studio`.

**First-time production setup** — generate the PostgreSQL migration history once against a real Postgres instance:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate:dev:postgres
```

**Every production deploy** — apply pending migrations:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate:prod
```

Five models: `User`, `Account`, `Session`, `VerificationToken`, `AppSetting`. The session's `content` field stores `{}` by default — actual document state lives in Y.js (in-memory in the WebSocket server), not in the database.

### Auth

NextAuth.js v5 (`src/auth.ts`) — magic link via **Resend**, JWT session strategy (avoids naming conflict with the Gherkin `Session` model), `PrismaAdapter` for token persistence.

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
