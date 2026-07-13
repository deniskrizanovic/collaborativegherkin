## Context

The project keeps **two hand-maintained Prisma schema files** (per ADR/plan
`2026-05-22-14:53-prisma-postgres-provider-fix`): `prisma/schema.prisma`
(`provider = "sqlite"`, dev, with migrations in `prisma/migrations/`) and
`prisma/postgres/schema.prisma` (`provider = "postgresql"`, prod). Prisma does
not accept `env()` for `provider`, so a single file cannot serve both engines;
the two-file split is deliberate. Each is driven by its own
`prisma.config.ts` (`prisma.config.ts` → SQLite, `prisma/postgres/prisma.config.ts`
→ Postgres) and the `db:*:postgres` / `db:migrate:prod` npm scripts.

The split created a drift hazard that has now materialised (ENG-030/031):

| Model / field | SQLite (`prisma/schema.prisma`) | Postgres (`prisma/postgres/schema.prisma`) |
|---|---|---|
| `Session.prompt` `String?` | present | **missing** |
| `Session.model` `String?` | present | **missing** |
| `AppSetting` model | dropped in `per_session_coaching` migration | **still present** |

`src/lib/db.ts` picks the adapter at runtime from `DATABASE_URL` (`file:` →
better-sqlite3, else Postgres/`PrismaPg`) but both adapters share the **one**
generated client from `prisma/schema.prisma` (`output = ../src/generated/prisma`).
So the TypeScript type for `Session` already includes `prompt`/`model`, and
`PATCH /api/sessions/[id]` writes them — against a production table where those
columns do not exist. `AppSetting` is referenced nowhere in `src/` (confirmed by
grep), so it is dead in both the code and the SQLite schema.

There are currently **no** `prisma/postgres/migrations/`; the prod schema has
only ever been used to generate/validate, and any prod deploy runs
`prisma migrate deploy` against that (empty) migrations dir.

## Goals / Non-Goals

**Goals:**
- Bring `prisma/postgres/schema.prisma` to field-parity with SQLite for
  `Session` (`prompt String?`, `model String?`), so the prod write path works.
- Remove the orphaned `AppSetting` model from Postgres so both schemas describe
  the same model set (single source of truth — ENG-031).
- Add a mechanical **parity gate** so this class of drift fails the build rather
  than surfacing in production.
- Document the two-schema convention and the parity mechanism.

**Non-Goals:**
- Collapsing to a single schema file or a generator that emits both — Prisma's
  literal `provider` makes that a larger change; out of scope here.
- ENG-032 (`onDelete: Cascade` on `Session.createdBy`) and ENG-033
  (`@@index([userId])`) — separate findings; touching them here would widen the
  diff and add migration surface. Noted, deferred.
- Running the migration against real production data (CLAUDE.md: not without a
  backup) — this change lands the schema + migration + gate; the prod apply is a
  separate, human-gated operational step.
- Persisting Y.js document state (OPS-001) — unrelated.

## Decisions

**Decision 1 — SQLite schema is the reference for `Session` fields; Postgres is
brought up to it.** The SQLite schema already matches the running application
code and the generated client type. Rationale: it is the source the app is
actually typed against, so aligning Postgres to it is the zero-app-change path.
Alternative (make the app match Postgres by dropping `prompt`/`model`) rejected —
it would delete a shipped feature (per-session coaching) and contradict the
`data-model` spec update.

**Decision 2 — remove `AppSetting` from Postgres rather than re-add it to
SQLite.** It is unreferenced in `src/` and was intentionally dropped from SQLite
by `per_session_coaching`. Rationale: parity should converge on the *live* model
set, not resurrect dead tables. Alternative (add `AppSetting` back to SQLite)
rejected — reintroduces dead schema in both engines.

**Decision 3 — generate a real Postgres migration under
`prisma/postgres/migrations/`** via `prisma migrate dev --config
prisma/postgres/prisma.config.ts` (against a scratch/local Postgres), rather than
hand-writing SQL. Rationale: keeps the migration Prisma-authored and
`migrate deploy`-compatible, and creates the missing migrations directory the
prod path expects. The generated migration will `ALTER TABLE "Session" ADD
COLUMN "prompt"/"model"` and `DROP TABLE "AppSetting"`.

**Decision 4 — enforce parity with a standalone Node script
(`scripts/lint-schema-parity.mjs`) wired into `test:all` + CI**, mirroring the
existing `lint:specs` / `lint:given` / `lint:issue-link` pattern (plain `.mjs`
filesystem checks). It parses both schema files, extracts `model { field }`
sets, and diffs them, ignoring a sanctioned allowlist (datasource `provider`,
generator `output`, engine-native attribute differences). Rationale: consistent
with how this repo already gates invariants; no new dependency, offline-safe so
it can also live in the husky pre-commit hook like `lint:specs`. Alternative
(rely on `prisma validate` or a heavyweight schema-AST library) rejected — the
former does not compare *across* files; the latter adds a dependency for a check
a focused regex/line parser handles.

## Risks / Trade-offs

- **Regex/line-based parser is naive and could miss an exotic field form** →
  keep the parser scoped to the model/field shapes actually used here (simple
  `name Type modifiers`), add a self-test over the current two schemas, and treat
  the gate as a drift *tripwire*, not a full Prisma grammar. If schemas grow
  complex, revisit with a real parser.
- **Dropping `AppSetting` in prod is destructive** → the table is unused, but the
  migration is still a `DROP TABLE`. Mitigation: gated behind the existing
  "backup before prod migration" rule (CLAUDE.md); the migration is reviewed, and
  because `AppSetting` is unreferenced, no code path breaks. Rollback = restore
  from backup / down-migration recreating the table.
- **Parity allowlist could hide a real divergence if too broad** → keep the
  allowlist to the three known-legitimate differences (`provider`, `output`,
  native attrs) and assert nothing else is exempted; the self-test guards this.
- **Someone edits only one schema in future** → that is exactly what the gate
  now catches (build/CI fails), converting a silent prod-only failure into a
  local red check.

## Migration Plan

1. Edit `prisma/postgres/schema.prisma`: add `prompt String?` + `model String?`
   to `Session`; delete the `AppSetting` model.
2. Generate the Postgres migration against a scratch Postgres:
   `npm run db:migrate:dev:postgres` (creates
   `prisma/postgres/migrations/<ts>_reconcile_session_coaching_fields/`).
3. Add `scripts/lint-schema-parity.mjs` + `lint:schema-parity` npm script; wire
   into `test:all` and `.github/workflows/ci.yml` (and husky pre-commit, matching
   `lint:specs`).
4. Update docs: `docs/technical.md` schema table note, `.env.example` comment
   (MIN-005), and a short parity note describing the two-file convention.
5. Verify: `npm run lint:schema-parity` passes; deliberately break one schema →
   gate fails; revert. `npm run test:all` green.
6. **Prod apply (separate, human-gated):** back up the production database, then
   `npm run db:migrate:prod` (`prisma migrate deploy`). Not performed as part of
   landing this change.

**Rollback:** revert the schema/migration commit; if already deployed, restore
the DB from backup or apply a down-migration re-adding `AppSetting` and dropping
the two columns (only if a prod deploy occurred).

## Open Questions

- Does the target production Postgres currently have an `AppSetting` table with
  any rows? If it was never migrated there, the `DROP TABLE` is a no-op and the
  destructive-risk note is moot — confirm before the prod apply step.
