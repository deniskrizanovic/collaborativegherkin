## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/74

## Why

The 18 capability specs sit flat under `openspec/specs/`, mixing product
behaviour (editor, sessions) with engineering gates (linting, CRAP, Robot) and
process rules (spec authoring, issue traceability). The list is hard to scan
and grows with every gate. Moving the specs also exposes a second problem.
`> **Tests:**` links are relative, so they break when a spec moves. 20 of the
339 links are already broken, because archive copies delta text written at a
different directory depth than the main spec.

## What Changes

- Move every main spec into a domain category folder. Leaf names stay the
  same, and spec ids become path-like:
  - `product/gherkin/`: `gherkin-document-model`, `gherkin-editor`,
    `gherkin-export`, `gherkin-import`, `llm-review`, `realtime-collaboration`
  - `product/sessions/`: `session-management`, `session-access-control`,
    `sessions-api`, `data-model`
  - `quality/`: `code-formatting`, `code-linting`, `crap-metric`,
    `robot-e2e-suite`, `test-auth-bypass`, `dependency-maintenance`
  - `process/`: `spec-authoring-standards`, `change-issue-traceability`
- Move the active `add-dependabot-automerge` delta from
  `specs/dependency-maintenance/` to `specs/quality/dependency-maintenance/`.
  If it stayed flat, archiving it would create a duplicate top-level spec.
- Rewrite every local link in main specs and active deltas to repo-root form
  (`/scripts/x.test.ts`). These links stay valid after a move and after an
  archive. Repair the 20 broken links as part of the rewrite.
- Add a `lint:spec-layout` gate that covers `openspec/specs/**` and
  `openspec/changes/*/specs/**`. It fails when:
  - a `spec.md` is outside `product/`, `quality/` or `process/`
  - a local link is relative
  - a repo-root link points to a file that does not exist

  The gate is offline. It runs in husky pre-commit, `test:all` and CI.
- Update `openspec/schemas/spec-driven/schema.yaml`, the proposal template,
  `openspec/config.yaml` spec rules and `CLAUDE.md`. They should describe
  category paths and repo-root links, so new deltas land in the right place.
- Update stale prose paths in the `docs/spec/*` redirect headers,
  `robot/README.md`, `robot/PARITY.md` and the Robot suite and resource
  `Documentation` lines. Update the path in `scripts/biome-config.test.ts`.
- **BREAKING** for authors: spec ids change, e.g. `gherkin-editor` becomes
  `product/gherkin/gherkin-editor` in `openspec show` and in delta paths. App
  behaviour does not change.
- `openspec/changes/archive/**` is history and stays as it is.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `process/spec-authoring-standards` (currently `spec-authoring-standards`):
  - adds the category-layout rule
  - adds the repo-root link rule with target resolution
  - wires the `lint:spec-layout` gate into pre-commit, `test:all` and CI

## Impact

- `openspec/specs/**`: 18 directories moved, and local links rewritten in
  every spec.
- `openspec/changes/add-dependabot-automerge/specs/`: delta moved, and its
  links rewritten.
- New `scripts/lint-spec-layout.mjs` and its test. Changes to `package.json`
  (`lint:spec-layout` and `test:all`), `.husky/pre-commit` and
  `.github/workflows/ci.yml`.
- OpenSpec workflow config: `openspec/schemas/spec-driven/schema.yaml`,
  `openspec/schemas/spec-driven/templates/proposal.md` and
  `openspec/config.yaml`.
- Docs: `CLAUDE.md`, `docs/spec/0*.md`, `robot/README.md`, `robot/PARITY.md`
  and `robot/suites/*.robot` plus `robot/resources/steps/*.resource`
  (comments only).
- `scripts/biome-config.test.ts` (path fixture).
- No runtime code, database or API changes.
