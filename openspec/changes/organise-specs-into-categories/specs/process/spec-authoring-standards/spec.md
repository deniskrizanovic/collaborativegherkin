## ADDED Requirements

### Requirement: Every spec lives under a category folder

Every `spec.md` under `openspec/specs/` and under an unarchived change's
`specs/` directory SHALL sit inside one of the category folders `product/`,
`quality/` or `process/`, at any depth below it. A spec placed directly under
`specs/` MUST fail the `lint:spec-layout` gate. Otherwise archiving its change
would create a new uncategorised capability.

#### Scenario: Categorised main spec passes the gate
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — accepts specs under each category
- **GIVEN** the main spec tree holds `product/gherkin/gherkin-editor/spec.md` and `quality/code-linting/spec.md`
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate reports no layout violation

#### Scenario: Uncategorised main spec fails the gate
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — rejects a spec outside the categories
- **GIVEN** the main spec tree holds `gherkin-editor/spec.md` directly under `openspec/specs/`
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate exits non-zero and names `gherkin-editor/spec.md` with the allowed categories

#### Scenario: Uncategorised delta fails before archive
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — scans change deltas
- **GIVEN** an unarchived change holds a delta at `specs/gherkin-editor/spec.md`
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate exits non-zero and names the change's delta file, before the change is archived

#### Scenario: Archived changes are not scanned
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — ignores the archive
- **GIVEN** a change under `openspec/changes/archive/` holds a delta at `specs/gherkin-editor/spec.md`
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate reports no violation for the archived delta

### Requirement: Spec links use repo-root paths that resolve

Every local Markdown link in a main spec or an unarchived change delta SHALL
use a repo-root target such as `/scripts/x.test.ts`, and that target MUST
exist in the repository. A relative target such as `../x` MUST fail the gate.
It points somewhere different after a spec moves or its delta is archived.
External links (`http:`, `https:`, `mailto:`) and in-page anchors (`#x`) are
not checked.

#### Scenario: Repo-root link to an existing file passes
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — accepts a resolving repo-root link
- **GIVEN** a scenario's Tests line links to `/scripts/lint-spec-layout.test.ts` and that file exists
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate reports no link violation

#### Scenario: Relative link fails the gate
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — rejects a relative link
- **GIVEN** a spec contains a link to `../../../scripts/lint-crap.test.ts`
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate exits non-zero, names the file and line, and asks for the repo-root form

#### Scenario: Repo-root link to a missing file fails the gate
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — rejects a dangling repo-root link
- **GIVEN** a spec links to `/scripts/does-not-exist.test.ts` and no such file exists
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate exits non-zero and names the file, line and missing target

#### Scenario: External links and anchors are ignored
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — ignores external links and anchors
- **GIVEN** a spec links to `https://github.com/deniskrizanovic/collaborativegherkin/issues/74` and to `#purpose`
- **WHEN** the spec-layout gate runs
- **THEN** the spec-layout gate reports no link violation for either link

### Requirement: The spec-layout gate runs in pre-commit, test:all and CI

The `lint:spec-layout` gate SHALL be wired into the husky pre-commit hook, the
`test:all` script and the CI workflow, alongside `lint:specs`. It is a pure
filesystem check, so it MUST stay offline-safe: it reads no network, git state
or GitHub API.

#### Scenario: test:all invokes the spec-layout gate
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — lint:spec-layout wired into pre-commit, CI and test:all
- **GIVEN** the project's `test:all` script is configured
- **WHEN** a developer runs `pnpm test:all` with a layout violation in the spec tree
- **THEN** the spec-layout gate fails and the overall run fails

#### Scenario: Pre-commit hook runs the spec-layout gate offline
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — lint:spec-layout wired into pre-commit, CI and test:all
- **GIVEN** a developer has no network connection
- **WHEN** the developer commits with an uncategorised spec in the tree
- **THEN** the pre-commit hook runs the spec-layout gate and blocks the commit

#### Scenario: CI runs the spec-layout gate
> **Tests:** [`scripts/lint-spec-layout.test.ts`](/scripts/lint-spec-layout.test.ts) — lint:spec-layout wired into pre-commit, CI and test:all
- **GIVEN** a commit reaches CI with an uncategorised spec, made outside the hook
- **WHEN** the CI workflow runs
- **THEN** the spec-layout step fails the build
