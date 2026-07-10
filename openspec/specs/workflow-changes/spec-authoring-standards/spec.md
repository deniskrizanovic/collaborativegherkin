# Spec-Authoring Standards

## Purpose

This capability defines standards and automated gates for writing OpenSpec specifications. It ensures that every scenario has explicit test traceability, making coverage gaps visible and preventing scenarios from being silently overlooked.

## Requirements

### Requirement: Every scenario declares its test traceability

Every scenario in an OpenSpec spec SHALL be immediately followed by a `> **Tests:**`
line, in both the archived baseline (`openspec/specs/**`) and unarchived change deltas
(`openspec/changes/*/specs/**`). The line MUST cite the e2e or unit spec(s) that exercise
the scenario, or the literal word `none` when no test exists yet. A scenario MUST NOT
omit the line entirely; silence is not permitted, because an absent line is
indistinguishable from an overlooked one.

#### Scenario: Scenario with a linked test passes the gate
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../../scripts/lint-spec-traceability.test.ts) — passes when link present
- **GIVEN** a scenario is immediately followed by `> **Tests:** [path](...)`
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate accepts it

#### Scenario: Scenario marked none passes the gate
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../../scripts/lint-spec-traceability.test.ts) — passes when marked none
- **GIVEN** a scenario is immediately followed by `> **Tests:** none`
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate accepts it as an explicit, visible coverage gap

#### Scenario: Scenario missing the tests line fails the gate
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../../scripts/lint-spec-traceability.test.ts) — fails when line absent
- **GIVEN** a scenario has no `> **Tests:**` line before the next heading or blank-line boundary
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate exits non-zero and names the offending file and scenario

### Requirement: Traceability is enforced at delta-authoring time

The traceability lint gate SHALL scan change delta specs under
`openspec/changes/*/specs/**`, not only the archived baseline, so a missing
`> **Tests:**` line is caught while a change is being proposed rather than after it is
archived.

#### Scenario: Delta spec is scanned before archive
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../../scripts/lint-spec-traceability.test.ts) — scans change deltas
- **GIVEN** an unarchived change under `openspec/changes/` contains a scenario without a `> **Tests:**` line
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate fails, before the change is archived

### Requirement: The traceability gate runs in the standard test suite

The traceability lint gate SHALL be wired into the project's `test:all` script so it runs
alongside the existing lint and typecheck steps and blocks a green suite when violated.

#### Scenario: test:all invokes the traceability gate
> **Tests:** none
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `npm run test:all`
- **THEN** the traceability lint gate executes and its failure fails the overall run
