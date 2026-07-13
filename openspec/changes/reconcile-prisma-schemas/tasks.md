## 1. Preparation

- [ ] 1.1 Confirm work is on the `feat/eng-030-reconcile-prisma-schemas` branch (repo forbids editing on `main`); do not commit until asked.
- [ ] 1.2 Read both schemas (`prisma/schema.prisma`, `prisma/postgres/schema.prisma`), both `prisma.config.ts` files, `src/lib/db.ts`, and the `db:*:postgres` / `db:migrate:prod` scripts in `package.json` to confirm the drift and the two-file convention.
- [ ] 1.3 Grep `src/` for `AppSetting` to reconfirm it is unreferenced before removing it.

## 2. Reconcile the Postgres schema

- [ ] 2.1 Add `prompt String?` and `model String?` to the `Session` model in `prisma/postgres/schema.prisma`, matching the SQLite field order.
- [ ] 2.2 Remove the `AppSetting` model from `prisma/postgres/schema.prisma`.
- [ ] 2.3 Run `DATABASE_URL="postgresql://..." npx prisma validate --config prisma/postgres/prisma.config.ts` — schema is valid.

## 3. Generate the Postgres migration

- [ ] 3.1 Against a scratch/local Postgres, run `npm run db:migrate:dev:postgres` to create `prisma/postgres/migrations/<ts>_reconcile_session_coaching_fields/` (this also creates the missing migrations directory).
- [ ] 3.2 Inspect the generated `migration.sql`: it must `ALTER TABLE "Session" ADD COLUMN "prompt"` / `ADD COLUMN "model"` and `DROP TABLE "AppSetting"`, and nothing else.
- [ ] 3.3 Confirm `prisma/postgres/migrations/migration_lock.toml` records `postgresql`.

## 4. Parity gate

- [ ] 4.1 Add `scripts/lint-schema-parity.mjs`: parse both schema files, extract each model's field set, and exit non-zero when the model or field sets diverge — ignoring only the sanctioned differences (datasource `provider`, generator `output`, engine-native attributes). On failure, print the diverging model/field names.
- [ ] 4.2 Add a `lint:schema-parity` script to `package.json` and include it in the `test:all` composite script.
- [ ] 4.3 Add `lint:schema-parity` to `.github/workflows/ci.yml` alongside the other `lint:*` gates, and to the husky pre-commit hook (offline-safe, matching `lint:specs`).
- [ ] 4.4 Sanity-check the gate: it passes on the reconciled schemas; temporarily add a field to one schema only and confirm it fails and names the field; revert.

## 5. Documentation

- [ ] 5.1 Add a short parity note (which file leads for `Session` fields, how to add a field to both, how the gate runs) — in `docs/technical.md` near the existing schema table.
- [ ] 5.2 Fix the `.env.example` prod-DB comment (MIN-005) so it no longer points at a drifted schema.
- [ ] 5.3 Confirm `docs/technical.md` schema table still accurately lists both schema files and their migration dirs (now that `prisma/postgres/migrations/` exists).

## 6. Verification

- [ ] 6.1 Run `npm run lint:schema-parity` — passes.
- [ ] 6.2 Run `npm run test:all` — lint, spec gates (`lint:specs`, `lint:given`, `lint:issue-link`), typecheck, unit, and e2e all pass.
- [ ] 6.3 Confirm ENG-030 is closed: the Postgres `Session` model has `prompt`/`model`, so `PATCH /api/sessions/[id]` writes succeed against Postgres.
- [ ] 6.4 Confirm ENG-031 is closed: the parity gate fails the build on any future single-schema edit; `AppSetting` no longer exists in either schema.
- [ ] 6.5 Mark roadmap step 4 resolved in `docs/architecture-review/mcp-compliance-server-results.md` (progress marker + §15 step 4) at archive time, referencing issue #28.
