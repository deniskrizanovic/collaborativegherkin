# code-linting Specification

## Purpose

oxlint is the project's only JavaScript and TypeScript linter. This capability
covers its rule set, which matches the former Next.js ESLint preset; the rule
that any warning fails the lint; how rules are suppressed; what the lint skips;
the `no-console` rule for application code; and the gates in pre-commit, CI and
`test:all`.

## Requirements

### Requirement: oxlint is the only linter

The repository SHALL lint JavaScript and TypeScript with oxlint (`oxlint`,
configured by a root `.oxlintrc.json`) and with no other linter. `eslint`,
`eslint-config-next` and any `eslint.config.*` file SHALL NOT be present.
The `pnpm lint` script SHALL run oxlint over the repository. `oxlint` SHALL be
pinned to an exact version in `package.json` (no `^` or `~` range), because a
release can change what an existing rule reports and any diagnostic fails the
lint.

#### Scenario: ESLint is gone
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — no ESLint packages or config remain
- **GIVEN** the repository after this change
- **WHEN** its `package.json` dependencies and root files are listed
- **THEN** neither `eslint` nor `eslint-config-next` is a dependency, no `eslint.config.*` file exists, and the `lint` script runs `oxlint`

#### Scenario: oxlint version is pinned exactly
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — devDependency pinned without a range
- **GIVEN** `package.json` declares `oxlint` as a dev dependency
- **WHEN** the declared version is read
- **THEN** it is an exact version such as `1.93.0`, with no `^` or `~` prefix

### Requirement: Any lint diagnostic fails the lint

The lint SHALL exit non-zero when oxlint reports any error or any warning
(`--max-warnings=0`), wherever it runs. A rule configured as a warning SHALL
therefore block a commit or a CI run in the same way as an error.

#### Scenario: A warning-level finding fails the lint
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — warning-only file exits non-zero
- **GIVEN** a TSX component that renders a plain `<img>` element, which the rule set reports only as a warning
- **WHEN** the lint runs on that file
- **THEN** it names the `no-img-element` rule and exits non-zero

#### Scenario: The current codebase passes
> **Tests:** none
- **GIVEN** the repository at the end of this change, with no source edits beyond suppression-comment renames
- **WHEN** `pnpm lint` runs
- **THEN** it reports no diagnostics and exits zero

### Requirement: The rule set matches the former Next.js ESLint preset

`.oxlintrc.json` SHALL enable the oxlint equivalent of each rule that
`eslint-config-next` (`core-web-vitals` and `typescript` presets) enabled,
with the same severity and options, wherever oxlint has one. It SHALL keep the
project's two local rules: `no-unused-vars` ignores arguments whose name
starts with `_`, and `no-explicit-any` is off in `*.test.*` and `*.spec.*`
TypeScript files.

#### Scenario: setState called directly in an effect is reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — reports set-state-in-effect
- **GIVEN** a React component whose `useEffect` callback calls a state setter synchronously
- **WHEN** the lint runs on that file
- **THEN** it reports the `set-state-in-effect` rule as an error

#### Scenario: Unused variables are reported but underscore arguments are not
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — unused vars honor the underscore pattern
- **GIVEN** a function with an unused argument `_event`, an unused argument `count` and an unused local variable `total`
- **WHEN** the lint runs on that file
- **THEN** it reports `count` and `total` as unused and does not report `_event`

#### Scenario: Explicit any is allowed only in test files
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — no-explicit-any off in test files only
- **GIVEN** two files with the same `any`-typed declaration, one named `widget.ts` and one named `widget.test.ts`
- **WHEN** the lint runs on both files
- **THEN** it reports `no-explicit-any` in `widget.ts` and nothing in `widget.test.ts`

### Requirement: No rule outside the preset reports

oxlint's default rule categories SHALL be off in `.oxlintrc.json`, so only the
rules listed there report. Adding a rule beyond the former preset SHALL be a
deliberate change to that list.

#### Scenario: Rules outside the preset do not report
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — default categories off
- **GIVEN** a TSX component whose plain `<div>` has an `onMouseDown` handler and no `role`, which oxlint's default `correctness` category would report
- **WHEN** the lint runs on that file
- **THEN** it reports no diagnostics

### Requirement: Rules are suppressed with oxlint comments

A deliberate rule exception in project source SHALL be written as an
`oxlint-disable-next-line <rule>` or `oxlint-disable <rule>` /
`oxlint-enable <rule>` comment that names the oxlint rule and says why.
Project source SHALL NOT contain `eslint-disable` comments.

#### Scenario: A named suppression silences only its rule
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — oxlint-disable-next-line suppresses the named rule
- **GIVEN** a TSX component with an `<img>` element preceded by `oxlint-disable-next-line nextjs/no-img-element`, and an unused local variable on a later line
- **WHEN** the lint runs on that file
- **THEN** it reports the unused variable and does not report the `<img>` element

#### Scenario: No ESLint suppression comments remain in project source
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — no eslint disable directives in project source
- **GIVEN** the tracked TypeScript and JavaScript files in the repository
- **WHEN** they are searched for `eslint-disable`
- **THEN** no file contains it

### Requirement: Lint scope excludes tool output

The lint SHALL respect the repository's Git ignore files. It SHALL also
exclude `next-env.d.ts`, even though it is tracked, and the gitignored test and
tool output directories (`test-results/`, `playwright-report/`, `.venv/`,
`robot/results/`).

#### Scenario: Next.js type declarations are not linted
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — ignores next-env.d.ts
- **GIVEN** a directory linted with the project config that contains a `next-env.d.ts` which declares an unused variable and has no suppression header
- **WHEN** the lint runs on the whole directory
- **THEN** it reports no diagnostics for `next-env.d.ts`

### Requirement: The lint gates commits, CI and test:all

The husky pre-commit hook, via `lint-staged`, SHALL run oxlint with
`--max-warnings=0` on staged `*.{ts,tsx}` files after Biome has formatted them.
The CI workflow SHALL run `pnpm run lint` as a step, and `pnpm test:all` SHALL
include `lint`.

#### Scenario: Lint runs at commit, in CI and in test:all
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — lint wired into lint-staged, CI and test:all
- **GIVEN** the `lint-staged` config, the CI workflow and the `test:all` script
- **WHEN** their commands are listed
- **THEN** the `*.{ts,tsx}` lint-staged list runs `oxlint --max-warnings=0` after `biome check --write`, CI has a `pnpm run lint` step, and `test:all` includes `lint`

### Requirement: Application code does not call console

`.oxlintrc.json` SHALL enable `no-console` as an error for files under `src/`,
so application code logs through the Pino logger (`src/lib/logger.ts`). Test
files (`*.test.*`, `*.spec.*`) under `src/` SHALL be exempt. Files outside
`src/`, such as `scripts/` (including the database seed), `server.js` and
`e2e/`, SHALL NOT be checked by this rule.

#### Scenario: A console call in application code is reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — reports a console call in application code
- **GIVEN** a file `src/lib/widget.ts` that calls `console.log`
- **WHEN** the lint runs on that file
- **THEN** it reports `no-console` for that call and exits non-zero

#### Scenario: A console call in a test file is not reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — allows a console call in a src/ test file
- **GIVEN** a file `src/lib/widget.test.ts` that calls `console.log`
- **WHEN** the lint runs on that file
- **THEN** it reports no diagnostics

#### Scenario: A console call outside src/ is not reported
> **Tests:** [`scripts/oxlint-config.test.ts`](../../../scripts/oxlint-config.test.ts) — allows a console call outside src/
- **GIVEN** a file `scripts/tool.mjs` that calls `console.error`
- **WHEN** the lint runs on that file
- **THEN** it reports no diagnostics
