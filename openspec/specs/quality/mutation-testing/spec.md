# mutation-testing Specification

## Purpose

Stryker mutation testing measures whether the unit suite would notice a wrong
line, which coverage alone cannot show. This capability covers which files the
run mutates, the reports it writes, the `break` threshold that fails it, the
staged-file run in the pre-commit hook, and the weekly workflow that runs it on
`main` and raises one drift issue on a scheduled failure.

## Requirements

### Requirement: A Stryker run mutates the library source and judges it by the unit suite

The project SHALL provide a `pnpm test:mutation` script that runs Stryker with
the Vitest runner, configured in `stryker.config.json`. The run SHALL mutate
the `.ts` files under `src/lib/` and judge each mutant by the existing Vitest
unit suite. It SHALL NOT mutate test files, type declaration files,
declarative or wiring files with no unit-testable behaviour, or any file
outside `src/lib/`.

#### Scenario: Library source is mutated
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — mutates library source
- **GIVEN** `src/lib/gherkin.ts` has unit tests in `src/lib/gherkin.test.ts`
- **WHEN** a developer runs `pnpm test:mutation`
- **THEN** Stryker generates mutants in `src/lib/gherkin.ts` and runs the Vitest unit suite against each one

#### Scenario: Test files and declaration files are not mutated
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — does not mutate test files or declaration files
- **GIVEN** `src/lib/gherkin.test.ts` exists
- **WHEN** a developer runs `pnpm test:mutation`
- **THEN** it does not appear in the mutation report

#### Scenario: Declarative and wiring files are not mutated
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — does not mutate declarative and wiring files
- **GIVEN** `src/lib/llm-constants.ts`, `src/lib/logger.ts`, `src/lib/db.ts`, `src/db/schema.sqlite.ts` and `src/db/schema.pg.ts` exist
- **WHEN** a developer runs `pnpm test:mutation`
- **THEN** none of them appears in the mutation report

#### Scenario: Application code outside the library is not mutated
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — does not mutate application code outside src/lib
- **GIVEN** a React component under `src/components/` that only the Robot e2e suite exercises
- **WHEN** a developer runs `pnpm test:mutation`
- **THEN** the component does not appear in the mutation report

### Requirement: A run writes an HTML and a JSON report

Each full run SHALL write an HTML report and a JSON report under
`reports/mutation/`, and SHALL print a per-file score table to the console. The
reports SHALL list every surviving mutant with its file, line and the change
made. `reports/` and Stryker's temporary directory SHALL be git-ignored.

#### Scenario: A finished run leaves reports on disk
> **Tests:** none
- **GIVEN** a clean checkout with no `reports/` directory
- **WHEN** `pnpm test:mutation` finishes
- **THEN** `reports/mutation/mutation.html` and `reports/mutation/mutation.json` exist, and the console shows a score for each mutated file

#### Scenario: Run output is not committed
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — keeps run output out of git
- **GIVEN** a finished mutation run that left `reports/mutation/` and a Stryker temp directory in the working tree
- **WHEN** a developer runs `git status`
- **THEN** neither directory is listed as untracked

### Requirement: A mutation score below the break threshold fails the run

`stryker.config.json` SHALL set a `break` threshold of at least 80. When the
total mutation score falls below it, `pnpm test:mutation` SHALL exit non-zero.
When the score is at or above it, the command SHALL exit zero. The threshold
SHALL be a single value in the config file, with no per-file or per-mutant
exemption in it. The `high` and `low` thresholds SHALL be set above `break`, so
the report separates passing, borderline and failing scores.

#### Scenario: A score below the threshold fails
> **Tests:** none
- **GIVEN** a break threshold of 80 and a source change whose tests leave the total score at 75
- **WHEN** `pnpm test:mutation` runs
- **THEN** it reports the score and exits non-zero

#### Scenario: A score at the threshold passes
> **Tests:** none
- **GIVEN** a break threshold of 80 and tests that leave the total score at exactly 80
- **WHEN** `pnpm test:mutation` runs
- **THEN** it exits zero

#### Scenario: The threshold is configured
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — orders break below low below high
- **GIVEN** the repository at the end of this change
- **WHEN** `stryker.config.json` is read
- **THEN** its `break` threshold is at least 80 and below its `low` threshold, and its `low` threshold is below its `high` threshold

### Requirement: The full mutation run stays out of the fast gates

The `test:mutation` script SHALL NOT be part of `test:all`, the husky
pre-commit hook, or the per-push CI workflow (`.github/workflows/ci.yml`),
because a full run takes many times longer than the unit suite.

#### Scenario: test:all does not run mutation testing
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — is not part of test:all
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `pnpm test:all`
- **THEN** no Stryker process starts

#### Scenario: Per-push CI does not run mutation testing
> **Tests:** [`scripts/mutation-config.test.ts`](/scripts/mutation-config.test.ts) — is not run by per-push CI
- **GIVEN** a pushed commit that triggers `.github/workflows/ci.yml`
- **WHEN** the CI run executes
- **THEN** none of its steps runs `test:mutation` or `test:mutation:staged`

### Requirement: Staged library files are mutation-tested before a commit lands

A `pnpm test:mutation:staged` script, run by the husky pre-commit hook after
formatting, linting and type checking, SHALL mutate every whole file the
commit stages that the `mutate` globs match. It SHALL fail the commit when
those files' mutants score below `break`, SHALL pass when there are none, and
SHALL NOT overwrite the full run's reports.

#### Scenario: A staged library file is mutated whole
> **Tests:** [`scripts/mutation-staged.test.ts`](/scripts/mutation-staged.test.ts) — mutates the whole staged file and returns Stryker's exit code
- **GIVEN** a commit that stages a change to lines 38 to 40 of `src/lib/wsAuth.ts` and no other in-scope file
- **WHEN** the pre-commit hook runs
- **THEN** Stryker mutates all of `src/lib/wsAuth.ts` and no other file

#### Scenario: Out-of-scope files do not start Stryker
> **Tests:** [`scripts/mutation-staged.test.ts`](/scripts/mutation-staged.test.ts) — does not start Stryker when no staged file is in scope; drops tests, excluded files and paths outside src/lib
- **GIVEN** a commit that stages only `src/lib/gherkin.test.ts`, `src/lib/llm-constants.ts` and a component under `src/components/`
- **WHEN** the pre-commit hook runs
- **THEN** no Stryker process starts and the hook continues

#### Scenario: A staged file scoring below the threshold fails the commit
> **Tests:** none
- **GIVEN** a staged `src/lib/session.ts` whose mutants the unit suite catches fewer than 80% of
- **WHEN** the pre-commit hook runs
- **THEN** the hook prints the surviving mutants and the commit is rejected

#### Scenario: A staged file with no mutants passes
> **Tests:** [`scripts/mutation-staged.test.ts`](/scripts/mutation-staged.test.ts) — names each kept file and uses only console reporters and --allowEmpty
- **GIVEN** a staged file under `src/lib/` that declares only types
- **WHEN** the pre-commit hook runs
- **THEN** the staged mutation run exits zero and the commit proceeds

#### Scenario: The staged run leaves the full report alone
> **Tests:** [`scripts/mutation-staged.test.ts`](/scripts/mutation-staged.test.ts) — names each kept file and uses only console reporters and --allowEmpty
- **GIVEN** `reports/mutation/mutation.json` from an earlier full run
- **WHEN** the pre-commit hook runs the staged mutation run
- **THEN** `reports/mutation/mutation.json` is unchanged

### Requirement: A weekly workflow runs mutation testing on main

A `Mutation testing` GitHub Actions workflow (`.github/workflows/mutation-weekly.yml`)
SHALL run `pnpm test:mutation` on a weekly schedule against `main` and on manual
dispatch. It SHALL upload `reports/mutation/` as a workflow artifact whether the
run passes or fails, and SHALL set a job timeout so a hung run ends.

#### Scenario: The scheduled run publishes the report
> **Tests:** none
- **GIVEN** the weekly schedule fires on `main`
- **WHEN** the workflow's mutation run finishes, passing or failing
- **THEN** the run has a `mutation-report` artifact holding the HTML and JSON reports

#### Scenario: A maintainer starts a run by hand
> **Tests:** none
- **GIVEN** a maintainer on the repository's Actions page
- **WHEN** they dispatch the `Mutation testing` workflow
- **THEN** the same mutation run starts on the chosen branch

### Requirement: A failed scheduled run raises one drift issue

When the scheduled run fails, the workflow SHALL open one GitHub issue labelled
`mutation-drift` that links the failed run, or SHALL comment on the open one if
it exists. The next successful run on `main` SHALL comment on that issue and
close it. A drift issue SHALL NOT block merges, and a manually dispatched run
SHALL NOT open one.

#### Scenario: First scheduled failure opens an issue
> **Tests:** none
- **GIVEN** no open `mutation-drift` issue and a scheduled run whose score is below the break threshold
- **WHEN** the run fails
- **THEN** one issue labelled `mutation-drift` is opened with a link to the failed run

#### Scenario: A repeated failure comments instead of opening a second issue
> **Tests:** none
- **GIVEN** an open `mutation-drift` issue and a second scheduled run that also fails
- **WHEN** the second run fails
- **THEN** the run's link is added as a comment on the existing issue and no second issue is opened

#### Scenario: A green run closes the issue
> **Tests:** none
- **GIVEN** an open `mutation-drift` issue and a scheduled run on `main` that meets the break threshold
- **WHEN** the run succeeds
- **THEN** the workflow comments on the issue with the run's link and closes it
