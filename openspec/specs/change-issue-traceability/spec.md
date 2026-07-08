# Spec: Change Issue Traceability

## Purpose

Every active OpenSpec change must be traceable to an open GitHub issue. A
`lint:issue-link` gate enforces this at commit time (both human and Claude
commits) and in the aggregate test suite, ensuring no change drifts without
a linked, open ticket.

---

## Requirements

### Requirement: Active change declares a GitHub issue

Every active OpenSpec change SHALL declare exactly one GitHub issue in its
`proposal.md`. An active change is a directory directly under
`openspec/changes/`, excluding `openspec/changes/archive/**`. The declaration
SHALL be a `## GitHub Issue` section whose body contains the full issue URL of
the form `https://github.com/deniskrizanovic/collaborativegherkin/issues/N`
(where `N` is one or more digits); the gate parses the issue number `N` from that
URL. A change whose `proposal.md` omits the section, leaves it empty, or contains
no recognisable issue URL SHALL fail the `lint:issue-link` gate.

#### Scenario: Change links a valid open issue
> **Tests:** [`scripts/lint-issue-link.test.ts`](../../changes/gate-changes-on-github-issue/specs/change-issue-traceability/spec.md) — accepts a proposal with a `## GitHub Issue` URL for an open issue
- **WHEN** an active change's `proposal.md` has a `## GitHub Issue` section containing an issue URL for issue `N` and issue `N` exists and is open
- **THEN** the gate reports the change as passing and exits zero

#### Scenario: Change is missing the GitHub Issue section
> **Tests:** [`scripts/lint-issue-link.test.ts`](../../changes/gate-changes-on-github-issue/specs/change-issue-traceability/spec.md) — flags a proposal with no `## GitHub Issue` section
- **WHEN** an active change's `proposal.md` has no `## GitHub Issue` section, or the section contains no recognisable issue URL
- **THEN** the gate reports a violation naming the change and exits non-zero

### Requirement: Linked issue must exist and be open

The `lint:issue-link` gate SHALL verify each declared issue against GitHub using
the `gh` CLI pinned to `github.com` (the repository host), and SHALL treat a
reference to a non-existent issue or a `closed` issue as a violation. Verification
SHALL fail closed: if the issue state cannot be determined (for example, `gh` is
unauthenticated or offline), the gate SHALL exit non-zero rather than pass.

#### Scenario: Linked issue is closed
> **Tests:** [`scripts/lint-issue-link.test.ts`](../../changes/gate-changes-on-github-issue/specs/change-issue-traceability/spec.md) — flags a proposal whose issue resolves to state `closed`
- **WHEN** a change links the URL for issue `N` and issue `N` exists but its state is `closed`
- **THEN** the gate reports a violation naming the change and issue and exits non-zero

#### Scenario: Linked issue does not exist
> **Tests:** [`scripts/lint-issue-link.test.ts`](../../changes/gate-changes-on-github-issue/specs/change-issue-traceability/spec.md) — flags a proposal whose issue lookup returns not-found
- **WHEN** a change links the URL for issue `N` and the GitHub lookup for issue `N` returns not-found
- **THEN** the gate reports a violation naming the change and issue and exits non-zero

#### Scenario: Issue state cannot be determined
> **Tests:** [`scripts/lint-issue-link.test.ts`](../../changes/gate-changes-on-github-issue/specs/change-issue-traceability/spec.md) — fails closed when the issue lookup errors
- **WHEN** the gate cannot resolve issue `N`'s state because the `gh` lookup errors (unauthenticated, offline, or API failure)
- **THEN** the gate exits non-zero and does not report the change as passing

### Requirement: Gate blocks commits at both enforcement points

The `lint:issue-link` gate SHALL be invoked from the git `pre-commit` hook and
from the Claude Code `PreToolUse` commit hook in `.claude/settings.json`, so that
a commit which includes an active change lacking a valid open-issue link is
blocked locally regardless of whether the commit is made by a human or by Claude.
The gate SHALL also be part of the `test:all` aggregate script.

#### Scenario: Commit blocked when a change is unlinked
> **Tests:** none
- **WHEN** a commit is attempted while an active change's `proposal.md` lacks a valid, open GitHub issue link
- **THEN** the pre-commit gate exits non-zero and the commit is aborted with an actionable message

#### Scenario: Archived changes are exempt
> **Tests:** [`scripts/lint-issue-link.test.ts`](../../changes/gate-changes-on-github-issue/specs/change-issue-traceability/spec.md) — ignores changes under `archive/`
- **WHEN** the gate scans `openspec/changes/` and encounters a change under `archive/`
- **THEN** that change is not checked for an issue link and does not cause a violation
