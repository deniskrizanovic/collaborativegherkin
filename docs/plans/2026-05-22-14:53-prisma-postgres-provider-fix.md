# Plan: Fix SQLite/PostgreSQL provider mismatch (Improvement #2)

## Context

`prisma/schema.prisma` hardcodes `provider = "sqlite"`. Prisma's `provider` field does not accept `env()` — it must be a string literal set at schema-write time. The existing `.env.example` implies that swapping `DATABASE_URL` is enough to reach PostgreSQL in production; it is not. Deploying without fixing this will produce SQLite-specific migration SQL (DATETIME types, etc.) that PostgreSQL rejects, or `migration_lock.toml` provider mismatches.

The fix is a separate PostgreSQL schema file in its own subdirectory (`prisma/postgres/`). Prisma resolves migrations relative to the schema file, so `prisma/postgres/schema.prisma` naturally uses `prisma/postgres/migrations/` — completely isolated from the dev SQLite migrations.

---

## Approach

### 1. Create `prisma/postgres/schema.prisma`
Identical models to `prisma/schema.prisma`, but with `provider = "postgresql"`. No model changes needed — none of the current fields use SQLite-specific types.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ... same User, Session, AppSetting models
```

### 2. Add npm scripts to `package.json`
```json
"db:generate:postgres": "prisma generate --schema prisma/postgres/schema.prisma",
"db:migrate:dev:postgres": "prisma migrate dev --schema prisma/postgres/schema.prisma",
"db:migrate:prod": "prisma migrate deploy --schema prisma/postgres/schema.prisma"
```

- `db:migrate:dev:postgres` — used once to generate the initial Postgres migrations folder and files
- `db:migrate:prod` — used in production deploys to apply pending migrations
- `db:generate:postgres` — run after schema changes to regenerate the Prisma client for Postgres

### 3. Update `.env.example`
Add a clear production section showing the Postgres `DATABASE_URL` format and referencing the two-schema workflow.

### 4. Update `docs/technical.md`
Add a "Production database setup" section explaining:
- Why two schemas exist
- The one-time `db:migrate:dev:postgres` step to generate Postgres migrations
- The deploy-time sequence: generate → migrate deploy → start

---

## Files created/modified

| File | Action |
|------|--------|
| `prisma/postgres/schema.prisma` | Created — PostgreSQL provider + same models |
| `package.json` | Edited — added 3 db scripts |
| `.env.example` | Edited — added production DATABASE_URL section |
| `docs/technical.md` | Edited — added production DB section |

---

## What is NOT changing
- `prisma/schema.prisma` — SQLite dev schema unchanged
- `prisma/migrations/` — existing SQLite migrations unchanged
- All application code — `src/lib/db.ts` and all routes are provider-agnostic
- No test changes needed — unit tests mock the db, e2e tests use dev SQLite

---

## Verification
1. `npm run typecheck` — no errors
2. `DATABASE_URL="postgresql://..." npx prisma validate --schema prisma/postgres/schema.prisma` — schema valid
3. Full test suite: `npm run test -- --run` — 173 unit tests pass (no logic changes)
4. e2e suite: `npm run test:e2e` — 96 tests pass
