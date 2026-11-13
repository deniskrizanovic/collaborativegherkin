## ADDED Requirements

### Requirement: Biome is the formatter and never lints

The repository SHALL use Biome (`@biomejs/biome`, configured by a root
`biome.json`) as its only source-code formatter. Biome's linter SHALL be
disabled, so lint diagnostics come only from the project's linter (ESLint
today). The Biome `organizeImports` assist action SHALL be enabled, so import
order is part of formatting. `@biomejs/biome` SHALL be pinned to an exact
version in `package.json` (no `^` or `~` range), because formatter output can
change between releases.

#### Scenario: Lint-style problems are left to the linter
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — Biome reports no lint diagnostics
- **GIVEN** a TypeScript file that is correctly formatted but declares an unused variable
- **WHEN** Biome checks the file
- **THEN** Biome reports no problems for it

#### Scenario: Biome version is pinned exactly
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — devDependency pinned without a range
- **GIVEN** `package.json` declares `@biomejs/biome` as a dev dependency
- **WHEN** the declared version is read
- **THEN** it is an exact version such as `2.6.7`, with no `^` or `~` prefix

### Requirement: Formatting follows the existing house style

Biome SHALL format in the style the codebase already uses: 2-space
indentation, double quotes, semicolons, and a line width of 100. Imports SHALL
be sorted by the `organizeImports` action.

#### Scenario: Off-style file is rewritten to house style
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — formats to house style
- **GIVEN** a TypeScript file that uses single quotes, tab indentation and no semicolons
- **WHEN** Biome formats the file
- **THEN** the file uses double quotes, 2-space indentation and semicolons

#### Scenario: Unsorted imports are reordered
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — sorts imports
- **GIVEN** a TypeScript file whose imports are not in sorted order
- **WHEN** Biome checks and fixes the file
- **THEN** the imports are in sorted order and the rest of the file is unchanged

#### Scenario: House-style file is left unchanged
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — leaves house-style source unchanged
- **GIVEN** a TypeScript file already written in house style with sorted imports and no line over 100 characters
- **WHEN** Biome formats the file
- **THEN** the file content is identical to before

### Requirement: Formatting scope is limited to source and config code

Biome SHALL process only TypeScript, TSX, JavaScript (`.js`, `.mjs`, `.cjs`),
JSON/JSONC and CSS files. It SHALL NOT format Markdown or YAML, because the
spec gates (`lint:specs`, `lint:given`, `lint:robot-steps`) parse OpenSpec
Markdown and `lint:dependabot` parses `.github/dependabot.yml`. It SHALL
respect the repository's Git ignore files and SHALL exclude the generated
Prisma client (`src/generated/**`) and `next-env.d.ts`.

#### Scenario: Spec Markdown is out of scope
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — ignores Markdown and YAML
- **GIVEN** an OpenSpec `spec.md` file and `.github/dependabot.yml`
- **WHEN** Biome is asked to check both files
- **THEN** Biome processes neither file and reports no problems

#### Scenario: Generated Prisma client is out of scope
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — ignores generated client
- **GIVEN** a file under `src/generated/prisma/` that is not in house style
- **WHEN** Biome is asked to check that file
- **THEN** Biome processes no file and reports no problems

### Requirement: Only files being committed are formatted

The repository SHALL NOT be reformatted wholesale. The husky pre-commit hook,
via `lint-staged`, SHALL run Biome with write mode on staged in-scope files,
re-stage the result, and run Biome before ESLint for `*.{ts,tsx}` files. Files
that are not staged SHALL NOT be modified by the hook. The repository SHALL NOT
provide a script that formats the whole tree.

#### Scenario: Staged off-style file is formatted on commit
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — lint-staged runs Biome write before ESLint
- **GIVEN** a staged TypeScript file that uses single quotes
- **WHEN** the developer commits
- **THEN** the committed file uses double quotes

#### Scenario: Untouched off-style file is not modified
> **Tests:** none
- **GIVEN** an off-style TypeScript file that is not staged, and another staged file
- **WHEN** the developer commits
- **THEN** the unstaged file's content is unchanged

### Requirement: Changed files are checked for formatting

A `lint:format` script SHALL check formatting and import order, without
writing, for files changed relative to a comparison base (`main` by default).
It SHALL exit non-zero when any of those files is not formatted. Files not
changed relative to that base SHALL NOT be flagged. When there are no changed
in-scope files, the check SHALL pass.

#### Scenario: Unformatted changed file fails the check
> **Tests:** none
- **GIVEN** a branch that commits a change to a TypeScript file leaving it with single quotes
- **WHEN** the `lint:format` check runs
- **THEN** the check names that file and exits non-zero

#### Scenario: Unformatted untouched file does not fail the check
> **Tests:** none
- **GIVEN** a branch whose only change is a formatted file, while an off-style file elsewhere is unchanged since `main`
- **WHEN** the `lint:format` check runs
- **THEN** the check exits zero

### Requirement: The format check gates CI and test:all

The `lint:format` check SHALL run in `pnpm test:all` and as a CI step. In CI,
the comparison base SHALL be the pull request's base commit for
`pull_request` events and the commit before the push for `push` events. The
checkout SHALL fetch enough history for that base to be available.

#### Scenario: Check runs in CI and test:all
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — lint:format wired into CI and test:all
- **GIVEN** the CI workflow and the `test:all` script
- **WHEN** their steps are listed
- **THEN** both include the `lint:format` check
