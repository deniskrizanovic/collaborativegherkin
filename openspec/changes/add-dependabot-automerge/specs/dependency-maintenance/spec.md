## ADDED Requirements

### Requirement: Minor and patch Dependabot pull requests auto-merge after CI passes

A `Dependabot auto-merge` workflow SHALL enable GitHub auto-merge (merge
commit) on Dependabot pull requests against `main` whose update type is
semver-minor or semver-patch, so they merge only after the required checks
pass. It SHALL NOT enable auto-merge for major updates or for other authors.

#### Scenario: Minor/patch group update merges once CI passes
> **Tests:** none
- **GIVEN** Dependabot has opened a `minor-and-patch` group pull request against `main`
- **WHEN** the `ci` check on that pull request passes
- **THEN** GitHub merges the pull request into `main` with a merge commit, with no manual step

#### Scenario: Minor/patch update with failing CI stays open
> **Tests:** none
- **GIVEN** Dependabot has opened a patch-update pull request against `main` and auto-merge is enabled on it
- **WHEN** the `ci` check on that pull request fails
- **THEN** the pull request stays open and unmerged, and `main` is unchanged

#### Scenario: Major update is left for manual review
> **Tests:** none
- **GIVEN** Dependabot has opened a pull request bumping `typescript` from 6.0.3 to 7.0.2
- **WHEN** the `ci` check on that pull request passes
- **THEN** the pull request stays open with auto-merge not enabled and no auto-merge comment, awaiting the owner's merge

#### Scenario: Pull request from a person is not auto-merged
> **Tests:** none
- **GIVEN** the owner has opened a pull request against `main`
- **WHEN** the `Dependabot auto-merge` workflow runs for that pull request
- **THEN** the workflow's job is skipped and auto-merge is not enabled

### Requirement: Dependabot auto-merge activity notifies the owner

The `Dependabot auto-merge` workflow SHALL comment on a pull request when it
turns auto-merge on, saying the pull request will merge once `ci` passes. A
`Dependabot CI alert` workflow SHALL comment on a Dependabot pull request
against `main` whose `ci` check fails, linking the failed run. Neither workflow
SHALL comment on pull requests from other authors.

#### Scenario: Owner is told a minor/patch update is queued
> **Tests:** none
- **GIVEN** Dependabot has opened a `minor-and-patch` group pull request against `main`, assigned to the owner
- **WHEN** the `Dependabot auto-merge` workflow enables auto-merge on it
- **THEN** the pull request gets one comment saying auto-merge is enabled and it will merge once `ci` passes

#### Scenario: Rebased update is not re-announced
> **Tests:** none
- **GIVEN** a Dependabot patch-update pull request against `main` already has auto-merge enabled
- **WHEN** Dependabot rebases it and the `Dependabot auto-merge` workflow runs again
- **THEN** no new auto-merge comment is posted

#### Scenario: Owner is told CI failed on a Dependabot update
> **Tests:** none
- **GIVEN** Dependabot has opened a pull request against `main`, assigned to the owner
- **WHEN** the `ci` check on that pull request fails
- **THEN** the pull request gets a comment saying `ci` failed, with a link to the failed run

#### Scenario: CI failure on a person's pull request gets no alert
> **Tests:** none
- **GIVEN** the owner has opened a pull request against `main`
- **WHEN** the `ci` check on that pull request fails
- **THEN** the `Dependabot CI alert` workflow's job is skipped and no comment is posted

### Requirement: Main requires the CI check before a pull request merges

Branch protection on `main` SHALL require the `ci` status check to pass before
a pull request merges, and the repository SHALL have "Allow auto-merge"
enabled. Branch protection SHALL NOT require the branch to be up to date with
`main` (`strict: false`), and SHALL NOT be enforced for administrators, so the
owner can still push directly to `main`.

#### Scenario: Pull request with failing CI cannot be merged
> **Tests:** none
- **GIVEN** a pull request against `main` whose `ci` check has failed
- **WHEN** a non-admin tries to merge the pull request
- **THEN** GitHub blocks the merge until the `ci` check passes

#### Scenario: Owner pushes directly to main
> **Tests:** none
- **GIVEN** branch protection on `main` requires the `ci` check and is not enforced for administrators
- **WHEN** the owner pushes a merge commit directly to `main`
- **THEN** GitHub accepts the push

### Requirement: Every Dependabot update entry declares a release cooldown

Every `updates[*]` entry in `.github/dependabot.yml` SHALL set a `cooldown`
whose `default-days` is a positive integer, so Dependabot waits before it
proposes a freshly published release. The npm entry SHALL use `default-days: 3`
and `semver-major-days: 7`. The `lint:dependabot` gate SHALL fail when an entry
has no `cooldown` or its `default-days` is not a positive integer, and SHALL
name the entry.

#### Scenario: Update entry with a cooldown passes
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../../../scripts/lint-dependabot.test.ts) — accepts an update entry with a cooldown
- **GIVEN** the `npm` update entry in `.github/dependabot.yml` sets `cooldown: { default-days: 3, semver-major-days: 7 }`
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports no cooldown violation for that entry

#### Scenario: Update entry without a cooldown is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../../../scripts/lint-dependabot.test.ts) — flags an update entry with no cooldown
- **GIVEN** the `npm` update entry in `.github/dependabot.yml` has no `cooldown` key
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports a missing-cooldown violation naming the `npm` ecosystem and exits non-zero

#### Scenario: Zero-day cooldown is rejected
> **Tests:** [`scripts/lint-dependabot.test.ts`](../../../../../scripts/lint-dependabot.test.ts) — flags a non-positive cooldown default-days
- **GIVEN** the `npm` update entry in `.github/dependabot.yml` sets `cooldown: { default-days: 0 }`
- **WHEN** the `lint:dependabot` gate runs
- **THEN** the gate reports that `default-days` must be a positive integer for the `npm` entry and exits non-zero
