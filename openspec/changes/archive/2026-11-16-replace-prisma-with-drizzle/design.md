## Context

The data layer today:

- Two Prisma schemas: `prisma/schema.prisma` (SQLite, dev and CI) and
  `prisma/postgres/schema.prisma` (PostgreSQL, production). They are kept at
  model and field parity by `lint:schema-parity`, a line parser over the
  `.prisma` files.
- A generated client in `src/generated/prisma/`. Biome, oxlint and
  `lint:crap` all carry exclusions for it.
- `src/lib/db.ts` picks a driver adapter at runtime: a `DATABASE_URL` starting
  with `file:` gets `@prisma/adapter-better-sqlite3`, anything else gets
  `@prisma/adapter-pg`.
- Callers:
  - `Session` service (`src/lib/session.ts`), injected with `db.session`
    (ADR-0001). It maps Prisma's `P2025` error code to `SessionNotFoundError`.
  - `src/app/sessions/[id]/page.tsx`, which queries `db.session.findUnique`
    directly.
  - The test-bypass credentials provider in `src/auth.ts`, which runs
    `db.user.upsert`.
  - `PrismaAdapter(db)` in `src/auth.ts`, which persists magic-link
    verification tokens, users and accounts. The session strategy is JWT.
  - `e2e/global-setup.ts`, which runs `db.user.upsert` and `$disconnect`.
  - `prisma/seed.ts`.
- Unit tests fake Prisma delegates (`findMany`, `findUnique`, ...) with
  `vi.fn`. Route tests `vi.mock("@/lib/db")` with Prisma-shaped objects.
- No production instance exists yet. PostgreSQL is the intended production
  engine, but no database holds real data, so nothing has to be adopted or
  migrated across ORMs.

The user chose to keep SQLite for dev and CI and PostgreSQL for production,
and approved touching the NextAuth adapter and removing the Prisma migration
history.

## Goals / Non-Goals

**Goals:**

- No Prisma package, generated client or `prisma/` directory left.
- Same table and column names in both engines as today, so raw SQL, logs and
  docs that name them stay valid.
- One query code path that runs on both engines and is tested on both.
- Keep the `Session` service's public interface and its error contract, so the
  API routes and their tests change only in how they build it.
- Keep the schema-parity guarantee, now over Drizzle schema modules.

**Non-Goals:**

- Moving dev or CI to PostgreSQL (rejected by the user in favour of keeping
  SQLite).
- Adopting or baselining a Prisma-built database. There is none to adopt.
- Carrying existing local `prisma/dev.db` contents over. Dev databases are
  recreated.
- Any change to API contracts, Y.js sync, `src/lib/gherkin.ts` or export
  logic.
- Using Drizzle's relational query API (`db.query.*`). The app's queries are
  flat, and the core builder is the surface both dialects share most
  reliably.

## Decisions

### D1. Two schema modules keeping today's table and column names

`src/db/schema.sqlite.ts` (`sqliteTable`) and `src/db/schema.pg.ts`
(`pgTable`) export the same identifiers: `users`, `accounts`,
`verificationTokens`, `sessions`. Both keep the existing SQL names: tables
`"User"`, `"Account"`, `"VerificationToken"`, `"Session"`, camelCase columns,
and the snake_case OAuth columns on `Account`. Constraints keep today's
behaviour: unique `User.email`, unique `(provider, providerAccountId)` on
`Account`, unique `(identifier, token)` on `VerificationToken`, and foreign
keys `Account.userId` (`ON DELETE CASCADE`) and `Session.userId`
(`ON DELETE RESTRICT`). Constraint and index names are whatever drizzle-kit
generates; nothing depends on Prisma's names.

Column types:

- PostgreSQL uses `text`, `integer` and `timestamp(precision: 3, mode:
  "date")`. `createdAt` has a DB default of now.
- SQLite uses `integer({ mode: "timestamp_ms" })` for timestamps.
- `updatedAt` is set in the application on both engines, via `$defaultFn` and
  `$onUpdate`.

*Alternative:* adopt Drizzle naming conventions (snake_case, lowercase
tables). Rejected: it buys nothing, and it would churn every place that names
a table or column, for no behaviour change.

### D2. One query surface, typed as PostgreSQL, tested on both engines

`src/lib/db.ts` keeps its runtime switch. A `file:` URL opens `better-sqlite3`
through `drizzle-orm/better-sqlite3` with the SQLite schema. Anything else
opens a `pg` `Pool` through `drizzle-orm/node-postgres` with the PostgreSQL
schema. It exports:

- `db`, typed as `NodePgDatabase<typeof pgSchema>`. The SQLite instance is
  cast to this type.
- `tables`, the schema object that matches the engine in use.
- `closeDb()`, which replaces `$disconnect` for scripts and `e2e/global-setup`.

Application code may use only the builder operations both dialects implement
identically when awaited: `select … from … where … orderBy … limit`,
`insert … values … returning`, `onConflictDoNothing` /
`onConflictDoUpdate`, `update … set … where … returning`,
`delete … where … returning`, and the `eq` / `and` / `desc` operators. It must
not use the SQLite-only synchronous `.run()`, `.all()` or `.get()`, or
transactions. better-sqlite3 transactions are synchronous, so they behave
differently from Postgres transactions. The app needs none today. A comment in
`db.ts` records this rule.

*Why typed as PostgreSQL:* production is the engine whose behaviour matters
most, and the compiler should flag anything Postgres does not accept.

*Alternatives:*

- A union type. Drizzle's database types do not unify, so calls on a union do
  not compile.
- A repository interface with one implementation per dialect. That duplicates
  every query, and the two copies are the drift risk this design exists to
  avoid.

*Mitigation for the cast:* see D4. Every query is exercised on real SQLite and
real Postgres (PGlite) in the unit suite.

### D3. `Session` service keeps its interface; not-found comes from `returning`

`Session` is constructed with `{ db, tables }` (explicit injection, ADR-0001)
instead of `{ session: PrismaClient["session"] }`. `list`, `create`, `get`,
`update` and `delete` keep their signatures and `SessionRecord` shape. `update`
and `delete` use `.returning({ id })` and throw `SessionNotFoundError` when no
row comes back. The `P2025` error-code sniffing is deleted. The session page
uses `Session.get` (catching `SessionNotFoundError` and calling `notFound()`)
instead of querying the table directly, so the page has no Drizzle calls of
its own.

A small `src/lib/user.ts` exports `ensureUserByEmail(db, tables, email)`. It
does an insert with `onConflictDoUpdate` on `email` (a no-op `set`) and
`returning`, so the existing row or the new row comes back in one statement.
`src/auth.ts` (test bypass) and `e2e/global-setup.ts` share it. The seed does
its own insert with `onConflictDoNothing`, because it sets a fixed `id` and
`name`.

### D4. Tests run against real in-memory databases on both engines

`src/db/testing.ts` exports `createTestDb(engine)`. For `"sqlite"` it opens
better-sqlite3 `:memory:`. For `"pg"` it opens an in-process
`@electric-sql/pglite` (dev dependency) through `drizzle-orm/pglite`. Either
way it applies the matching `drizzle/<engine>` migrations and returns
`{ db, tables, close }`. `session.test.ts` and a new `user.test.ts` run each
case once per engine via `describe.each(["sqlite", "pg"])`. These replace the
`vi.fn` Prisma fakes, in line with the project's preference for explicit
injection over mocks.

Route tests that `vi.mock("@/lib/db")` keep the mock seam (acknowledged debt)
but return a `createTestDb("sqlite")` instance instead of Prisma-shaped fakes.

*Alternative:* keep `vi.fn` fakes of the Drizzle builder chain. Rejected:
chain fakes are brittle, and they would not catch the cross-dialect
differences that the D2 cast can hide.

### D5. Identifiers stay CUIDs (`@paralleldrive/cuid2`)

Every `id` column gets `$defaultFn(() => createId())`. cuid2 output is
lowercase alphanumeric and starts with a letter, so the `session-[a-z0-9]+`
room-name gate in `src/lib/wsAuth.ts` still accepts new session ids, and
existing cuid v1 ids keep working. Only the comment in `wsAuth.ts` that names
Prisma changes.

### D6. Migrations: drizzle-kit, one folder per engine, one initial migration

`drizzle.sqlite.config.ts` and `drizzle.pg.config.ts` point drizzle-kit at
each schema module, with output in `drizzle/sqlite/` and `drizzle/pg/`. Each
engine starts with a single generated `0000_init` migration that creates the
whole schema, including the nullable `User.image` column. That column is
needed because `@auth/drizzle-adapter` types its users table as requiring an
`image` column. Later schema changes are generated for both engines in the
same commit. Parity is enforced on the schema modules (D8), not on the
migration files.

Scripts:

- `db:generate` runs `drizzle-kit generate` for both configs.
- `db:migrate` runs `drizzle-kit migrate --config drizzle.sqlite.config.ts`
  and replaces `prisma migrate dev` / `deploy` locally and in CI.
- `db:migrate:prod` runs `drizzle-kit migrate --config drizzle.pg.config.ts`
  against `DATABASE_URL`. The first production deployment runs it against an
  empty database.
- `db:studio` runs `drizzle-kit studio` and replaces `prisma studio`.

The SQLite URL is resolved relative to the working directory, not the schema
directory as Prisma did. `.env.example` and CI therefore point at a repo-root
`dev.db` / `ci.db`, which `.gitignore` covers. `db.ts` strips the `file:`
prefix before opening better-sqlite3.

`src/db/testing.ts` (D4) applies `drizzle/pg` to PGlite, so every unit run
proves the PostgreSQL migration builds a working schema, without a Postgres
server.

### D7. NextAuth adapter swap

`PrismaAdapter(db)` becomes
`DrizzleAdapter(db, { usersTable, accountsTable, verificationTokensTable })`,
passing the tables for the engine in use. The adapter detects the dialect from
the database instance at runtime. No `sessionsTable` is passed: with the JWT
strategy the adapter's session methods are never called, and the app's own
`Session` table has a different shape.

`@auth/drizzle-adapter` is pinned to the exact release whose `@auth/core`
dependency equals the `@auth/core` that `next-auth` pins (0.41.3 today). The
`pnpm why @auth/core` single-version check confirms it. Dependabot's ignore
entry and the ADR-0004 exception list move from `@auth/prisma-adapter` to
`@auth/drizzle-adapter`. `src/auth.config.ts` (edge) is unchanged.

### D8. Schema-parity gate over Drizzle tables

`scripts/lint-schema-parity.mjs` imports both schema modules (Node
type-stripping) and reduces each to
`Map<table, Map<column, { notNull }>>` using `getTableConfig` from
`drizzle-orm/sqlite-core` and `drizzle-orm/pg-core`. The exported pure
`diffSchemas(a, b)` keeps the current reporting style, naming the table and
column that diverge, and adds nullability mismatches. The column type is
deliberately left out of the comparison, because it differs by dialect by
design. The unit test keeps its pure cases and its "committed schemas are at
parity" case.

### D9. Tooling clean-up

- Biome: replace the `!!**/src/generated` exclusion with
  `!!**/drizzle/**/meta`. drizzle-kit rewrites `meta/*.json` on every
  generate, and formatting those files would cause churn.
- oxlint: remove the `src/generated/**` ignore.
- `lint:crap`: remove the `src/generated` walk exclusion and
  `--coverage.exclude`.
- `scripts/biome-config.test.ts`, `scripts/oxlint-config.test.ts` and
  `scripts/lint-crap.test.ts` update their fixtures and case names to match
  the delta specs ("ignores Drizzle migration metadata", "ignores
  next-env.d.ts", "no eslint disable directives in project source").
- `pnpm-workspace.yaml` `allowBuilds`: drop `@prisma/engines` and `prisma`.
  Keep `better-sqlite3` and `esbuild` (drizzle-kit uses esbuild).
- CI and the Playwright weekly workflow: remove "Generate Prisma client",
  replace `prisma migrate deploy` with `pnpm db:migrate`, and change the
  `prisma/**` path filters to `drizzle/**` and `drizzle.*.config.ts`.

## Risks / Trade-offs

- **[Cast hides a dialect difference]** → Every query has an integration test
  on both engines (D4). Allowed operations are documented in `db.ts` (D2).
- **[Adapter type contract differs from expectation]** (for example `image`,
  or `emailVerified` column types) → Task 2.3 type-checks
  `DrizzleAdapter(db, {...})` against both schema modules before migrations
  are generated. If `image` turns out not to be required, it stays anyway:
  it is nullable and the spec now names it.
- **[`@auth/drizzle-adapter` pins a different `@auth/core`]** → Pick the
  matching adapter release. If none matches, stop and report rather than
  allowing two `@auth/core` versions.
- **[Native module bundling]** `better-sqlite3` must stay external to the
  Next.js server bundle. → Next lists it in its default
  `serverExternalPackages`. `pnpm build` in verification confirms it.
- **[Developers keep a stale `prisma/dev.db`]** → README and `.env.example`
  tell developers to run `pnpm db:migrate` against a fresh repo-root `dev.db`.
  The old path stays in `.gitignore`.
- **[Postgres path untested against a real server]** No production instance
  exists. PGlite exercises the PostgreSQL schema and queries, but not the
  `pg` driver or a networked server. → The first
  deployment runs `pnpm db:migrate:prod` and a magic-link smoke test before
  any user is invited.

## Migration Plan

No production instance exists, so there is no data migration or rollback
plan. Merge with CI green (SQLite migrations, both-engine unit suites, Robot
e2e). Developers delete any old `prisma/dev.db` and run `pnpm db:migrate`.

## Open Questions

None.
