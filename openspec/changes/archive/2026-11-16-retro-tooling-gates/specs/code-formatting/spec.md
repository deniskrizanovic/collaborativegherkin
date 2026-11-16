## MODIFIED Requirements

### Requirement: Only files being committed are formatted

The husky pre-commit hook, via `lint-staged`, SHALL run Biome with write mode
on staged in-scope files, re-stage the result, and run Biome before oxlint for
`*.{ts,tsx}` files. Files that are not staged SHALL NOT be modified by the
hook.

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

### Requirement: The format check gates CI and test:all

The `lint:format` check SHALL run in `pnpm test:all` and as a CI step. The CI
step SHALL run it with no comparison base.

#### Scenario: Check runs in CI and test:all
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — lint:format wired into CI and test:all
- **GIVEN** the CI workflow and the `test:all` script
- **WHEN** their steps are listed
- **THEN** both include the `lint:format` check, and the CI step passes it no `--since` base

## REMOVED Requirements

### Requirement: Changed files are checked for formatting
**Reason**: Checking only changed files left off-style files in the tree until someone edited them, and that edit then carried a whole-file reformat. Replaced by "Every in-scope file is checked for formatting".
**Migration**: Run `pnpm format` once to bring the tree into house style. `pnpm lint:format` takes no `--since` base any more.

## ADDED Requirements

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
> **Tests:** [`scripts/biome-config.test.ts`](../../../../../scripts/biome-config.test.ts) — ignores Markdown and YAML; ignores generated client
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
