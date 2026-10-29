# dependency-maintenance Specification

## Purpose

TBD - created by archiving change address-dependabot-upgrades-2026-10. Update Purpose after archive.

## Requirements

### Requirement: Dependabot configuration is valid YAML

The repository's `.github/dependabot.yml` SHALL parse as valid YAML. Dependabot
cannot apply a file that does not parse, so scheduled version updates, and the
notifications they produce, depend on it being valid. A `lint:dependabot` gate SHALL parse the file and exit non-zero, naming the file
and the parser's line/column, when parsing fails. The gate SHALL be pure
filesystem (no network) and SHALL run in the husky pre-commit hook, in CI, and
in `test:all`, alongside `lint:specs`.

#### Scenario: Valid Dependabot configuration passes
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — accepts a well-formed config
- **GIVEN** `.github/dependabot.yml` is well-formed YAML and every `ignore` entry is cited in ADR 0004
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports no violations and exits zero

#### Scenario: Malformed Dependabot configuration is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — flags a YAML syntax error with its line
- **GIVEN** `.github/dependabot.yml` contains a syntax error, such as a stray character after a quoted list item (`- "minor"W`)
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports a parse violation naming the file and the offending line, and exits non-zero

#### Scenario: Missing Dependabot configuration is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — flags an absent config file
- **GIVEN** the repository has no `.github/dependabot.yml`
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports that the configuration file is missing and exits non-zero

### Requirement: Every Dependabot ignore rule is a documented exception

The project targets the latest stable version of every dependency (ADR 0004).
Each `ignore` entry in `.github/dependabot.yml` SHALL therefore name a
dependency that ADR 0004 (`docs/adr/0004-latest-stable-dependency-principle.md`)
documents as an exception. The `lint:dependabot` gate SHALL fail when an
`ignore` entry's `dependency-name` does not appear in ADR 0004, naming the
undocumented dependency.

#### Scenario: Ignore rule backed by an ADR exception passes
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — accepts ignore entries cited in the ADR
- **GIVEN** `.github/dependabot.yml` ignores semver-major updates to `eslint`, and ADR 0004 has an `eslint` exception section
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports no violation for the `eslint` ignore rule

#### Scenario: Undocumented ignore rule is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — flags an ignore entry not cited in the ADR
- **GIVEN** `.github/dependabot.yml` ignores updates to `left-pad`, and ADR 0004 never mentions `left-pad`
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports `left-pad` as an undocumented ignore rule and exits non-zero

### Requirement: Dependabot pull requests are assigned to the repository owner

Every `updates[*]` entry in `.github/dependabot.yml` SHALL set a non-empty
`assignees` list that includes `deniskrizanovic`. Every Dependabot pull request
is then assigned to the owner, and GitHub delivers it as a participating
notification. Entries SHALL NOT use the `reviewers` key, which is no longer a
documented Dependabot option. The `lint:dependabot` gate SHALL enforce both
rules.

#### Scenario: Update entry with the owner as assignee passes
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — accepts an update entry assigned to the owner
- **GIVEN** the `npm` update entry in `.github/dependabot.yml` sets `assignees: ["deniskrizanovic"]` and has no `reviewers` key
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports no assignee violation for that entry

#### Scenario: Update entry without assignees is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — flags an update entry with no assignees
- **GIVEN** the `npm` update entry in `.github/dependabot.yml` has no `assignees` list
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports a missing-assignee violation naming the `npm` ecosystem and exits non-zero

#### Scenario: Retired reviewers key is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../scripts/lint-dependabot.test.ts) — flags the retired `reviewers` key
- **GIVEN** the `npm` update entry in `.github/dependabot.yml` sets `reviewers: ["deniskrizanovic"]`
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports `reviewers` as a retired option and exits non-zero

#### Scenario: Dependabot pull request shows the owner as assignee
> **Tests:** none
- **GIVEN** a valid `.github/dependabot.yml` on `main` whose `npm` entry assigns `deniskrizanovic`
- **WHEN** Dependabot opens a version-update pull request
- **THEN** the pull request lists `deniskrizanovic` as its assignee

### Requirement: Held auth packages move in lockstep

`next-auth` pins an exact `@auth/core` version, and `@auth/prisma-adapter` pins
one too. `next-auth`, `@auth/core` and `@auth/prisma-adapter` SHALL therefore be
declared at exact versions in `package.json` (no `^` or `~` range), and the
resolved dependency tree SHALL contain exactly one version of `@auth/core`.
Dependabot SHALL NOT raise standalone updates for `@auth/core` or
`@auth/prisma-adapter`. Those two move only when `next-auth` itself is upgraded.

#### Scenario: Auth packages resolve to a single core version
> **Tests:** none
- **GIVEN** `package.json` declares `next-auth`, `@auth/core` and `@auth/prisma-adapter` at exact versions whose `@auth/core` requirements agree
- **WHEN** dependencies are installed with `pnpm install --frozen-lockfile`
- **THEN** `pnpm why @auth/core` reports exactly one resolved `@auth/core` version

#### Scenario: Standalone auth-core bumps are not proposed
> **Tests:** none
- **GIVEN** a new patch release of `@auth/core` is published while `next-auth` is unchanged
- **WHEN** Dependabot runs its weekly npm update
- **THEN** Dependabot opens no pull request that bumps `@auth/core` or `@auth/prisma-adapter`

### Requirement: CI runs on dependency and build-configuration changes

The CI workflow SHALL run on any push to `main`, and on any pull request
targeting `main`, that changes a dependency manifest (`package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`), anything under `.github/`, or a
build/lint/test configuration file, in addition to the existing source, spec,
schema, script and test paths.

#### Scenario: Dependency-only pull request runs CI
> **Tests:** none
- **GIVEN** a Dependabot pull request against `main` that changes only `package.json` and `pnpm-lock.yaml`
- **WHEN** the pull request is opened or updated
- **THEN** the `ci` check runs and reports its result on the pull request

#### Scenario: Lint configuration change runs CI
> **Tests:** none
- **GIVEN** a pull request against `main` that changes only `eslint.config.mjs`
- **WHEN** the pull request is opened or updated
- **THEN** the `ci` check runs and reports its result on the pull request
