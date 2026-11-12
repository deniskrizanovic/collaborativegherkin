## ADDED Requirements

### Requirement: Robot is the only e2e suite that runs on every change

The Robot suite SHALL be the only e2e suite run by CI on push and pull request,
and by `pnpm e2e:all` and `pnpm test:all`. A Robot failure MUST fail the CI job,
and `robot/results/` MUST be uploaded whether the step passes or fails. The
Playwright suite MUST stay in the repository, runnable by hand with
`pnpm test:e2e`, and covered by `pnpm typecheck` and `pnpm lint` in CI.

#### Scenario: A Robot failure fails CI and the report is kept
> **Tests:** none
- **GIVEN** a pull request in which one Robot test fails
- **WHEN** the CI workflow runs
- **THEN** the job fails, and the Robot `log.html` and `report.html` are downloadable as an artifact

#### Scenario: CI does not run the Playwright suite
> **Tests:** none
- **GIVEN** a pull request in which a Playwright test in `e2e/` would fail at runtime but still typechecks and lints
- **WHEN** the CI workflow runs
- **THEN** no Playwright test is executed, and the job's result depends only on the lint, typecheck, unit and Robot steps

#### Scenario: The aggregate test script runs only Robot for e2e
> **Tests:** none
- **GIVEN** a developer checkout with the dev server and Robot toolchain installed
- **WHEN** the developer runs `pnpm test:all`
- **THEN** the Robot suite runs and the Playwright suite does not

#### Scenario: Playwright can still be run by hand
> **Tests:** none
- **GIVEN** a developer checkout with Playwright browsers installed
- **WHEN** the developer runs `pnpm test:e2e`
- **THEN** the full Playwright suite runs and the command exits non-zero when any Playwright test fails

### Requirement: The Playwright suite runs weekly and reports drift as an issue

A GitHub Actions workflow SHALL run `pnpm test:e2e` against `main` every Monday
and on manual dispatch, and MUST upload `test-results/` when a run fails. A
failed scheduled run MUST open one issue labelled `playwright-drift`, or comment
on the open one, linking the run and naming the failing tests. A passing run on
`main` MUST comment on the open drift issue and close it. A failed manual run
MUST NOT file anything, and a drift issue MUST NOT block merges.

#### Scenario: A failing scheduled run opens a drift issue
> **Tests:** none
- **GIVEN** no open issue labelled `playwright-drift`, and a Playwright test on `main` that fails
- **WHEN** the scheduled weekly Playwright run executes
- **THEN** a new issue labelled `playwright-drift` is open, linking the run and naming the failing test, and the run's `test-results/` artifact is downloadable

#### Scenario: Repeated failures add to the existing drift issue
> **Tests:** none
- **GIVEN** an open issue labelled `playwright-drift`, and a Playwright test on `main` that still fails
- **WHEN** the next scheduled weekly Playwright run executes
- **THEN** the existing issue gains a comment linking the new run and naming the failing test, and no second drift issue is opened

#### Scenario: A passing run closes the drift issue
> **Tests:** none
- **GIVEN** an open issue labelled `playwright-drift`, and every Playwright test on `main` passing
- **WHEN** a Playwright run on `main` executes, scheduled or manually dispatched
- **THEN** the issue gains a comment linking the passing run and is closed

#### Scenario: A failing manual run does not file an issue
> **Tests:** none
- **GIVEN** no open issue labelled `playwright-drift`, and a Playwright test that fails
- **WHEN** a maintainer dispatches the Playwright workflow by hand
- **THEN** the run fails with `test-results/` uploaded, and no drift issue is opened

## MODIFIED Requirements

### Requirement: Every Playwright test has a Robot counterpart

Every `test(...)` in `e2e/*.spec.ts` SHALL have exactly one Robot test case that
exercises the same behaviour with assertions at least as strong. This includes
each test a single `test(...)` call generates, for example in a loop. A
`test.skip` SHALL map to a Robot test tagged `skip` with the same reason. Each
Robot test name MUST equal the Playwright test title exactly, so it keeps the
`SC-x.y.z` identifier when one is present. A checklist at `robot/PARITY.md` MUST
have exactly one row per Playwright test, naming its spec file, title and Robot
suite. Every row MUST be marked `ported`, or `skip` for a skipped test. A change
that adds, renames, removes or skips a Playwright test MUST update its Robot
counterpart and its `PARITY.md` row in the same change.

An offline lint gate, `pnpm lint:e2e-parity`, SHALL enforce this requirement. It
MUST read the Playwright tests from `playwright test --list`, not by parsing
source, so generated titles are seen. It MUST NOT start a server or open a
browser. It MUST run in the husky pre-commit hook, in CI and in `pnpm test:all`.
It MUST exit non-zero and name the spec file and title of each mismatch when:

- a Playwright test has no `PARITY.md` row;
- a `PARITY.md` row names a Playwright test that does not exist;
- a row is marked anything other than `ported` or `skip`;
- the row's Robot suite has no test case with exactly the Playwright title;
- the Playwright test, its row and its Robot test do not agree on being skipped.

#### Scenario: A ported test keeps its scenario identifier
> **Tests:** none
- **GIVEN** the Playwright test `SC-7.1.4: Cancel closes modal without inserting` in `e2e/import.spec.ts`
- **WHEN** it is ported
- **THEN** `robot/suites/import.robot` contains a test case with exactly that name, and `robot/PARITY.md` maps the two

#### Scenario: The parity checklist is complete at the end
> **Tests:** none
- **GIVEN** the Playwright suite, `robot/PARITY.md` and `robot/suites/` as they stand when this change lands
- **WHEN** `pnpm lint:e2e-parity` runs
- **THEN** it exits zero, because every Playwright test has a Robot counterpart and no row is marked pending

#### Scenario: A new Playwright test without a Robot twin is rejected
> **Tests:** [`scripts/lint-e2e-parity.test.ts`](../../../scripts/lint-e2e-parity.test.ts) — fails on a listed test with no PARITY.md row
- **GIVEN** a Playwright test whose title has no row in `robot/PARITY.md`
- **WHEN** the e2e parity gate runs
- **THEN** it fails and names the spec file and title

#### Scenario: A stale parity row is rejected
> **Tests:** [`scripts/lint-e2e-parity.test.ts`](../../../scripts/lint-e2e-parity.test.ts) — fails on a PARITY.md row with no listed test
- **GIVEN** a `robot/PARITY.md` row whose Playwright title was renamed or deleted in `e2e/`
- **WHEN** the e2e parity gate runs
- **THEN** it fails and names the stale row's spec file and title

#### Scenario: A pending row is rejected
> **Tests:** [`scripts/lint-e2e-parity.test.ts`](../../../scripts/lint-e2e-parity.test.ts) — fails on a row marked pending
- **GIVEN** a `robot/PARITY.md` row marked `pending`
- **WHEN** the e2e parity gate runs
- **THEN** it fails and names the row

#### Scenario: A missing Robot test is rejected
> **Tests:** [`scripts/lint-e2e-parity.test.ts`](../../../scripts/lint-e2e-parity.test.ts) — fails when the named suite has no test with the exact title
- **GIVEN** a `robot/PARITY.md` row whose Robot suite has no test case named exactly as the Playwright title
- **WHEN** the e2e parity gate runs
- **THEN** it fails and names the suite and the missing title

#### Scenario: A test generated in a loop is checked
> **Tests:** [`scripts/lint-e2e-parity.test.ts`](../../../scripts/lint-e2e-parity.test.ts) — checks every listed title, including generated ones
- **GIVEN** a Playwright `test(...)` call inside a loop that produces two titles, only one of which has a `PARITY.md` row
- **WHEN** the e2e parity gate runs
- **THEN** it fails and names the title without a row

#### Scenario: Skip status must agree
> **Tests:** [`scripts/lint-e2e-parity.test.ts`](../../../scripts/lint-e2e-parity.test.ts) — fails when Playwright skip, row status and Robot skip tag disagree
- **GIVEN** a Playwright `test.skip` whose Robot test is not tagged `skip`
- **WHEN** the e2e parity gate runs
- **THEN** it fails and names the test

## REMOVED Requirements

### Requirement: The Robot suite runs in CI alongside Playwright
**Reason**: CI no longer runs Playwright. Robot is the only e2e suite run on every change, and Playwright runs weekly instead.
**Migration**: See the ADDED requirements "Robot is the only e2e suite that runs on every change" and "The Playwright suite runs weekly and reports drift as an issue". The Robot CI step and its `robot/results/` artifact are unchanged.

### Requirement: The port is delivered in independently green chunks
**Reason**: The chunked port is finished, and every `robot/PARITY.md` row is `ported` or `skip`. This requirement also needed `pnpm test:e2e` to pass for each chunk, but CI no longer runs Playwright.
**Migration**: Ongoing parity is enforced by the `pnpm lint:e2e-parity` gate in the modified requirement "Every Playwright test has a Robot counterpart". The existing `chunk<N>` tags on Robot tests can stay as historical labels, and nothing depends on them.
