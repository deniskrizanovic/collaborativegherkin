## Context

`lint:crap` shows which functions the unit suite executes. It cannot show
whether the suite would fail if a function returned the wrong thing. Issue #60
asks for mutation testing with Stryker to close that gap.

Facts about the current repo that shape the design:

- Unit tests are Vitest 5 (`vitest.config.ts`), picking up `src/**` and
  `scripts/**` test files. `@stryker-mutator/vitest-runner` 10.x supports
  `vitest >=2`.
- The unit-tested logic lives in `src/lib/*.ts` (`gherkin`, `session`, `user`,
  `wsAuth`, `coaching`, `db`, `logger`, `llm-constants`) and `src/db/`. UI
  components, API routes and pages are covered by the Robot e2e suite only.
  Stryker cannot see e2e coverage, so mutating them would only report "no
  coverage".
- Weekly scheduled work already has a precedent: `playwright-weekly.yml` runs
  on a cron, opens one drift issue on failure and closes it on the next green
  run.
- `typescript` is at 7.x, whose package no longer exposes a JS compiler API
  (see the `crap-metric` spec). Stryker's optional TypeScript checker needs
  that API.

## Goals / Non-Goals

**Goals:**

- A one-command local mutation run over the pure logic, with a readable report.
- A score floor that fails the run, so the score cannot erode unnoticed.
- A weekly CI run on `main` that surfaces a drop without blocking merges.
- Tests that kill the real survivors the baseline exposed, so the score clears
  a fixed floor of 80 (D3, D8).
- A staged-file run in the pre-commit hook, so changed code arrives with tests
  that catch its mutants (D9).

**Non-Goals:**

- Mutating UI, API routes, pages or `scripts/`.
- Running the full mutation run per PR, in `test:all` or in the pre-commit
  hook.
- Testing survivors that only blank prompt or message text (D8 marks them
  ignored instead).
- Incremental mode across CI runs (see D5).

## Decisions

### D1. Vitest runner, no TypeScript checker

Use `@stryker-mutator/core` with `@stryker-mutator/vitest-runner` and leave
`checkers` empty. The TypeScript checker discards mutants that fail to compile,
which raises the score's accuracy, but it depends on the TypeScript compiler
API that TypeScript 7 does not ship. Without it, uncompilable mutants run as
ordinary mutants and die on a runtime or Vitest transform error, which counts
as killed. That inflates the score slightly, and the threshold is calibrated on
the same basis, so the trend stays honest. Revisit when a checker supports the
native compiler.

TypeScript 7 also breaks Stryker core itself, not only the checker: the sandbox
step `TSConfigPreprocessor` calls `ts.parseConfigFileTextToJson`, which TS 7
lacks, and the run dies with `ts.parseConfigFileTextToJson is not a function`.
`stryker.config.json` sets `tsconfigFile` to a file that does not exist, so the
preprocessor finds no tsconfig to rewrite and skips. The sandbox needs no
tsconfig: Vitest transpiles without it and the `@` alias lives in
`vitest.config.ts`. The alternative, `inPlace: true`, would mutate the working
tree during a run. Drop the workaround when Stryker supports TS 7.

Two further settings are needed in this repo: `plugins` names
`@stryker-mutator/vitest-runner` explicitly, because pnpm's strict
`node_modules` hides it from Stryker's default plugin lookup, and
`ignorePatterns` excludes `.venv`, `.claude`, `.next`, `coverage`, `reports`,
`test-results` and `logs` from the sandbox copy (the `.claude` skill links break
the copy, and `.venv` adds thousands of files). Config tests under `scripts/`
read `openspec/`, `docs/`, `e2e/` and `robot/`, so those stay in the sandbox.

Alternative: pin `typescript` for Stryker only. Rejected, since it would
contradict ADR 0004 (latest stable) and add a second TypeScript.

### D2. Scope is `src/lib`, minus tests, declarative data and wiring

`mutate` globs: `src/lib/**/*.ts`, with exclusions for `**/*.test.ts`,
`**/*.spec.ts`, `**/*.d.ts`, `src/lib/llm-constants.ts`, `src/lib/logger.ts`
and `src/lib/db.ts`. `src/db/` is not mutated at all. This is the logic the
unit suite is responsible for. The Gherkin rules in `src/lib/gherkin.ts` are
in scope; the run only reads that file, so this does not touch the "Do Not
Touch" rule.

Alternative: all of `src/` as `lint:crap` does. Rejected: e2e-only files would
be thousands of no-coverage mutants and drown the score in noise.

The first draft kept the schema files in scope. The baseline showed the two
schema files hold 109 of 523 mutants and score about 19% (94 survivors:
blanked column names, removed `onDelete` / `onUpdate` actions, removed unique
constraints and `$defaultFn`). Most of those mutants cannot be killed by a
behaviour test: `createTestDb` applies the committed migrations, so the real
tables, constraints and foreign-key actions come from the SQL, and a mutant
that removes `unique()` or `onDelete` only changes Drizzle's in-memory schema
object. Blanked column names survive only on tables no unit test queries.
The schema files leave `mutate`. The constraints they describe are real
behaviour, so D8 tests them against the migrated database instead, and
`lint:schema-parity` keeps guarding the two schema files against each other.

`src/lib/llm-constants.ts` is constant data (24 string-literal survivors; a
test that repeats each string adds nothing). `src/lib/logger.ts` and
`src/lib/db.ts` are wiring with no unit coverage, exercised by the e2e suites.
All three leave `mutate`. `src/db/testing.ts` is no longer matched by any
glob, so its explicit exclusion goes.

### D3. A fixed `break` of 80

`break` is 80, `low` 85, `high` 90. The spec requires `break` to be at least
80 and the ordering `break < low < high`; the values live in
`stryker.config.json`.

The first draft calibrated `break` a few points below the baseline. The
baseline (first full run, 2026-11-17) was a total score of 57.55 (65.15 of
covered code), 523 mutants (300 killed, 1 timeout, 161 survived, 61 no
coverage), run time about 16 minutes at `concurrency: 2`. Per file:
`session.ts` and `user.ts` 100, `gherkin.ts` 90.31, `wsAuth.ts` 79.37,
`coaching.ts` 57.50, `schema.sqlite.ts` 20.34, `schema.pg.ts` 18.97, `db.ts`,
`logger.ts` and `llm-constants.ts` 0. Thresholds were then `break` 52, `low`
60, `high` 80.

A floor calibrated to a score dominated by unkillable mutants measures
little. Re-scored on the D2 scope, the same baseline is about 85% (278 killed
of 327), so 80 holds today and the D8 tests add margin. The D8 tests land
before the threshold rises (tasks 6 and 7), and task 7.7 confirms the full
run clears 80 and records the new score here.

Result after the D8 tests (2026-11-17): total score 96.32 (97.21 of covered
code), 329 mutants (314 killed, 9 survived, 3 no coverage, 3 ignored by the D8
disable comments), run time about 45 seconds at `concurrency: 2`. Per file:
`session.ts` and `user.ts` 100, `gherkin.ts` 98.47, `coaching.ts` 94.87,
`wsAuth.ts` 88.89. The remaining survivors in `gherkin.ts` and `wsAuth.ts`
are equivalent mutants, each covered by a second guard: the `\s+` after the
keyword (line 97) and the `trim` at line 122 cover each other, as do the blank
line skip (line 103) and the regexes; in `wsAuth.ts` the empty-token check
(line 67), the `catch` (line 76) and the null-payload check (line 79) all end
in `unauthenticated`, because `decode` returns null only for an empty token,
and `roomFromUrl(undefined)` yields `""` from either default. In
`coaching.ts` the two optional-chaining survivors at line 48 throw inside the
`try`, so `retryAfter` stays null either way.

### D4. Weekly workflow modelled on `playwright-weekly.yml`

New `.github/workflows/mutation-weekly.yml`: cron weekly (Monday 04:00 UTC, an
hour after the Playwright run so the two do not compete), `workflow_dispatch`,
`permissions: contents: read, issues: write`, `timeout-minutes: 60`. Steps:
checkout, pnpm setup, Node 22, `pnpm install --frozen-lockfile`,
`pnpm run test:mutation`, upload `reports/mutation/` with `if: always()`.
Drift issue steps copy the Playwright pattern with the `mutation-drift` label:
failure on `schedule` opens or comments; success on `main` comments and
closes. The run needs no database, auth secrets or browsers, because unit tests
use in-memory SQLite or PGlite via `src/db/testing.ts`.

Alternative: run on every PR. Rejected by the user: too slow, and a PR gate
would block merges on a statistic.

### D5. No incremental cache across runs

Stryker's `--incremental` can reuse results from a prior run. It would need a
stored baseline artifact and logic to retrieve it, and a stale cache can hide
regressions. The run is weekly and small (a few hundred lines of source), so a full
run is simpler and correct. Revisit if runtime passes the timeout budget.

### D6. Concurrency and temp directory

Set `concurrency` explicitly low enough for a two-core GitHub runner, and
`tempDirName` to `.stryker-tmp`, which `.gitignore` lists. Reports go to
`reports/mutation/` (`htmlReporter.fileName` and `jsonReporter.fileName`).
Reporters: `html`, `json`, `clear-text`, `progress`.

### D7. Config test pins what the spec promises

`scripts/mutation-config.test.ts` reads `stryker.config.json` and `package.json`
and asserts the Vitest runner, the `mutate` scope and exclusions, `break` at
least 80 and the threshold ordering, the report paths, that `test:all` and
`ci.yml` do not run `test:mutation`, and that lint-staged runs
`test:mutation:staged` last for `.ts` files. Scenarios about the workflow's run
and the issue lifecycle stay `> **Tests:** none`, as the Playwright drift
workflow's do; they are verified by dispatching the workflow once after merge.

### D8. Tests for the real survivors

The baseline survivors in scope fall into two groups.

Behaviour gaps, which get tests:

- `wsAuth.ts` (security-relevant): cookie parsing at lines 38–40 (a value that
  contains `=`, a part with no `=`, `slice(eq + 1)`), the session-cookie regex
  at line 27 (suffix and prefix junk), the path regex at line 49, and the
  reject branches at lines 67, 76, 79 and 88, each asserted to reject.
- `coaching.ts`: response parsing at lines 48 and 61 — an error body with no
  `metadata` or no `retry_after_seconds`, an empty `choices` array, and a
  choice with no `message` — and the request shape at lines 23–34: the
  endpoint URL, `POST`, the `Content-Type` and `Authorization` headers, the
  model and the `system` / `user` message roles. Without the request-shape
  tests the file scores 74, below `break`, and the staged-file run in D9
  would reject any commit that touches it.
- `gherkin.ts`: the keyword and table regexes at lines 97–99 (the `^` and `$`
  anchors, `\s` against `\s+` after a heading or list marker, table rows
  without a leading or trailing `|`), the `trim` calls at lines 102 and 122,
  and the optional chaining at lines 45 and 73. Tests go in
  `src/lib/gherkin.test.ts`; `gherkin.ts` itself is not edited.

Text-only survivors, which are not tested: mutants in `coaching.ts` that blank
the system prompt or a message string change no control flow, and a test that
repeats the string adds nothing. Each such line gets a
`// Stryker disable next-line StringLiteral: error message text, no behaviour` comment,
so Stryker reports those mutants as ignored and they count neither for nor
against the score. Without the comment, an edit to only that text would fail
the staged-file run in D9. The comment is a source annotation on one line and
one mutator, not a threshold exemption in the config, and it is limited to
string literals whose value no code branches on.

Database constraints, tested against the migrated database since the schema
files leave `mutate` (D2): `src/db/schema.test.ts` runs on both engines via
`createTestDb("sqlite")` and `createTestDb("pg")` and asserts that a duplicate
`User.email` is rejected, a duplicate (`provider`, `providerAccountId`)
`Account` is rejected, a duplicate (`identifier`, `token`) `VerificationToken`
is rejected, deleting a `User` deletes their `Account` rows, deleting a `User`
who owns a `Session` is rejected, and an inserted `User` or `Session` with no
`id` gets a CUID and a `Session` gets `createdAt` and `updatedAt`, with
`updatedAt` moving on update. These close the `data-model` scenarios that are
`> **Tests:** none` today.

### D9. Staged-file mutation run in the pre-commit hook

`scripts/mutation-staged.mjs` (`pnpm test:mutation:staged`) runs Stryker on
every in-scope file the commit stages, whole file:

1. Take the file paths lint-staged passes, and keep those matched by the
   `mutate` globs in `stryker.config.json` (so tests, excluded files and
   anything outside `src/lib/` drop out). The globs are read from the config,
   not duplicated.
2. If no file remains, exit 0 without starting Stryker.
3. Otherwise run `stryker run --mutate <files> --reporters clear-text,progress
   --allowEmpty`. Only console reporters, so the staged run never overwrites
   the full run's `reports/mutation/` files. `--allowEmpty` makes a file with
   no mutants (types only) pass rather than error.
4. Stryker applies the same `break` (80) to the score of those files' mutants
   and exits non-zero below it, which fails the commit.

Wiring: the command is the last entry of the `*.{ts,tsx}` array in
`package.json`'s `lint-staged`, after Biome, oxlint and `tsc`. Entries in one
array run in order, so Biome's rewrite has finished before Stryker copies the
sandbox, and lint-staged stashes unstaged changes while it runs, so Stryker
sees the staged content.

The file-filtering logic and the Stryker argument list are pure functions
exported from the script and unit tested in `scripts/mutation-staged.test.ts`.

Because the whole file is scored, touching a file means owning its score: a
one-line edit to a file below 80 fails until the file's tests improve. The D8
tests land first (task 7) so no in-scope file starts below 80. Text-only lines
take the D8 disable comment. `--no-verify` stays the user's escape hatch,
never the agent's (CLAUDE.md).

Alternatives: only the changed lines, via `git diff -U0` hunks turned into
`<file>:<start>-<end>` ranges (rejected by the user as overkill: more logic to
build and test for a faster hook); a Claude-only commit hook (rejected by the
user: human commits would skip it); report-only (rejected by the user).

## Risks / Trade-offs

- [Run time grows with the codebase] → `timeout-minutes: 60`, a scope limited
  to unit-tested code, and the incremental option noted in D5.
- [The pre-commit run slows commits] → Sandbox start-up plus a run over each
  staged in-scope file; a commit touching `gherkin.ts` (196 mutants) took about
  30 seconds on 2026-11-17, accepted by the user. Commits that stage no
  in-scope file skip Stryker entirely.
- [Stryker's sandbox copy is slow on a large tree] → `ignorePatterns` already
  trims it (D1); if start-up dominates the staged run, revisit with
  `inPlace` once TS 7 support lands.
- [Flaky tests turn into false survivors or false kills] → Stryker runs each
  test per mutant with coverage analysis; a flaky test shows up as an unstable
  score. Fix the flake, do not raise `break` tolerance.
- [Uncompilable mutants inflate the score without a type checker] → Calibrate
  `break` on the same basis (D1, D3).
- [A fixed `break` of 80 fails if the D8 tests fall short] → Task 7.7 runs the
  full mutation run and confirms the score clears 80 before merge.
- [Stryker's Vitest runner lags a new Vitest major] → Pin through the lockfile;
  Dependabot bumps both together, and the weekly run reports a break.
- [Dependabot auto-merge of Stryker bumps could ship a broken runner] → The
  mutation run is not in `ci.yml`, so such a bump merges green. The weekly
  drift issue is the backstop.
