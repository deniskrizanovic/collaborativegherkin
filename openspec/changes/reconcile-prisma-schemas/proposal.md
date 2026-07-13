## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/28

## Why

The two hand-maintained Prisma schemas have drifted (findings **ENG-030** /
**ENG-031**, High, Block — remediation roadmap Phase 1, step 4). The production
PostgreSQL `Session` model (`prisma/postgres/schema.prisma`) is **missing the
`prompt` and `model` fields** that the SQLite dev schema (`prisma/schema.prisma`)
has, so `PATCH /api/sessions/[id]` writing per-session coaching settings will
fail at runtime in production. Conversely, `AppSetting` still exists **only** in
the Postgres schema (it was dropped from SQLite by the `per_session_coaching`
migration and is referenced nowhere in `src/`). There is no single source of
truth and no parity check, so this class of drift can recur silently and only
surface in production.

## What Changes

- Add `prompt String?` and `model String?` to the `Session` model in
  `prisma/postgres/schema.prisma`, bringing the production schema to field-parity
  with SQLite and with the `PATCH /api/sessions/[id]` write path.
- Remove the orphaned `AppSetting` model from `prisma/postgres/schema.prisma`
  (dead in SQLite since `per_session_coaching`; unreferenced in code), so the two
  schemas describe the same set of models. **BREAKING** for any deployed Postgres
  database that already has an `AppSetting` table — handled as a documented,
  reviewed migration step, not an ad-hoc drop.
- Establish a **parity gate**: a lint/check script (wired into `test:all` and CI)
  that fails when the model/field sets of the SQLite and Postgres schemas diverge
  (allowing only the sanctioned `provider`/`output`/datasource differences), so
  "no single source of truth" (ENG-031) is enforced mechanically going forward.
- Document the two-schema arrangement and the parity mechanism (which file leads,
  how to add a field to both, how the gate runs) so the divergence is traceable
  (ENG-031, ENG-CTRL-09 parity).

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `data-model`: The `Session` record requirement is extended to include the
  optional `prompt` and `model` coaching fields as persisted attributes, and a
  new requirement mandates that the SQLite and PostgreSQL schemas stay at
  model/field parity (enforced by a parity gate). Both are spec-level behaviour:
  what a `Session` persists, and the cross-engine consistency guarantee.

## Impact

- **Schema:** `prisma/postgres/schema.prisma` — add `prompt`/`model` to `Session`,
  remove `AppSetting`. `prisma/schema.prisma` (SQLite) is already correct and is
  the reference for `Session` fields.
- **Migrations:** a new Postgres migration under `prisma/postgres/migrations/`
  (the directory does not yet exist) adding the two columns and dropping
  `AppSetting`. Applied via the existing `db:migrate:prod` script
  (`prisma migrate deploy`). Per CLAUDE.md, must not run against prod data without
  a backup.
- **Tooling:** new `scripts/lint-schema-parity.mjs` (or equivalent) plus a
  `lint:schema-parity` npm script, added to `test:all` and `.github/workflows/ci.yml`.
- **Docs:** `docs/technical.md` (schema table), `.env.example` (MIN-005 comment),
  and a short parity note; roadmap step 4 marked resolved on archive.
- **Standards:** Closes ENG-030 and ENG-031 (ENG-CTRL-09 config isolation/parity;
  ENG-CTRL-06 3.1 reproducible builds; ENG-CTRL-02 3.5 single source of truth).
- No application-code or API-shape changes; no new runtime dependencies.
