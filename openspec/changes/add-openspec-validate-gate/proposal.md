## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/72

## Why

No gate runs `openspec validate`, so structural spec problems are only found by
someone who happens to run it by hand. Archiving `decouple-crap-from-ts-api`
showed this: `crap-metric` still has the `TBD - created by archiving change …`
Purpose placeholder from when it was created, and nothing flagged it. The
`openspec` CLI is not a project dependency (it is installed globally on the
developer's machine), so CI could not run it today even if asked.

Without `--strict`, the tree passes (19 of 19 items) because warnings do not
fail it. With `--strict`, 14 of 19 specs fail on 29 warnings: 5 Purpose
placeholders and 24 requirements whose text is over 500 characters.

## What Changes

- Add `@fission-ai/openspec` as a devDependency, so CI and every clone run the
  same CLI version.
- Add a `lint:openspec` script that runs
  `openspec validate --all --strict --no-interactive` with OpenSpec telemetry
  off. It fails on any error or warning in a main spec or an active change.
- Run `lint:openspec` in the husky pre-commit hook, in `test:all` and as a CI
  step, next to `lint:specs` and `lint:given`. It is a pure filesystem check
  (about 0.25 s), so it is safe offline.
- Clear the 29 existing warnings so the gate passes on day one:
  - Write a real `## Purpose` for `code-formatting`, `code-linting`,
    `crap-metric`, `dependency-maintenance` and `robot-e2e-suite`.
  - Bring the 24 over-long requirements under 500 characters by tightening
    their prose or splitting them into several requirements. No requirement
    loses a SHALL, and no scenario is added, removed, renamed or reworded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `spec-authoring-standards`: specs and active changes must pass
  `openspec validate --strict`, and that gate runs in pre-commit, `test:all`
  and CI.

The Purpose rewrites and requirement trims in the 14 affected specs are editorial:
they keep every normative statement and every scenario, so they are edited in
place rather than through delta specs (design D4).

## Impact

- Dependencies: `@fission-ai/openspec` devDependency (Node `>=22.12.0`, which
  CI's Node 22 and local Node 24 meet).
- Scripts and config: `package.json` (`lint:openspec`, `test:all`),
  `.husky/pre-commit`, `.github/workflows/ci.yml`, and a wiring test next to the
  other gate tests in `scripts/`.
- Specs: `spec-authoring-standards` (delta, plus in-place trims of its own
  long requirements), and in-place edits to
  `change-issue-traceability`, `code-formatting`, `code-linting`,
  `crap-metric`, `data-model`, `dependency-maintenance`,
  `gherkin-document-model`, `gherkin-editor`, `gherkin-import`, `llm-review`,
  `realtime-collaboration`, `robot-e2e-suite` and `session-access-control`.
- Workflow: a commit that leaves a spec or active change with a validation
  warning is now blocked at pre-commit. New capabilities created by
  `openspec archive` get the TBD Purpose, so the archive commit must replace it.
- Docs: `CLAUDE.md` key-commands block lists `pnpm lint:openspec`.
- No application code changes.
