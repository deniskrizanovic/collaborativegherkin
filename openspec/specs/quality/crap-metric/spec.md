# crap-metric Specification

## Purpose

The `lint:crap` gate relates each function's complexity to how well the unit
tests cover it, using the CRAP score (`comp² × (1 − cov)³ + comp`), and fails
when any function under `src/` scores above 30. This capability covers how
complexity and coverage are measured, which files are scored, the report's
shape and options, and where the gate runs. Complex, untested code is where
edits break things; a failing function passes once it gains tests or is
simplified.

## Requirements

### Requirement: Each function gets a CRAP score

The `lint:crap` gate SHALL score every function in scope with
`CRAP = comp² × (1 − cov)³ + comp`. `comp` is the function's cyclomatic
complexity and `cov` is its unit-test coverage as a fraction from 0 to 1.
Function declarations, function expressions, arrow functions, class methods,
constructors and get/set accessors SHALL each count as a function.

#### Scenario: An untested function is scored on complexity alone
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — scores an untested complexity-6 function at 42
- **GIVEN** a function with cyclomatic complexity 6 that no unit test executes
- **WHEN** the gate scores it
- **THEN** its CRAP score is 42

#### Scenario: A fully covered function scores its complexity
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — scores a fully covered complexity-12 function at its complexity
- **GIVEN** a function with cyclomatic complexity 12 whose every branch is executed by unit tests
- **WHEN** the gate scores it
- **THEN** its CRAP score is 12

#### Scenario: A partly covered function is scored on both factors
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — scores a complexity-10 function with half its branch arms covered at 22.5
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
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — adds one for if, &&, and each case clause but not default; counts every listed decision point
- **GIVEN** a function whose body holds one `if` with an `a && b` condition and a `switch` with two `case` clauses and a `default`
- **WHEN** the gate measures its complexity
- **THEN** its cyclomatic complexity is 5

#### Scenario: A nested callback is measured separately
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — measures a nested arrow callback separately from its parent; leaves a nested function's branch arms out of its parent's coverage
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
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — gives 0% coverage to every function in a file missing from the coverage map
- **GIVEN** a source file under `src/` that no unit test imports, directly or through other modules
- **WHEN** the gate scores its functions
- **THEN** each of them is reported with 0% coverage

#### Scenario: E2e-only code counts as uncovered
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — gives 0% coverage to every function in a file missing from the coverage map (e2e runs are never instrumented, so e2e-only code is absent from the map)
- **GIVEN** a React component that only the Robot e2e suite renders
- **WHEN** the gate scores the component's functions
- **THEN** each of them is reported with 0% coverage

### Requirement: The gate scores source files under src/

The gate SHALL score every `.ts` and `.tsx` file under `src/`. It SHALL skip
test files (`*.test.*`, `*.spec.*`) and type declaration files (`*.d.ts`).
Files outside `src/` SHALL NOT be scored.

#### Scenario: Test files are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — collects .ts and .tsx under src/, skipping tests, declarations and scripts/
- **GIVEN** a complex untested function in `src/lib/session.test.ts`
- **WHEN** the gate runs
- **THEN** that function does not appear in its report and does not affect its exit code

#### Scenario: Scripts outside src/ are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — collects .ts and .tsx under src/, skipping tests, declarations and scripts/
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
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — fails on one offender and lists its file, line, name, complexity, coverage and score
- **GIVEN** a source tree in which exactly one function, `handleKey` in `src/components/useGherkinKeyboard.ts`, scores 42
- **WHEN** the gate runs
- **THEN** it exits non-zero and its report lists `handleKey` with its file, line, complexity, coverage and score of 42

#### Scenario: A score of exactly 30 passes
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — passes when the worst function scores exactly 30
- **GIVEN** a source tree whose worst function has complexity 5 and no coverage, which scores 30
- **WHEN** the gate runs
- **THEN** it exits zero

#### Scenario: A comment does not exempt an offender
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — still fails an offender with a comment asking to skip the CRAP check
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

### Requirement: The report can list every function

With `--all`, the gate's report SHALL list every scored function, worst first,
in the same columns as the offender list. The exit code SHALL still follow the
threshold. `test:all` and CI SHALL run the gate without `--all`.

#### Scenario: All functions are listed when every score passes
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — lists every function when every score passes, and exits zero
- **GIVEN** a source tree whose only function scores 12
- **WHEN** the gate runs with `--all`
- **THEN** its report lists that function with its file, line, complexity, coverage and score of 12, and it exits zero

#### Scenario: Listing all functions still fails on an offender
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — lists an offender above a passing function, and exits non-zero
- **GIVEN** a source tree with one function scoring 42 and another scoring 12
- **WHEN** the gate runs with `--all`
- **THEN** its report lists the 42 function above the 12 function, and it exits non-zero

### Requirement: The report can be limited to one path

With `--file <path>`, the gate's report and exit code SHALL cover only
functions in that file, or in files under that directory. The path is relative
to the working directory, and `--file` SHALL combine with `--all`. When the
path matches no scored file, or an argument is not a known option, the gate
SHALL say why and exit 2. `test:all` and CI SHALL run the gate without
`--file`.

#### Scenario: An offender outside the path does not fail a path run
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — ignores an offender outside a file path, so the run passes
- **GIVEN** a function scoring 42 in `src/lib/a.ts` and a function scoring 12 in `src/lib/b.ts`
- **WHEN** the gate runs with `--file src/lib/b.ts`
- **THEN** its report does not mention `src/lib/a.ts`, and it exits zero

#### Scenario: A directory path covers the files under it
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — covers the files under a directory path, and only those
- **GIVEN** a function scoring 42 in `src/lib/a.ts`
- **WHEN** the gate runs with `--file src/lib`
- **THEN** its report lists that function, and it exits non-zero

#### Scenario: A path matching no scored file is an error
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — reports that no scored file matches the path, and exits 2
- **GIVEN** a source tree with no file under `src/missing/`
- **WHEN** the gate runs with `--file src/missing`
- **THEN** it reports that no scored file matches the path, and it exits 2

### Requirement: Complexity measurement does not depend on the TypeScript compiler API

The gate SHALL find functions and measure their cyclomatic complexity without
importing the `typescript` package. Its scores SHALL NOT change when the
installed TypeScript version changes, including a TypeScript release that
ships no JavaScript compiler API.

#### Scenario: The gate runs with a TypeScript release that has no compiler API
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — does not import the typescript package
- **GIVEN** the project depends on a `typescript` release whose package exposes no JavaScript compiler API
- **WHEN** the CRAP gate's unit tests run
- **THEN** they load the gate and pass

#### Scenario: Swapping the parser leaves every score unchanged
> **Tests:** none — manual check: `diff` of `pnpm lint:crap --all` output before and after the swap (design D6)
- **GIVEN** the `pnpm lint:crap --all` report produced on the current tree before the parser swap
- **WHEN** the gate runs with `--all` on the same tree after the swap
- **THEN** every function appears with the same name, file, line, complexity, coverage and score

### Requirement: The gate reads TypeScript and TSX source

The gate SHALL parse `.ts` files as TypeScript and `.tsx` files as TypeScript
with JSX. Type-only syntax (annotations, generics, `as`, `satisfies`, non-null
`!`, enums, interfaces and type aliases) SHALL NOT add decision points.
Bodiless signatures (function and method overload signatures, `declare`
functions and abstract methods) SHALL NOT be scored. In a `.ts` file, an
angle-bracket type assertion (`<T>value`) SHALL parse as a type assertion,
not as JSX.

#### Scenario: Type syntax adds no complexity
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — adds no complexity for type annotations, generics, as, satisfies and non-null
- **GIVEN** a function with typed parameters, a generic type parameter, an `as` cast, a `satisfies` check, a non-null `!` and a single `if`
- **WHEN** the gate measures its complexity
- **THEN** its cyclomatic complexity is 2

#### Scenario: Overload signatures are not scored
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — skips overload signatures and declare functions
- **GIVEN** a file declaring two overload signatures for `parse` followed by one implementation, and a `declare function` with no body
- **WHEN** the gate measures the file
- **THEN** it reports exactly one function, the `parse` implementation

#### Scenario: A TSX component is scored
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — scores a TSX component with a JSX conditional
- **GIVEN** a `.tsx` file exporting a component that renders JSX inside a `cond ? <A /> : <B />` expression
- **WHEN** the gate measures the file
- **THEN** it reports the component by name with cyclomatic complexity 2

#### Scenario: An angle-bracket assertion in a .ts file is not JSX
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — parses an angle-bracket assertion in a .ts file
- **GIVEN** a `.ts` file whose function returns `<string>value`
- **WHEN** the gate measures the file
- **THEN** it reports that function with cyclomatic complexity 1

### Requirement: A source file the gate cannot parse fails the run

When a file in scope cannot be parsed, the gate SHALL NOT report any score.
It SHALL print the file's path and the parse error's line and column, and
exit 2.

#### Scenario: A syntax error stops the gate
> **Tests:** [`scripts/lint-crap.test.ts`](/scripts/lint-crap.test.ts) — throws a parse error naming the file, line and column; reports an unparseable file and exits 2
- **GIVEN** a source tree in which `src/lib/broken.ts` contains a syntax error on line 3
- **WHEN** the gate runs
- **THEN** it reports `src/lib/broken.ts` with line 3 as unparseable, lists no scores, and exits 2
