## ADDED Requirements

### Requirement: Specs and active changes pass strict OpenSpec validation

Every main spec under `openspec/specs/` and every active change under
`openspec/changes/` (excluding `archive/`) SHALL pass
`openspec validate --all --strict`. In strict mode a warning fails the run as
an error does, so a placeholder Purpose or an over-long requirement blocks the
gate.

#### Scenario: A placeholder Purpose fails the gate
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../../../scripts/openspec-validate-config.test.ts) — fails a spec whose Purpose is the archive placeholder
- **GIVEN** a main spec whose `## Purpose` is still the `TBD - created by archiving change …` placeholder
- **WHEN** the OpenSpec validation gate runs
- **THEN** it names that spec as failing and exits non-zero

#### Scenario: An over-long requirement fails the gate
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../../../scripts/openspec-validate-config.test.ts) — fails a spec with a requirement over 500 characters
- **GIVEN** a main spec with a requirement whose text is longer than 500 characters
- **WHEN** the OpenSpec validation gate runs
- **THEN** it names that spec as failing and exits non-zero

#### Scenario: The current spec tree passes
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../../../scripts/openspec-validate-config.test.ts) — passes the repository's spec tree
- **GIVEN** the repository's main specs and active changes after this change
- **WHEN** the OpenSpec validation gate runs
- **THEN** every item passes and the gate exits 0

### Requirement: The OpenSpec validation gate runs in pre-commit, test:all and CI

The OpenSpec validation gate SHALL run in the husky pre-commit hook, in the
`test:all` script and as a CI step. It SHALL use the `openspec` CLI pinned in
the project's devDependencies, not a global install. It MUST stay offline-safe:
no network access, `gh` authentication or telemetry.

#### Scenario: test:all invokes the OpenSpec validation gate
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../../../scripts/openspec-validate-config.test.ts) — lint:openspec wired into pre-commit, CI and test:all
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `pnpm test:all`
- **THEN** the OpenSpec validation gate executes and its failure fails the overall run

#### Scenario: CI runs the gate with the pinned CLI
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../../../scripts/openspec-validate-config.test.ts) — lint:openspec wired into pre-commit, CI and test:all
- **GIVEN** a CI runner with no globally installed `openspec` CLI
- **WHEN** the CI workflow runs on a push
- **THEN** the OpenSpec validation gate runs with the devDependency's CLI and its failure fails the `ci` job

#### Scenario: Pre-commit hook runs the gate offline
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../../../scripts/openspec-validate-config.test.ts) — lint:openspec wired into pre-commit, CI and test:all
- **GIVEN** the husky pre-commit hook is installed and the developer has no network access
- **WHEN** the developer commits a change
- **THEN** the OpenSpec validation gate runs with telemetry off and completes without network or `gh` auth
