## MODIFIED Requirements

### Requirement: Biome is the formatter and never lints

The repository SHALL use Biome (`@biomejs/biome`, configured by a root
`biome.json`) as its only source-code formatter. Biome's linter SHALL be
disabled, so lint diagnostics come only from the project's linter (oxlint).
The Biome `organizeImports` assist action SHALL be enabled, so import
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

### Requirement: Only files being committed are formatted

The repository SHALL NOT be reformatted wholesale. The husky pre-commit hook,
via `lint-staged`, SHALL run Biome with write mode on staged in-scope files,
re-stage the result, and run Biome before oxlint for `*.{ts,tsx}` files. Files
that are not staged SHALL NOT be modified by the hook. The repository SHALL NOT
provide a script that formats the whole tree.

#### Scenario: Staged off-style file is formatted on commit
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — lint-staged runs Biome write before oxlint
- **GIVEN** a staged TypeScript file that uses single quotes
- **WHEN** the developer commits
- **THEN** the committed file uses double quotes

#### Scenario: Untouched off-style file is not modified
> **Tests:** none
- **GIVEN** an off-style TypeScript file that is not staged, and another staged file
- **WHEN** the developer commits
- **THEN** the unstaged file's content is unchanged
