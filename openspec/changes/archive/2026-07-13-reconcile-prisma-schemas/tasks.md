## 1. Preparation

- [x] 1.1 Confirm work is on the `feat/eng-030-reconcile-prisma-schemas` branch (repo forbids editing on `main`); do not commit until asked.
- [x] 1.2 Read both schemas (`prisma/schema.prisma`, `prisma/postgres/schema.prisma`), both `prisma.config.ts` files, `src/lib/db.ts`, and the `db:*:postgres` / `db:migrate:prod` scripts in `package.json` to confirm the drift and the two-file convention.
- [x] 1.3 Grep `src/` for `AppSetting` to reconfirm it is unreferenced before removing it.

## 2. Reconcile the Postgres schema

- [x] 2.1 Add `prompt String?` and `model String?` to the `Session` model in `prisma/postgres/schema.prisma`, matching the SQLite field order.
- [x] 2.2 Remove the `AppSetting` model from `prisma/postgres/schema.prisma`.
- [x] 2.3 Run `DATABASE_URL="postgresql://..." npx prisma validate --config prisma/postgres/prisma.config.ts` — schema is valid. (Note: `--config` doubles the schema path; validated via `--schema prisma/postgres/schema.prisma` instead — valid.)

## 3. Generate the Postgres migration

- [x] 3.1 Against a scratch/local Postgres, run `npm run db:migrate:dev:postgres` to create `prisma/postgres/migrations/<ts>_reconcile_session_coaching_fields/` (this also creates the missing migrations directory). (No Postgres/Docker in this env; migration SQL generated offline via `prisma migrate diff --from-schema <pre-change committed schema> --to-schema prisma/postgres/schema.prisma --script`, then materialized as `prisma/postgres/migrations/20260713054717_reconcile_session_coaching_fields/`.)
- [x] 3.2 Inspect the generated `migration.sql`: it must `ALTER TABLE "Session" ADD COLUMN "prompt"` / `ADD COLUMN "model"` and `DROP TABLE "AppSetting"`, and nothing else. (Confirmed: one `AlterTable` adding `model`/`prompt` and one `DropTable "AppSetting"`, nothing else.)
- [x] 3.3 Confirm `prisma/postgres/migrations/migration_lock.toml` records `postgresql`.

## 4. Parity gate

- [x] 4.1 Add `scripts/lint-schema-parity.mjs`: parse both schema files, extract each model's field set, and exit non-zero when the model or field sets diverge — ignoring only the sanctioned differences (datasource `provider`, generator `output`, engine-native attributes). On failure, print the diverging model/field names. (Added script + `scripts/lint-schema-parity.test.ts`, mirroring the other lint gates.)
- [x] 4.2 Add a `lint:schema-parity` script to `package.json` and include it in the `test:all` composite script.
- [x] 4.3 Add `lint:schema-parity` to `.github/workflows/ci.yml` alongside the other `lint:*` gates, and to the husky pre-commit hook (offline-safe, matching `lint:specs`). (Also added `prisma/**` and `scripts/**` to the CI `paths` filter so a schema-only change actually triggers the gate.)
- [x] 4.4 Sanity-check the gate: it passes on the reconciled schemas; temporarily add a field to one schema only and confirm it fails and names the field; revert. (Verified: fails with exit 1 naming `Session.strayField`, passes after revert, schema byte-identical.)

## 5. Documentation

- [x] 5.1 Add a short parity note (which file leads for `Session` fields, how to add a field to both, how the gate runs) — in `docs/technical.md` near the existing schema table.
- [x] 5.2 Fix the `.env.example` prod-DB comment (MIN-005) so it no longer points at a drifted schema.
- [x] 5.3 Confirm `docs/technical.md` schema table still accurately lists both schema files and their migration dirs (now that `prisma/postgres/migrations/` exists). (Table lists both files + both migration dirs; four models, no `AppSetting` — accurate.)

## 6. Verification

- [x] 6.1 Run `npm run lint:schema-parity` — passes.
- [x] 6.2 Run `npm run test:all` — lint, spec gates (`lint:specs`, `lint:given`, `lint:issue-link`), typecheck, unit, and e2e all pass. (All gates + typecheck + 217 unit tests + 102 e2e pass. Note: e2e requires `PORT` unset — the sandbox shell exports `PORT=0`, which pushes Next.js off port 3000 and times out Playwright's webServer; unrelated to this change.)
- [x] 6.3 Confirm ENG-030 is closed: the Postgres `Session` model has `prompt`/`model`, so `PATCH /api/sessions/[id]` writes succeed against Postgres.
- [x] 6.4 Confirm ENG-031 is closed: the parity gate fails the build on any future single-schema edit; `AppSetting` no longer exists in either schema. (`AppSetting` remains only in migration history, not in either live schema.)
- [x] 6.5 Mark roadmap step 4 resolved in `docs/architecture-review/mcp-compliance-server-results.md` (progress marker + §15 step 4) at archive time, referencing issue #28.
