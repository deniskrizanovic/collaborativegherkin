## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/69

## Why

Dependabot pull requests stay open until the owner merges them by hand. PR #65
(ten minor and patch bumps) passed CI and then waited for a manual merge.
ADR 0004 commits the project to the latest stable version of every dependency,
so every routine bump that waits on a person works against that principle.

GitHub auto-merge can't simply be switched on today. `main` has no branch
protection, so no check is required, and an auto-merge PR would merge
immediately without waiting for CI. Auto-merge also pulls in new releases
within hours of publication. That is when a hijacked npm release does its
damage, before the registry yanks it.

## What Changes

- Add a `Dependabot auto-merge` GitHub Actions workflow. On every Dependabot
  pull request against `main`, it reads the update type and turns on GitHub
  auto-merge when the update is minor or patch. Major bumps get no auto-merge
  and stay open for manual review, as now. When it enables auto-merge, it
  comments on the PR, so the owner (the PR's assignee) is notified that the
  bump is queued.
- Add a `Dependabot CI alert` workflow that comments on any Dependabot PR
  whose `ci` check fails, linking the failed run. Without it a failed bump
  sits unseen: GitHub sends Actions failure notifications to whoever triggered
  the run, which is Dependabot, not the owner.
- Require the `ci` status check on `main` through branch protection, and turn
  on the repository's "Allow auto-merge" setting. Auto-merge then waits for
  `ci` to pass and never merges a failing PR. Admins stay exempt, so the
  owner's direct pushes to `main` keep working.
- Add a `cooldown` to the npm entry in `.github/dependabot.yml`: 3 days by
  default and 7 days for major versions. Dependabot then waits that long after
  a release before it proposes the release.
- Extend the `lint:dependabot` gate so that every `updates[*]` entry must set a
  `cooldown` with a positive `default-days`. Removing the cooldown then fails
  the gate instead of passing silently.
- Amend ADR 0004 to record the cooldown as part of how "latest stable" is
  applied.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dependency-maintenance`: adds four requirements. Minor and patch Dependabot
  PRs auto-merge after `ci` passes. The owner is notified when auto-merge is
  queued or when `ci` fails on a Dependabot PR. `main` requires the `ci`
  check. Every Dependabot update entry declares a cooldown, and
  `lint:dependabot` enforces it.

## Impact

- **New files:** `.github/workflows/dependabot-automerge.yml` and
  `.github/workflows/dependabot-ci-alert.yml`.
- **Changed files:** `.github/dependabot.yml` (cooldown),
  `scripts/lint-dependabot.mjs` and `scripts/lint-dependabot.test.ts` (cooldown
  rule), `docs/adr/0004-latest-stable-dependency-principle.md` (cooldown note).
- **Repository settings (not version-controlled):** "Allow auto-merge" on, and
  branch protection on `main` that requires the `ci` check with admins exempt.
  The owner applies these by hand or through `gh api`. The agent's permission
  classifier blocks the agent from changing them.
- **Pull requests from people:** any PR against `main` must pass `ci` before it
  can merge, unless an admin bypasses the check. A PR that touches none of the
  `ci.yml` path filters never gets a `ci` result, so it needs an admin bypass.
- **Merges by the auto-merge workflow:** these are made with `GITHUB_TOKEN`, so
  they don't trigger the `push`-to-`main` CI run. The PR's own `ci` run is the
  gate.
- No application code, database, or runtime dependencies change.
