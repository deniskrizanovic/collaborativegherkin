# ADR 0009 — Drizzle Replaces Prisma

**Status:** Accepted  
**Date:** 2026-11-16

## Context

The data layer ran on Prisma 7: two `.prisma` schemas (SQLite for development and CI, PostgreSQL for production), a client generated into a tracked `src/generated/` directory, native engine packages that needed build allowlisting, and a driver-adapter layer over the `better-sqlite3` and `pg` drivers chosen at runtime. Biome, oxlint and `lint:crap` each carried an exclusion for the generated client. Issue #62 asked for a switch to Drizzle.

The data layer is small: four tables and about ten queries. No production database exists yet, so no data has to move.

## Decision

**Drizzle ORM replaces Prisma.** `drizzle-orm` is the query builder, `drizzle-kit` writes and applies plain SQL migrations, and the app talks to `better-sqlite3` and `pg` directly. There is no generated client and no engine binary.

### Two engines, two schema modules

SQLite stays for development and CI, PostgreSQL for production. `src/db/schema.sqlite.ts` and `src/db/schema.pg.ts` export the same tables with today's SQL names (`"User"`, `"Account"`, `"VerificationToken"`, `"Session"`, camelCase columns). Each has its own migration folder (`drizzle/sqlite/`, `drizzle/pg/`), starting from one fresh `0000_init`; the Prisma migration history is deleted (git keeps it). `lint:schema-parity` now compares the two modules' tables, columns and nullability.

### One query surface, typed as PostgreSQL

`src/lib/db.ts` picks the engine from `DATABASE_URL` and exports `db` typed as the PostgreSQL database, with the SQLite instance cast to that type, so the compiler checks queries against the production dialect. Application code uses only builder operations both dialects run the same way when awaited, and no transactions. Every query is tested on both engines against real in-memory databases (better-sqlite3 `:memory:` and PGlite) through `src/db/testing.ts`, which replaces the `vi.fn` Prisma fakes.

### Auth adapter

`@auth/drizzle-adapter` replaces `@auth/prisma-adapter`, mapped onto the existing `User`, `Account` and `VerificationToken` tables. `User` gains a nullable `image` column, which the adapter's table contract requires. The adapter is pinned to the release whose `@auth/core` matches `next-auth`'s, and is held in lockstep with it (ADR 0004).

### Identifiers

Ids are cuid2 (`@paralleldrive/cuid2`), generated in the application. Like cuid v1 they are lowercase alphanumeric and start with a letter, so the `session-<id>` room-name check in `src/lib/wsAuth.ts` is unchanged.

## Alternatives considered

- **Keep Prisma.** Keeps the generated client, its tool exclusions and the engine build allowlist.
- **PostgreSQL everywhere, including dev and CI.** One dialect and no cast, but every developer and CI run needs a Postgres server. Rejected in favour of keeping SQLite.
- **A repository interface with one implementation per dialect.** Duplicates every query; the two copies are the drift this design avoids.
- **Drizzle naming conventions (snake_case, lowercase tables).** Churns every place that names a table or column, for no behaviour change.

## Consequences

- Local SQLite databases are recreated with `pnpm db:migrate`; the database is now the repo-root `dev.db`, not `prisma/dev.db`.
- A schema change edits both modules and runs `pnpm db:generate`, which writes a migration for each engine.
- The cast in `db.ts` can hide a dialect difference that the compiler would otherwise catch. The both-engine unit tests are the guard, so every new query needs one.
- PGlite exercises the PostgreSQL schema and queries but not the `pg` driver against a networked server. The first production deployment runs `pnpm db:migrate:prod` and a magic-link smoke test before any user is invited.
