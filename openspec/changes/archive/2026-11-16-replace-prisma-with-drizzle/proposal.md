## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/62

## Why

Prisma brings a code-generation step (`prisma generate` into a tracked
`src/generated/` client), native engine packages that need build allowlisting,
and a driver-adapter layer on top of the drivers we already pick at runtime.
Drizzle is a plain TypeScript query builder with no generated client and no
engine binaries: the schema is code, queries are typed directly from it, and
migrations are plain SQL files. Issue #62 asks for the switch. The data layer
is small (four tables, about ten queries), so the move costs little now and
gets more expensive as the app grows.

## What Changes

- Replace `prisma` / `@prisma/client` / `@prisma/adapter-*` with `drizzle-orm`
  + `drizzle-kit`, using the `better-sqlite3` driver (dev, CI) and `pg`
  (production) directly.
- Keep the two-engine model: SQLite in development and CI, PostgreSQL in
  production. Each engine gets a Drizzle schema module and its own migration
  folder. The schema-parity gate (`lint:schema-parity`) is rewritten to compare
  the two Drizzle schema modules instead of the two `.prisma` files.
- Rewrite every database call (`src/lib/session.ts`, the session page, the
  test-bypass user upsert in `src/auth.ts`, `e2e/global-setup.ts`, the seed)
  on Drizzle. The `Session` service keeps its public interface and its
  `SessionNotFoundError` contract; the Prisma `P2025` error-code sniffing goes.
- Swap `@auth/prisma-adapter` for `@auth/drizzle-adapter`, mapped onto the
  existing `User` / `Account` / `VerificationToken` tables. JWT strategy is
  unchanged. The user approved touching the NextAuth configuration for this.
- Add a nullable `image` column to `User`, which the Drizzle adapter's user
  table contract requires.
- No production database exists yet, so there is no data to carry over. Each
  engine starts from a single fresh Drizzle migration; nothing adopts or
  baselines a Prisma-built database.
- **BREAKING (dev only):** local SQLite databases are recreated from the
  Drizzle migrations. Existing `prisma/dev.db` contents are not carried over.
  Sessions are transient working docs, so nothing of value is lost.
- Delete `prisma/` (both schemas, both migration histories, `prisma.config.ts`
  files) and `src/generated/`. The user approved removing the Prisma migration
  history, which git keeps. Move the seed to `scripts/seed.ts`.
- Point the formatter's generated-code exclusion at Drizzle's migration
  metadata (`drizzle/**/meta/**`) instead of `src/generated/**`. The lint no
  longer needs a generated-client exclusion.
- Hold `@auth/drizzle-adapter` in lockstep with `next-auth` / `@auth/core`, as
  `@auth/prisma-adapter` is held today.
- Update CI, the Playwright weekly workflow, the husky hook comment, dependabot
  ignores, `pnpm-workspace.yaml` build allowlist, `.env.example`, README,
  `docs/technical.md`, `CLAUDE.md` and the OpenSpec project context. Add an ADR
  recording the switch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-model`: the cross-engine parity requirement now compares Drizzle schema
  modules (tables, columns, nullability) instead of Prisma schema files. The
  `User` requirement gains the optional auth profile attributes, including
  `image`.
- `code-formatting`: the generated-code exclusion moves from the Prisma client
  (`src/generated/**`) to Drizzle migration metadata (`drizzle/**/meta/**`).
- `code-linting`: the `src/generated/**` exclusion and the "outside the
  generated Prisma client" carve-out for `eslint-disable` go. The list of
  non-`src/` paths exempt from `no-console` swaps `prisma/seed.ts` for the
  moved seed.
- `crap-metric`: the gate no longer skips `src/generated/`, which this change
  deletes; tests and declaration files stay out of scope.
- `dependency-maintenance`: the held-auth-packages lockstep requirement names
  `@auth/drizzle-adapter` instead of `@auth/prisma-adapter`.

## Impact

- **Code:** `src/lib/db.ts`, `src/lib/session.ts`, `src/auth.ts`,
  `src/app/sessions/[id]/page.tsx`, `src/app/page.tsx`, the API routes that
  build `Session` from `db.session`, `src/lib/wsAuth.ts` (comment only),
  `e2e/global-setup.ts`, seed. New `src/db/schema.sqlite.ts`,
  `src/db/schema.pg.ts`, `drizzle.sqlite.config.ts`, `drizzle.pg.config.ts`,
  `drizzle/sqlite/` and `drizzle/pg/`.
- **Tests:** `src/lib/session.test.ts` stops faking Prisma delegates and runs
  against real in-memory databases. Route tests that `vi.mock("@/lib/db")` with
  Prisma-shaped fakes are updated. `scripts/lint-schema-parity.test.ts`,
  `scripts/biome-config.test.ts`, `scripts/oxlint-config.test.ts` and
  `scripts/lint-crap.test.ts` follow the moved paths.
- **Dependencies:** removes `prisma`, `@prisma/client`,
  `@prisma/adapter-better-sqlite3`, `@prisma/adapter-pg`,
  `@auth/prisma-adapter`. Adds `drizzle-orm`, `drizzle-kit`, `better-sqlite3`,
  `pg`, `@paralleldrive/cuid2`, `@auth/drizzle-adapter`, `@types/better-sqlite3`,
  `@types/pg`, and `@electric-sql/pglite` (dev, for Postgres-dialect unit
  tests).
- **Operations:** none. There is no production instance; the first
  deployment will run the PostgreSQL migrations against an empty database.
- **Do-Not-Touch items, approved by the user for this change:** NextAuth
  configuration (adapter swap only) and the Prisma migration history (deleted
  from the tree; git keeps it). No migration has run against real data.
