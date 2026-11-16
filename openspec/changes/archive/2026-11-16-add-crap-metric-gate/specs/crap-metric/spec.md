## ADDED Requirements

### Requirement: Each function gets a CRAP score

The `lint:crap` gate SHALL score every function in scope with
`CRAP = comp² × (1 − cov)³ + comp`. `comp` is the function's cyclomatic
complexity and `cov` is its unit-test coverage as a fraction from 0 to 1.
Function declarations, function expressions, arrow functions, class methods,
constructors and get/set accessors SHALL each count as a function.

#### Scenario: An untested function is scored on complexity alone
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — scores an untested complexity-6 function at 42
- **GIVEN** a function with cyclomatic complexity 6 that no unit test executes
- **WHEN** the gate scores it
- **THEN** its CRAP score is 42

#### Scenario: A fully covered function scores its complexity
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — scores a fully covered complexity-12 function at its complexity
- **GIVEN** a function with cyclomatic complexity 12 whose every branch is executed by unit tests
- **WHEN** the gate scores it
- **THEN** its CRAP score is 12

#### Scenario: A partly covered function is scored on both factors
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — scores a complexity-10 function with half its branch arms covered at 22.5
- **GIVEN** a function with cyclomatic complexity 10 whose unit tests execute half of its branches
- **WHEN** the gate scores it
- **THEN** its CRAP score is 22.5

### Requirement: Cyclomatic complexity counts decision points

A function's cyclomatic complexity SHALL be 1 plus one for each of these
inside its body: `if`, the conditional operator `?:`, `for`, `for…in`,
`for…of`, `while`, `do…while`, each `case` clause (not `default`), `catch`,
and each `&&`, `||` and `??` operator. A function nested inside another
function SHALL be scored on its own, and its decision points SHALL NOT count
toward the function that contains it.

#### Scenario: Decision points add to the base complexity
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — adds one for if, &&, and each case clause but not default; counts every listed decision point
- **GIVEN** a function whose body holds one `if` with an `a && b` condition and a `switch` with two `case` clauses and a `default`
- **WHEN** the gate measures its complexity
- **THEN** its cyclomatic complexity is 5

#### Scenario: A nested callback is measured separately
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — measures a nested arrow callback separately from its parent; leaves a nested function's branch arms out of its parent's coverage
- **GIVEN** a function with no branches of its own that passes an arrow function containing two `if` statements to `Array.prototype.map`
- **WHEN** the gate measures both functions
- **THEN** the outer function has complexity 1 and the arrow function has complexity 3

### Requirement: Coverage comes from the Vitest unit suite

A function's coverage SHALL come from a run of the Vitest unit suite with
coverage enabled. It SHALL be the share of branch arms inside the function
that the suite executed. A function with no branch arms SHALL use the share of
its statements that were executed instead. A file that no unit test loads
SHALL count as 0% covered. Robot and Playwright e2e runs SHALL NOT contribute
coverage.

#### Scenario: A module never imported by a unit test is uncovered
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — gives 0% coverage to every function in a file missing from the coverage map
- **GIVEN** a source file under `src/` that no unit test imports, directly or through other modules
- **WHEN** the gate scores its functions
- **THEN** each of them is reported with 0% coverage

#### Scenario: E2e-only code counts as uncovered
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — gives 0% coverage to every function in a file missing from the coverage map (e2e runs are never instrumented, so e2e-only code is absent from the map)
- **GIVEN** a React component that only the Robot e2e suite renders
- **WHEN** the gate scores the component's functions
- **THEN** each of them is reported with 0% coverage

### Requirement: The gate scores application code under src/

The gate SHALL score every `.ts` and `.tsx` file under `src/`. It SHALL skip
test files (`*.test.*`, `*.spec.*`), type declaration files (`*.d.ts`) and
generated code under `src/generated/`. Files outside `src/` SHALL NOT be
scored.

#### Scenario: Test and generated files are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — collects .ts and .tsx under src/, skipping tests, declarations, generated code and scripts/
- **GIVEN** a complex untested function in `src/lib/session.test.ts` and another in a file under `src/generated/`
- **WHEN** the gate runs
- **THEN** neither function appears in its report and neither affects its exit code

#### Scenario: Scripts outside src/ are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — collects .ts and .tsx under src/, skipping tests, declarations, generated code and scripts/
- **GIVEN** a complex untested function in a file under `scripts/`
- **WHEN** the gate runs
- **THEN** that function does not appear in its report

### Requirement: Any function scoring above 30 fails the gate

The gate SHALL exit non-zero when any function in scope has a CRAP score
above 30, and SHALL exit zero otherwise. A score of exactly 30 SHALL pass.
When it fails, it SHALL list every offending function, worst first, with its
file and line, its name (or `<anonymous>`), its complexity, its coverage and
its score. The gate SHALL have no allowlist, baseline file or suppression
comment that exempts a function.

#### Scenario: One offender fails the gate
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — fails on one offender and lists its file, line, name, complexity, coverage and score
- **GIVEN** a source tree in which exactly one function, `handleKey` in `src/components/useGherkinKeyboard.ts`, scores 42
- **WHEN** the gate runs
- **THEN** it exits non-zero and its report lists `handleKey` with its file, line, complexity, coverage and score of 42

#### Scenario: A score of exactly 30 passes
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — passes when the worst function scores exactly 30
- **GIVEN** a source tree whose worst function has complexity 5 and no coverage, which scores 30
- **WHEN** the gate runs
- **THEN** it exits zero

#### Scenario: A comment does not exempt an offender
> **Tests:** [`scripts/lint-crap.test.ts`](../../../../../scripts/lint-crap.test.ts) — still fails an offender with a comment asking to skip the CRAP check
- **GIVEN** a function scoring above 30 with a comment above it asking to skip the CRAP check
- **WHEN** the gate runs
- **THEN** it still lists that function and exits non-zero

### Requirement: The gate runs in test:all and CI

The `lint:crap` script SHALL be part of the `test:all` aggregate script. CI
(`.github/workflows/ci.yml`) SHALL run it as its own step, so a failing score
fails the CI run. The gate SHALL NOT run in the husky pre-commit hook, because
it runs the whole unit suite under coverage.

#### Scenario: test:all invokes the CRAP gate
> **Tests:** none
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `pnpm test:all` on a tree with a function scoring above 30
- **THEN** the CRAP gate runs and its failure fails the overall run

#### Scenario: CI fails on an offender
> **Tests:** none
- **GIVEN** a pushed commit that adds a function scoring above 30
- **WHEN** the CI workflow runs
- **THEN** its CRAP gate step fails and the run is marked failed

#### Scenario: The current codebase passes
> **Tests:** none
- **GIVEN** the repository at the end of this change
- **WHEN** `pnpm lint:crap` runs
- **THEN** no function scores above 30 and the gate exits zero
