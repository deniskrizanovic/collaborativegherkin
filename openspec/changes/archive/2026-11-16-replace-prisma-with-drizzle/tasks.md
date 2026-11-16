## 1. Dependencies

- [x] 1.1 Add `drizzle-orm`, `better-sqlite3`, `pg`, `@paralleldrive/cuid2`; add dev deps `drizzle-kit`, `@types/better-sqlite3`, `@types/pg`, `@electric-sql/pglite` (latest stable, per ADR-0004)
- [x] 1.2 Pick the exact `@auth/drizzle-adapter` release whose `@auth/core` dependency equals the one `next-auth` pins; add it at an exact version and confirm `pnpm why @auth/core` shows one version (stop and report if none matches)
- [x] 1.3 Update `pnpm-workspace.yaml` `allowBuilds`: drop `@prisma/engines` and `prisma`, keep `better-sqlite3` and `esbuild`

## 2. Schema modules

- [x] 2.1 Write `src/db/schema.pg.ts` keeping today's table and column names: `timestamp(3)` types, `createdAt` DB default, `updatedAt` via `$defaultFn`/`$onUpdate`, cuid2 `$defaultFn` on ids, today's uniques and FK delete rules, and nullable `User.image`
- [x] 2.2 Write `src/db/schema.sqlite.ts` with the same exported identifiers, SQL names, nullability and constraints, using `integer({ mode: "timestamp_ms" })` timestamps
- [x] 2.3 Type-check `DrizzleAdapter(db, { usersTable, accountsTable, verificationTokensTable })` against both schema modules and fix any column-type mismatch the adapter contract reports

## 3. Migrations

- [x] 3.1 Add `drizzle.sqlite.config.ts` and `drizzle.pg.config.ts` (output `drizzle/sqlite/`, `drizzle/pg/`)
- [x] 3.2 Generate a single `0000_init` migration for each engine
- [x] 3.3 Add `db:generate`, `db:migrate`, `db:migrate:prod` (`drizzle-kit migrate` with the pg config) and `db:studio` scripts; remove `db:generate:postgres` and `db:migrate:dev:postgres`

## 4. Database module and test harness

- [x] 4.1 Rewrite `src/lib/db.ts`: runtime engine switch on the `file:` prefix (prefix stripped for better-sqlite3), export `db` (typed as the Postgres database), `tables` and `closeDb()`, keep the dev-mode global singleton, and add a comment listing the allowed cross-dialect operations (design D2)
- [x] 4.2 Add `src/db/testing.ts` `createTestDb("sqlite" | "pg")`, which applies the matching migrations to better-sqlite3 `:memory:` or in-process PGlite and returns `{ db, tables, close }`

## 5. Application code

- [x] 5.1 Rewrite the `Session` service on Drizzle with `{ db, tables }` deps and the same public interface; `update`/`delete` throw `SessionNotFoundError` when `returning` yields no row; remove the `P2025` handling
- [x] 5.2 Rewrite `src/lib/session.test.ts` to run every case on both engines via `createTestDb` (`describe.each`), replacing the `vi.fn` Prisma fakes; keep the error-propagation cases
- [x] 5.3 Add `src/lib/user.ts` `ensureUserByEmail(db, tables, email)` and `src/lib/user.test.ts` (both engines: creates when absent, returns the existing row unchanged when present)
- [x] 5.4 Update `src/app/page.tsx`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts` and `src/app/api/llm-review/route.ts` to build `Session` with `{ db, tables }`
- [x] 5.5 Change `src/app/sessions/[id]/page.tsx` to use `Session.get` and call `notFound()` on `SessionNotFoundError`
- [x] 5.6 Update the route tests that `vi.mock("@/lib/db")` to return a `createTestDb("sqlite")` instance instead of Prisma-shaped fakes
- [x] 5.7 Update the Prisma comment in `src/lib/wsAuth.ts` to name cuid2; no regex change

## 6. Auth

- [x] 6.1 In `src/auth.ts`, replace `PrismaAdapter` with `DrizzleAdapter` passing the engine's user, account and verification-token tables; route the test-bypass upsert through `ensureUserByEmail`
- [x] 6.2 Update `src/auth.test.ts` mocks for the new adapter and helper; confirm the test-bypass cases still pass

## 7. Seed and e2e setup

- [x] 7.1 Move the seed to `scripts/seed.ts` on Drizzle (`onConflictDoNothing`, fixed id and name, `closeDb()`); point `pnpm seed` at it
- [x] 7.2 Update `e2e/global-setup.ts` to use `ensureUserByEmail` and `closeDb()`

## 8. Schema-parity gate

- [x] 8.1 Rewrite `scripts/lint-schema-parity.mjs` to import both schema modules, reduce them with `getTableConfig` to table → column → `notNull`, and report table, column and nullability divergence via a pure `diffSchemas`
- [x] 8.2 Rewrite `scripts/lint-schema-parity.test.ts` with the cases the data-model delta cites (column on one table only, table in one schema only, nullability mismatch, matching schemas pass, committed schemas at parity)

## 9. Tooling and CI

- [x] 9.1 Biome: replace the `src/generated` exclusion with `drizzle/**/meta`; update `scripts/biome-config.test.ts` ("ignores Drizzle migration metadata")
- [x] 9.2 oxlint: drop the `src/generated/**` ignore; update `scripts/oxlint-config.test.ts` ("ignores next-env.d.ts", "no eslint disable directives in project source")
- [x] 9.3 `lint:crap`: remove the `src/generated` exclusions and update `scripts/lint-crap.test.ts`
- [x] 9.4 CI and `playwright-weekly.yml`: remove the Prisma generate step, run `pnpm db:migrate`, point `DATABASE_URL` at the repo-root `ci.db`, and change `prisma/**` path filters to `drizzle/**` and `drizzle.*.config.ts`
- [x] 9.5 Dependabot: ignore `@auth/drizzle-adapter` instead of `@auth/prisma-adapter`; update the ADR-0004 exception list so `lint:dependabot` passes
- [x] 9.6 Update the `.husky/pre-commit` schema-parity comment

## 10. Remove Prisma

- [x] 10.1 Delete `prisma/`, `prisma.config.ts` and `src/generated/`; uninstall `prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3`, `@prisma/adapter-pg` and `@auth/prisma-adapter`
- [x] 10.2 Confirm `rg -i prisma` outside `docs/` history, `openspec/changes/archive/`, and `tokencost/` returns nothing; update `.gitignore` (`dev.db`, `ci.db`)

## 11. Docs

- [x] 11.1 Update `.env.example`, README (setup and commands), `docs/technical.md`, `CLAUDE.md` (stack, commands, structure) and the `context` in `openspec/config.yaml`
- [x] 11.2 Add `docs/adr/0009-drizzle-replaces-prisma.md` and a `docs/DECISIONS.md` entry
- [x] 11.3 Update the `> **Tests:**` lines in the delta specs for the scenarios now covered (user creation via magic link)

## 12. Verify

- [x] 12.1 Recreate the local `dev.db` with `pnpm db:migrate`, run `pnpm seed` and `pnpm dev`, then sign in, create, open, edit and delete a session
- [x] 12.2 Run `pnpm build`, which confirms `better-sqlite3` stays external to the server bundle
- [x] 12.3 Run `pnpm test:all` until green
- [x] 12.4 Run `openspec validate replace-prisma-with-drizzle`
