## MODIFIED Requirements

### Requirement: Every Dependabot ignore rule is a documented exception

The project targets the latest stable version of every dependency (ADR 0004).
Each `ignore` entry in `.github/dependabot.yml` SHALL therefore name a
dependency that ADR 0004 (`docs/adr/0004-latest-stable-dependency-principle.md`)
documents as an exception. The `lint:dependabot` gate SHALL fail when an
`ignore` entry's `dependency-name` does not appear in ADR 0004, naming the
undocumented dependency.

#### Scenario: Ignore rule backed by an ADR exception passes
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../../../scripts/lint-dependabot.test.ts) — accepts ignore entries cited in the ADR
- **GIVEN** `.github/dependabot.yml` ignores semver-major updates to `next-auth`, and ADR 0004 has a `next-auth` exception section
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports no violation for the `next-auth` ignore rule

#### Scenario: Undocumented ignore rule is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../../../scripts/lint-dependabot.test.ts) — flags an ignore entry not cited in the ADR
- **GIVEN** `.github/dependabot.yml` ignores updates to `left-pad`, and ADR 0004 never mentions `left-pad`
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports `left-pad` as an undocumented ignore rule and exits non-zero

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
- **GIVEN** a pull request against `main` that changes only `.oxlintrc.json`
- **WHEN** the pull request is opened or updated
- **THEN** the `ci` check runs and reports its result on the pull request
