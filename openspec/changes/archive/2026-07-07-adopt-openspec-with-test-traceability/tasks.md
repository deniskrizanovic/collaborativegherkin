## 1. Project-local schema clone

- [x] 1.1 Copy the built-in `spec-driven` schema (`<package>/schemas/spec-driven/`) into `openspec/schemas/spec-driven/` (schema.yaml + templates/). Note the base version (1.4.1) in a comment for future re-diffing.
- [x] 1.2 Edit `openspec/schemas/spec-driven/templates/spec.md` so the scenario skeleton includes a `> **Tests:** <!-- path/to.spec.ts — cases, or "none" -->` line between `#### Scenario:` and the WHEN/THEN bullets.
- [x] 1.3 Edit the `specs` artifact `instruction:` in `openspec/schemas/spec-driven/schema.yaml` to require: "Every `#### Scenario:` MUST be immediately followed by a `> **Tests:**` line citing the e2e/unit spec(s), or the literal word `none` when untested."
- [x] 1.4 Run `openspec templates` and confirm the `specs` template now resolves to the project-local path (Source: project), not package.

## 2. Traceability lint gate

- [x] 2.1 Write `scripts/lint-spec-traceability.ts` (or `.mjs`) that globs `openspec/specs/**/*.md` AND `openspec/changes/*/specs/**/*.md`, and for every `#### Scenario:` asserts the next non-empty line is a `> **Tests:**` line; exit non-zero listing each offending file + scenario title.
- [x] 2.2 Write `scripts/lint-spec-traceability.test.ts` covering: link present → pass; `none` → pass; line absent → fail; change-delta spec is scanned. (These are the tests referenced by this change's spec.)
- [x] 2.3 Add an npm script (e.g. `lint:specs`) invoking the gate, and add it to `test:all` alongside the existing lint/typecheck steps.
- [x] 2.4 Run the gate against the current tree; expect it to FAIL on `add-session-ownership-authz` (its scenarios lack `> **Tests:**` lines) — confirming delta scanning works.

## 3. Bring the in-flight change into compliance

- [x] 3.1 Add a `> **Tests:**` line to each of the four scenarios in `openspec/changes/add-session-ownership-authz/specs/session-access-control/spec.md` — pointing at `src/app/api/sessions/[id]/route.test.ts` cases, or `none` where a test does not yet exist. (Behaviour stays owned by that change; this only satisfies the gate.)
- [x] 3.2 Re-run the gate; confirm the in-flight change now passes.

## 4. Config context

- [x] 4.1 Fill in `context:` in `openspec/config.yaml` with the stack (Next.js 15 / TS / Tiptap+Y.js / Prisma / NextAuth / Zod / Pino / Vitest+Playwright) and the transient-session domain note.
- [x] 4.2 Add a `rules.specs:` entry reiterating the `> **Tests:**` requirement (belt-and-suspenders alongside the schema instruction).

## 5. Migrate docs/spec → openspec/specs

- [x] 5.1 Convert `01-session-management` (1.1–1.4 only) → `openspec/specs/session-management/spec.md`: one Requirement per `##` section, one Scenario per `SC-`, `> **Tests:**` links carried across with recomputed relative paths.
- [x] 5.2 Convert `02-gherkin-document-model` → `gherkin-document-model`.
- [x] 5.3 Convert `03-editor` → `gherkin-editor` (core), splitting 3.5 → `realtime-collaboration` and 3.6/3.9 → `gherkin-export`.
- [x] 5.4 Convert `04-api` 4.1/4.2 (collection endpoints only) → `sessions-api`. Leave 4.3/4.4 for `session-access-control`.
- [x] 5.5 Convert `05-data-model` → `data-model`, `07-import` → `gherkin-import`, `08-llm-review` → `llm-review`.
- [x] 5.6 Run `openspec validate --specs --strict` and the traceability gate over all migrated specs; fix any failures.

## 6. Finalise

- [x] 6.1 Decide the fate of `docs/spec/` originals (delete vs keep as human narrative) now that converted output can be compared; keep `06-out-of-scope` / `99-Cosmic-Point-Count` as plain docs regardless. **Decision:** keep the 8 migrated originals with a prepended "SUPERSEDED → openspec/specs/…" redirect note; delete none.
- [x] 6.2 Run `npm run test:all`; confirm the traceability gate runs and the suite is green.
- [x] 6.3 Report outcome and wait for a commit instruction (per CLAUDE.md — no auto-commit).
