# Spec: Change Archive Gate

## Purpose

A finished OpenSpec change (every task checked) must be archived on its feature
branch before it is merged. A `lint:unarchived` gate detects finished but
unarchived changes and blocks the merge commit and Claude branch deletion; the
Git Workflow orders archive before commit.

---

## Requirements

### Requirement: Finished active change is detected

The `lint:unarchived` gate SHALL treat an active OpenSpec change (a directory directly under `openspec/changes/`, excluding `archive/**`) as finished-but-unarchived when its `tasks.md` contains at least one checkbox item and no unchecked `- [ ]` item. A change with no `tasks.md`, no checkbox items, or at least one unchecked item SHALL NOT be reported. The gate SHALL exit non-zero and name every finished-but-unarchived change it finds; otherwise it SHALL exit zero.

#### Scenario: Fully checked change is reported
> **Tests:** [`scripts/lint-unarchived.test.ts`](/scripts/lint-unarchived.test.ts) — reports a fully checked active change
- **GIVEN** an active change whose `tasks.md` has three `- [x]` items and no `- [ ]` item
- **WHEN** the `lint:unarchived` gate runs
- **THEN** the gate names that change as finished but not archived and exits non-zero

#### Scenario: Change with an open task is not reported
> **Tests:** [`scripts/lint-unarchived.test.ts`](/scripts/lint-unarchived.test.ts) — does not report a change with an open task
- **GIVEN** an active change whose `tasks.md` has two `- [x]` items and one `- [ ]` item
- **WHEN** the `lint:unarchived` gate runs
- **THEN** the gate reports no violation for that change and exits zero

#### Scenario: Change without checkbox tasks is not reported
> **Tests:** [`scripts/lint-unarchived.test.ts`](/scripts/lint-unarchived.test.ts) — does not report a change with no checkbox items or no tasks.md
- **GIVEN** an active change that has no `tasks.md`, or a `tasks.md` with no checkbox items
- **WHEN** the `lint:unarchived` gate runs
- **THEN** the gate reports no violation for that change and exits zero

#### Scenario: Archived change is ignored
> **Tests:** [`scripts/lint-unarchived.test.ts`](/scripts/lint-unarchived.test.ts) — ignores a fully checked change under archive/
- **GIVEN** a fully checked change that sits under `openspec/changes/archive/`
- **WHEN** the `lint:unarchived` gate runs
- **THEN** the gate reports no violation for it and exits zero

### Requirement: Merge is blocked while a finished change is unarchived

The repository SHALL run `lint:unarchived` in a `.husky/pre-merge-commit` hook, so a merge commit that would leave a finished-but-unarchived change in the merged tree is rejected. The gate SHALL NOT run in `pre-commit` or CI, because a branch legitimately has every task checked between finishing implementation and archiving.

#### Scenario: Merge with an unarchived finished change is rejected
> **Tests:** none
- **GIVEN** a feature branch whose active change has every task checked and is not archived
- **WHEN** the branch is merged into `main` with a merge commit
- **THEN** the `pre-merge-commit` hook fails and the merge commit is not created

#### Scenario: Merge after archive succeeds
> **Tests:** none
- **GIVEN** a feature branch whose finished change has been archived under `openspec/changes/archive/`
- **WHEN** the branch is merged into `main` with a merge commit
- **THEN** the `pre-merge-commit` hook passes and the merge commit is created

### Requirement: Branch deletion is blocked while a finished change is unarchived

The Claude `PreToolUse` hook for `Bash` commands matching `git branch -d` or `git branch -D` SHALL run `lint:unarchived` and SHALL block the command when the gate fails.

#### Scenario: Claude deletes a branch before archive
> **Tests:** none
- **GIVEN** the working tree has an active change with every task checked
- **WHEN** Claude runs `git branch -d <branch>`
- **THEN** the hook blocks the command and reports the unarchived change

#### Scenario: Claude deletes a branch after archive
> **Tests:** none
- **GIVEN** the working tree has no finished-but-unarchived change
- **WHEN** Claude runs `git branch -d <branch>`
- **THEN** the hook allows the command

### Requirement: Archive happens on the feature branch before merge

The `CLAUDE.md` Git Workflow SHALL order the commit steps as: feature branch, `reviewer` agent on the diff, archive the finished change, commit, push, merge to main, push main, delete branch. A change SHALL be archived on its feature branch rather than on a separate `chore-archive-*` branch after merge.

#### Scenario: Workflow lists archive before commit
> **Tests:** none
- **GIVEN** the Git Workflow section of `CLAUDE.md`
- **WHEN** the commit-instruction sequence is read
- **THEN** the archive step appears after the `reviewer` step and before the commit step
