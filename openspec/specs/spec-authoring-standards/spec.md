# spec-authoring-standards Specification

## Purpose

Standards and automated gates that govern how OpenSpec specs in this repository
are authored and validated. They ensure every scenario declares explicit test
traceability (a `> **Tests:**` line) and an explicit GIVEN precondition, wire
both gates into the standard test and pre-commit flows, ensure generated
scenario templates include a GIVEN line, and direct the spec-writing flow to
invoke the `gherkin-authoring` skill. Together these make coverage gaps visible
and prevent scenarios from being silently overlooked or written as bare
event/outcome pairs.

## Requirements

### Requirement: Every scenario declares its test traceability

Every scenario in an OpenSpec spec SHALL be immediately followed by a `> **Tests:**`
line, in both the archived baseline (`openspec/specs/**`) and unarchived change deltas
(`openspec/changes/*/specs/**`). The line MUST cite the e2e or unit spec(s) that exercise
the scenario, or the literal word `none` when no test exists yet. A scenario MUST NOT
omit the line entirely; silence is not permitted, because an absent line is
indistinguishable from an overlooked one.

#### Scenario: Scenario with a linked test passes the gate
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../scripts/lint-spec-traceability.test.ts) — passes when link present
- **GIVEN** a scenario is immediately followed by `> **Tests:** [path](...)`
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate accepts it

#### Scenario: Scenario marked none passes the gate
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../scripts/lint-spec-traceability.test.ts) — passes when marked none
- **GIVEN** a scenario is immediately followed by `> **Tests:** none`
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate accepts it as an explicit, visible coverage gap

#### Scenario: Scenario missing the tests line fails the gate
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../scripts/lint-spec-traceability.test.ts) — fails when line absent
- **GIVEN** a scenario has no `> **Tests:**` line before the next heading or blank-line boundary
- **WHEN** the traceability lint gate runs
- **THEN** the traceability lint gate exits non-zero and names the offending file and scenario

### Requirement: Traceability is enforced at delta-authoring time

The traceability lint gate SHALL scan change delta specs under
`openspec/changes/*/specs/**`, not only the archived baseline, so a missing
`> **Tests:**` line is caught while a change is being proposed rather than after it is
archived.

#### Scenario: Delta spec is scanned before archive
> **Tests:** [`scripts/lint-spec-traceability.test.ts`](../../../scripts/lint-spec-traceability.test.ts) — scans change deltas
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

### Requirement: Every scenario declares an explicit GIVEN precondition

Every scenario in an OpenSpec spec SHALL contain at least one `- **GIVEN**`
clause describing its initial state, in both the archived baseline
(`openspec/specs/**`) and unarchived change deltas
(`openspec/changes/*/specs/**`). The GIVEN clause MUST appear among the
scenario's bullet lines, before the next `#### Scenario:`, `### Requirement:`,
or `## ` boundary. A scenario MUST NOT be a bare WHEN/THEN pair, because a
missing precondition hides the state needed to reproduce it.

#### Scenario: Scenario with a GIVEN clause passes the gate
> **Tests:** [`scripts/lint-spec-given-clause.test.ts`](../../../scripts/lint-spec-given-clause.test.ts) — passes when GIVEN present
- **GIVEN** a scenario contains a `- **GIVEN**` bullet before the next heading boundary
- **WHEN** the GIVEN-clause lint gate runs
- **THEN** the GIVEN-clause lint gate accepts it

#### Scenario: Scenario missing the GIVEN clause fails the gate
> **Tests:** [`scripts/lint-spec-given-clause.test.ts`](../../../scripts/lint-spec-given-clause.test.ts) — fails when GIVEN absent
- **GIVEN** a scenario has only `- **WHEN**` and `- **THEN**` bullets before the next heading boundary
- **WHEN** the GIVEN-clause lint gate runs
- **THEN** the GIVEN-clause lint gate exits non-zero and names the offending file and scenario

#### Scenario: Delta spec is scanned before archive
> **Tests:** [`scripts/lint-spec-given-clause.test.ts`](../../../scripts/lint-spec-given-clause.test.ts) — scans change deltas
- **GIVEN** an unarchived change under `openspec/changes/` contains a scenario without a `- **GIVEN**` clause
- **WHEN** the GIVEN-clause lint gate runs
- **THEN** the GIVEN-clause lint gate fails, before the change is archived

### Requirement: The GIVEN-clause gate runs in the standard test suite and pre-commit

The GIVEN-clause lint gate SHALL be wired into the project's `test:all` script,
the husky pre-commit hook, and the CI workflow, so it runs alongside the
existing `lint:specs` traceability gate and blocks a green suite when violated.
Because it is a pure filesystem check, it MUST remain offline-safe and MUST NOT
require network access or `gh` authentication.

#### Scenario: test:all invokes the GIVEN-clause gate
> **Tests:** none
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `npm run test:all`
- **THEN** the GIVEN-clause lint gate executes and its failure fails the overall run

#### Scenario: Pre-commit hook runs the GIVEN-clause gate offline
> **Tests:** none
- **GIVEN** the husky pre-commit hook is installed and the developer has no network access
- **WHEN** the developer commits a change touching spec files
- **THEN** the GIVEN-clause lint gate runs and completes without requiring network or `gh` auth

### Requirement: Generated scenario templates include a GIVEN line by default

The project-local `spec-driven` schema SHALL author scenarios with a
`- **GIVEN**` line by default, so specs generated by the OpenSpec workflow
satisfy the GIVEN-clause gate without hand-editing. The scenario template in
`openspec/schemas/spec-driven/templates/spec.md`, the `specs` artifact
instruction in `openspec/schemas/spec-driven/schema.yaml`, and the `specs`
rule in `openspec/config.yaml` MUST all require the GIVEN line.

#### Scenario: Generated scenario includes GIVEN/WHEN/THEN
> **Tests:** none
- **GIVEN** an author generates a spec via the `spec-driven` schema template
- **WHEN** the scenario stub is produced
- **THEN** it contains a `- **GIVEN**` line in addition to the `- **WHEN**` and `- **THEN**` lines
- **AND** the generated scenario passes the GIVEN-clause lint gate without hand-editing

### Requirement: The spec-writing flow invokes the gherkin-authoring skill

The project-local `spec-driven` schema SHALL direct the spec-writing flow to
invoke the `gherkin-authoring` skill and apply its GIVEN/WHEN/THEN authoring
guidance before authoring scenarios. The `specs` artifact instruction in
`openspec/schemas/spec-driven/schema.yaml` MUST reference the skill by name, and
the `specs` rule in `openspec/config.yaml` MUST reinforce it, so the trigger is
deterministic within the flow rather than relying on the skill's `description`
alone.

#### Scenario: Schema instruction names the gherkin-authoring skill
> **Tests:** none
- **GIVEN** the `specs` artifact instruction in `openspec/schemas/spec-driven/schema.yaml`
- **WHEN** the spec-writing flow reads the instruction before authoring scenarios
- **THEN** the instruction directs the author to invoke the `gherkin-authoring` skill and apply its GIVEN/WHEN/THEN guidance
- **AND** the `specs` rule in `openspec/config.yaml` reinforces the same directive

### Requirement: The ported gherkin-authoring skill notes the OpenSpec dialect

The ported `gherkin-authoring` skill MUST carry a note that OpenSpec specs use the markdown
`#### Scenario:` + `- **GIVEN**` bullet dialect, not real `.feature` syntax, so
its syntax reference is not applied literally.

#### Scenario: Ported skill notes the OpenSpec markdown dialect
> **Tests:** none
- **GIVEN** the ported `.claude/skills/gherkin-authoring/SKILL.md`
- **WHEN** an author consults it while writing an OpenSpec scenario
- **THEN** the skill notes that this repo uses the `#### Scenario:` + `- **GIVEN**` markdown bullet dialect rather than real `.feature` syntax
- **AND** it makes clear the skill is used for its authoring principles, not its literal syntax reference

### Requirement: Specs and active changes pass strict OpenSpec validation

Every main spec under `openspec/specs/` and every active change under
`openspec/changes/` (excluding `archive/`) SHALL pass
`openspec validate --all --strict`. In strict mode a warning fails the run as
an error does, so a placeholder Purpose or an over-long requirement blocks the
gate.

#### Scenario: A placeholder Purpose fails the gate
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../scripts/openspec-validate-config.test.ts) — fails a spec whose Purpose is the archive placeholder
- **GIVEN** a main spec whose `## Purpose` is still the `TBD - created by archiving change …` placeholder
- **WHEN** the OpenSpec validation gate runs
- **THEN** it names that spec as failing and exits non-zero

#### Scenario: An over-long requirement fails the gate
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../scripts/openspec-validate-config.test.ts) — fails a spec with a requirement over 500 characters
- **GIVEN** a main spec with a requirement whose text is longer than 500 characters
- **WHEN** the OpenSpec validation gate runs
- **THEN** it names that spec as failing and exits non-zero

#### Scenario: The current spec tree passes
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../scripts/openspec-validate-config.test.ts) — passes the repository's spec tree
- **GIVEN** the repository's main specs and active changes after this change
- **WHEN** the OpenSpec validation gate runs
- **THEN** every item passes and the gate exits 0

### Requirement: The OpenSpec validation gate runs in pre-commit, test:all and CI

The OpenSpec validation gate SHALL run in the husky pre-commit hook, in the
`test:all` script and as a CI step. It SHALL use the `openspec` CLI pinned in
the project's devDependencies, not a global install. It MUST stay offline-safe:
no network access, `gh` authentication or telemetry.

#### Scenario: test:all invokes the OpenSpec validation gate
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../scripts/openspec-validate-config.test.ts) — lint:openspec wired into pre-commit, CI and test:all
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `pnpm test:all`
- **THEN** the OpenSpec validation gate executes and its failure fails the overall run

#### Scenario: CI runs the gate with the pinned CLI
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../scripts/openspec-validate-config.test.ts) — lint:openspec wired into pre-commit, CI and test:all
- **GIVEN** a CI runner with no globally installed `openspec` CLI
- **WHEN** the CI workflow runs on a push
- **THEN** the OpenSpec validation gate runs with the devDependency's CLI and its failure fails the `ci` job

#### Scenario: Pre-commit hook runs the gate offline
> **Tests:** [`scripts/openspec-validate-config.test.ts`](../../../scripts/openspec-validate-config.test.ts) — lint:openspec wired into pre-commit, CI and test:all
- **GIVEN** the husky pre-commit hook is installed and the developer has no network access
- **WHEN** the developer commits a change
- **THEN** the OpenSpec validation gate runs with telemetry off and completes without network or `gh` auth
