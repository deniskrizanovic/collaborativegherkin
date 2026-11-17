## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/60

## Why

Line and branch coverage, which `lint:crap` already reads, only show that a
test executed a line. They do not show that any assertion would notice if the
line were wrong. The Gherkin rules in `src/lib/gherkin.ts`, the session and
access logic in `src/lib/session.ts` and `src/lib/wsAuth.ts`, and the export
path all carry the project's core guarantees, and a suite can hit 100% coverage
of them while asserting almost nothing. Mutation testing measures that gap
directly: it changes the code, re-runs the tests, and counts the changes the
tests fail to catch.

## What Changes

- Add Stryker (`@stryker-mutator/core` with `@stryker-mutator/vitest-runner`)
  and a `stryker.config.json` that mutates the non-test source under `src/lib/`
  using the existing Vitest unit suite. Declarative and wiring files that no
  unit test can meaningfully kill are excluded: `src/db/schema.*.ts`,
  `src/lib/llm-constants.ts`, `src/lib/logger.ts` and `src/lib/db.ts`.
- Add a `pnpm test:mutation` script that runs a full mutation run and writes an
  HTML and JSON report under `reports/mutation/`.
- Set a fixed `break` threshold of 80 in the Stryker config (`low` 85, `high`
  90), so a run whose mutation score falls below it exits non-zero.
- Add unit tests that kill the surviving mutants the baseline exposed in
  `src/lib/wsAuth.ts`, `src/lib/coaching.ts` and `src/lib/gherkin.ts`, and a
  `src/db/schema.test.ts` that checks the database constraints (unique keys,
  `onDelete` behaviour, generated ids and timestamps) on both engines.
- Add a `pnpm test:mutation:staged` script, run by the husky pre-commit hook
  through lint-staged, that mutates every in-scope file the commit stages
  (whole file) and fails the commit when their mutation score is below
  `break`.
- Add a `Mutation testing` GitHub Actions workflow that runs the full mutation
  run weekly on `main` and on manual dispatch, uploads the report as an
  artifact, and on a scheduled failure opens (or comments on) one
  `mutation-drift` issue that the next green run closes. This mirrors the
  weekly Playwright workflow.
- Git-ignore Stryker's temp directory and report output.
- The full mutation run is not part of `test:all`, the per-push CI workflow or
  the husky pre-commit hook, because it takes many times longer than the unit
  suite. Only the staged-file run is in the pre-commit hook.
- Document the commands in `CLAUDE.md` and `README.md`.

## Capabilities

### New Capabilities

- `quality/mutation-testing`: how the Stryker mutation run is configured and
  invoked, which files it mutates, the score threshold that fails it, the
  staged-file run in the pre-commit hook, and the weekly workflow that runs it
  and reports drift.

### Modified Capabilities

- `product/sessions/data-model`: the existing `Session` and `User` constraint
  scenarios gain tests, and a new requirement specifies the `Account` and
  `VerificationToken` constraints and the delete behaviour of a `User`'s
  dependent records. The schema files leave the mutation scope, so these
  tests are what guard the constraints.

`quality/crap-metric` keeps its own coverage run and is untouched.

## Impact

- New dev dependencies: `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`.
- New files: `stryker.config.json`, `.github/workflows/mutation-weekly.yml`,
  `scripts/mutation-config.test.ts`, `scripts/mutation-staged.mjs`,
  `scripts/mutation-staged.test.ts`, `src/db/schema.test.ts`.
- Edited files: `package.json` (scripts, lint-staged and dev dependencies),
  `pnpm-lock.yaml`, `.gitignore`, `CLAUDE.md`, `README.md`, and the unit tests
  for `wsAuth`, `coaching` and `gherkin`.
- No behaviour change to application code, and no edit to `src/lib/gherkin.ts`
  or the Y.js sync layer. `src/lib/gherkin.ts` gains tests only.
  `src/lib/coaching.ts` gains `// Stryker disable` comments on its prompt-text
  lines only.
- Commits that stage in-scope `src/lib/` files take longer: Stryker's sandbox
  start-up plus a run over each staged file (about 30 seconds when
  `gherkin.ts` is staged).
- Adds a weekly CI job, roughly the cost of the unit suite multiplied by the
  mutant count, bounded by a workflow timeout.
