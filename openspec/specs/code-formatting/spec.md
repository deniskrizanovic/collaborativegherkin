# code-formatting Specification

## Purpose

TBD - created by archiving change introduce-biome-formatter. Update Purpose after archive.

## Requirements

### Requirement: Biome is the formatter and never lints

The repository SHALL use Biome (`@biomejs/biome`, configured by a root
`biome.json`) as its only source-code formatter. Biome's linter SHALL be
disabled, so lint diagnostics come only from the project's linter (oxlint).
The Biome `organizeImports` assist action SHALL be enabled, so import
order is part of formatting. `@biomejs/biome` SHALL be pinned to an exact
version in `package.json` (no `^` or `~` range), because formatter output can
change between releases.

#### Scenario: Lint-style problems are left to the linter
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — Biome reports no lint diagnostics
- **GIVEN** a TypeScript file that is correctly formatted but declares an unused variable
- **WHEN** Biome checks the file
- **THEN** Biome reports no problems for it

#### Scenario: Biome version is pinned exactly
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — devDependency pinned without a range
- **GIVEN** `package.json` declares `@biomejs/biome` as a dev dependency
- **WHEN** the declared version is read
- **THEN** it is an exact version such as `2.6.7`, with no `^` or `~` prefix

### Requirement: Formatting follows the existing house style

Biome SHALL format in the style the codebase already uses: 2-space
indentation, double quotes, semicolons, and a line width of 100. Imports SHALL
be sorted by the `organizeImports` action.

#### Scenario: Off-style file is rewritten to house style
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — formats to house style
- **GIVEN** a TypeScript file that uses single quotes, tab indentation and no semicolons
- **WHEN** Biome formats the file
- **THEN** the file uses double quotes, 2-space indentation and semicolons

#### Scenario: Unsorted imports are reordered
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — sorts imports
- **GIVEN** a TypeScript file whose imports are not in sorted order
- **WHEN** Biome checks and fixes the file
- **THEN** the imports are in sorted order and the rest of the file is unchanged

#### Scenario: House-style file is left unchanged
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — leaves house-style source unchanged
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
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — ignores Markdown and YAML
- **GIVEN** an OpenSpec `spec.md` file and `.github/dependabot.yml`
- **WHEN** Biome is asked to check both files
- **THEN** Biome processes neither file and reports no problems

#### Scenario: Generated Prisma client is out of scope
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — ignores generated client
- **GIVEN** a file under `src/generated/prisma/` that is not in house style
- **WHEN** Biome is asked to check that file
- **THEN** Biome processes no file and reports no problems

### Requirement: The pre-commit hook formats only staged files

The husky pre-commit hook, via `lint-staged`, SHALL run Biome with write mode
on staged in-scope files, re-stage the result, and run Biome before oxlint for
`*.{ts,tsx}` files. Files that are not staged SHALL NOT be modified by the
hook.

#### Scenario: Staged off-style file is formatted on commit
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — lint-staged runs Biome write before oxlint
- **GIVEN** a staged TypeScript file that uses single quotes
- **WHEN** the developer commits
- **THEN** the committed file uses double quotes

#### Scenario: Untouched off-style file is not modified
> **Tests:** none
- **GIVEN** an off-style TypeScript file that is not staged, and another staged file
- **WHEN** the developer commits
- **THEN** the unstaged file's content is unchanged

### Requirement: The format check gates CI and test:all

The `lint:format` check SHALL run in `pnpm test:all` and as a CI step. The CI
step SHALL run it with no comparison base.

#### Scenario: Check runs in CI and test:all
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — lint:format wired into CI and test:all
- **GIVEN** the CI workflow and the `test:all` script
- **WHEN** their steps are listed
- **THEN** both include the `lint:format` check, and the CI step passes it no `--since` base

### Requirement: The whole tree is formatted with one command

A `format` script SHALL format and sort imports, with write mode, in every
in-scope file in the repository. It SHALL leave out-of-scope files (Markdown,
YAML, the generated Prisma client, `next-env.d.ts` and Git-ignored files)
unchanged.

#### Scenario: Off-style files anywhere in the tree are rewritten
> **Tests:** none
- **GIVEN** two off-style TypeScript files in different directories, neither of them staged or changed since `main`
- **WHEN** the developer runs `pnpm format`
- **THEN** both files are in house style

#### Scenario: Out-of-scope files are untouched by the format script
> **Tests:** [`scripts/biome-config.test.ts`](../../../scripts/biome-config.test.ts) — ignores Markdown and YAML; ignores generated client
- **GIVEN** an OpenSpec `spec.md` file and a file under `src/generated/prisma/`
- **WHEN** the developer runs `pnpm format`
- **THEN** neither file's content changes

### Requirement: Every in-scope file is checked for formatting

A `lint:format` script SHALL check formatting and import order, without
writing, in every in-scope file in the repository, whether or not the file
changed. It SHALL exit non-zero and name the file when any in-scope file is not
in house style.

#### Scenario: Off-style untouched file fails the check
> **Tests:** none
- **GIVEN** a branch whose only change is a formatted file, while an off-style TypeScript file elsewhere is unchanged since `main`
- **WHEN** the `lint:format` check runs
- **THEN** the check names the off-style file and exits non-zero

#### Scenario: The current tree passes the check
> **Tests:** none
- **GIVEN** the repository at the end of this change
- **WHEN** `pnpm lint:format` runs
- **THEN** it exits zero
