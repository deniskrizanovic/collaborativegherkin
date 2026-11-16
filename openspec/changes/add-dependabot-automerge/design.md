## Context

Dependabot runs weekly for npm (`.github/dependabot.yml`). Minor and patch bumps
arrive as one grouped `minor-and-patch` pull request. Each major bump arrives as
its own pull request. CI (`.github/workflows/ci.yml`, job `ci`) runs on these
pull requests because the path filters include `package.json` and
`pnpm-lock.yaml`.

Current state, checked on 2026-11-16:

- `main` has no branch protection (`GET .../branches/main/protection` returns
  404), so no status check is required to merge.
- `allow_auto_merge` is `false` on the repository.
- Dependabot pull requests have been merged by hand with merge commits (#50,
  #59, #65).
- The agent's Claude Code permission classifier blocks changes to repository
  settings and branch protection, which it classes as a "CI Bypass". The
  `security_reminder_hook` PreToolUse hook blocked the agent from writing a new
  file under `.github/workflows/`. The owner therefore applies both, or
  approves them, during apply.

## Goals / Non-Goals

**Goals:**

- Minor and patch Dependabot pull requests reach `main` with no manual step,
  and only after `ci` passes.
- Major bumps keep a person in the loop.
- Fewer supply-chain surprises: fresh releases wait a few days before
  Dependabot proposes them.
- The cooldown can't be dropped by accident (gate-enforced).
- The owner hears when a bump is queued for auto-merge and when one is
  blocked by a failing `ci`.

**Non-Goals:**

- Adding a Dependabot `github-actions` ecosystem, or pinning actions to SHAs
  across the repo.
- Auto-approving reviews. No reviews are required, so there's nothing to
  approve.
- Changing the CI path filters, or adding a catch-all job so that PRs which
  touch no filtered path still report `ci`.
- Automating the repository-settings step (no settings-as-code tooling).

## Decisions

### 1. Native GitHub auto-merge, gated by a required `ci` check

The workflow only *enables* auto-merge (`gh pr merge --auto --merge`). GitHub
performs the merge once the required checks pass. The PR's existing `ci` run is
the gate. Nothing duplicates it, and nothing polls it.

*Alternatives:*

- A `workflow_run` job that merges after `CI` completes. This needs its own
  success and update-type logic. A `workflow_run` triggered by Dependabot also
  runs with Dependabot's restricted token. Rejected.
- Merging directly with `gh pr merge` (without `--auto`) in the same workflow.
  That would merge before CI finishes. Rejected.

### 2. Update type from `dependabot/fetch-metadata@v2`

The step reads `steps.metadata.outputs.update-type`. Auto-merge is enabled only
when the value is `version-update:semver-minor` or
`version-update:semver-patch`. The step uses an explicit allow-list, not "not
major", so an unknown or empty value fails safe and is not auto-merged.
`fetch-metadata` is maintained by the Dependabot team. For grouped pull
requests it reports the highest update type in the group. The
`minor-and-patch` group can only hold minor and patch updates, so the group PR
qualifies.

*Alternatives:*

- Matching the head branch prefix `dependabot/npm_and_yarn/minor-and-patch-`.
  This needs no third-party action, but it depends on Dependabot's branch
  naming and would miss individual minor bumps (for example, ones that exceed
  the group). Rejected.
- Pinning `fetch-metadata` to a commit SHA. This is safer against a
  compromised tag, but the repo pins actions by major tag throughout
  (`actions/checkout@v7`), and nothing updates SHAs because there is no
  `github-actions` Dependabot ecosystem. The workflow stays on the `v2` tag,
  and SHA pinning goes in Open Questions.

### 3. Trigger and permissions

The trigger is `on: pull_request` (branches `[main]`), not
`pull_request_target`. The job runs only when
`github.event.pull_request.user.login == 'dependabot[bot]'`. Workflows
triggered by Dependabot get a read-only `GITHUB_TOKEN`. GitHub documents that a
workflow-level `permissions:` block (`contents: write`, `pull-requests: write`)
raises it enough to enable auto-merge. `pull_request_target` would run with
base-repo secrets against PR content, which is broader than needed.

`run:` lines contain no `${{ }}` expressions. The PR URL is passed through
`env:` (`PR_URL`) and quoted, following the injection guidance from the
security-reminder hook.

### 4. Branch protection shape

The protection requires `contexts: ["ci"]`, `strict: false`, and
`enforce_admins: false`, with no required reviews and no push restrictions.

- `strict: false`: with `strict: true`, every pull request must be rebased onto
  the latest `main` and CI must re-run before it merges. That serialises merges
  and adds rebase churn for a solo repo. The gap this leaves (a PR that is
  green against an older `main`) is small, because Dependabot PRs touch only
  manifests.
- `enforce_admins: false`: the owner's CLAUDE.md workflow merges locally and
  pushes `main` directly. That must keep working.

### 5. Cooldown values, enforced by `lint:dependabot`

The npm entry sets `cooldown: { default-days: 3, semver-major-days: 7 }`.
Hijacked npm releases are usually detected and yanked within a few days. Majors
get a longer wait because a person reviews them anyway, so the wait costs
little. The gate checks only that `cooldown.default-days` is a positive integer
on every entry, not the exact values, so tuning stays a config edit and not a
code change. The check goes into the existing `forEach` in
`scripts/lint-dependabot.mjs`, next to the assignee check. Tests are added to
`scripts/lint-dependabot.test.ts` in the same style.

### 6. Merge method: merge commit

The workflow uses `--merge` to match the history of earlier Dependabot merges
(`Merge pull request #59 …`) and the project's merge-commit workflow.

### 7. Queued comment, posted only when auto-merge is turned on

The enable step first reads `gh pr view "$PR_URL" --json autoMergeRequest`. If
auto-merge is already on, it does nothing. Otherwise it runs
`gh pr merge --auto --merge "$PR_URL"` and then `gh pr comment "$PR_URL"` with
a short "auto-merge enabled; will merge once `ci` passes" body. Dependabot
rebases re-run the workflow (`synchronize`), so the check keeps each rebase
from adding another comment. Values reach `run:` only through `env:`. The
owner is the PR's assignee, so the comment notifies them.

*Alternatives:*

- Commenting only on the `opened` event. If enabling failed on the opening run,
  a later successful run would never announce. Rejected.

### 8. Failure alert through a `workflow_run` workflow

`.github/workflows/dependabot-ci-alert.yml` (`Dependabot CI alert`) triggers on
`workflow_run` (`workflows: [CI]`, `types: [completed]`). Its job runs only if
`github.event.workflow_run.conclusion == 'failure'`,
`github.event.workflow_run.event == 'pull_request'`, and
`github.event.workflow_run.actor.login == 'dependabot[bot]'`. The PR number
(`workflow_run.pull_requests[0].number`) and the run URL
(`workflow_run.html_url`) are passed through `env:`, and the step runs
`gh pr comment "$PR_NUMBER" --repo "$GITHUB_REPOSITORY"` with a body that links
the run. Workflow-level `permissions` is `pull-requests: write`. The alert
covers major bumps too, because a failing major also needs the owner.

*Alternatives:*

- A `failure()` step in `ci.yml`. That gives every CI run PR-write permission.
  Rejected.
- A job that polls `gh pr checks --watch` until `ci` finishes. It burns runner
  minutes for the length of CI, and Decision 1 already avoids polling.
  Rejected.

## Risks / Trade-offs

- [A minor or patch bump breaks behaviour that CI doesn't cover] → CI runs
  typecheck, oxlint, Vitest and the Robot e2e suite. The bump is a single merge
  commit and easy to revert.
- [A malicious release passes CI] → The 3-day cooldown shrinks the exposure
  window, and lockfile-only diffs keep the PR easy to audit after the fact.
- [Merges made by `GITHUB_TOKEN` don't trigger the `push`-to-`main` CI run] →
  Accepted. The PR's `ci` run tested the same content merged onto `main` as it
  stood at that time.
- [A person's PR that touches no `ci.yml` path never reports `ci` and can't
  merge] → The admin bypass is still available, and the owner mostly pushes
  directly. Noted in the proposal's Impact section.
- [Branch protection is not version-controlled and can drift] → The spec
  records the expected shape, and the apply tasks include a `gh api` read-back
  to verify it.
- [A Dependabot-triggered `workflow_run` gets a read-only `GITHUB_TOKEN`] →
  As in Decision 3, the workflow-level `permissions:` block raises it. The
  first real failure verifies this. If the comment step fails on permissions,
  that is reported, not worked around.
- [`workflow_run` only fires for workflow files on the default branch] → The
  alert can't be exercised before merge. It is verified on the first failing
  Dependabot `ci` run.
- [A Dependabot PR that fails `ci` repeatedly across rebases gets one alert
  per failure] → Accepted. Each failure is a fresh signal.
- [Workflow-file writes are blocked by the security-reminder hook during
  apply] → The owner writes the file from `tasks.md` or approves the write.
  The agent does not work around the hook.

## Migration Plan

1. The owner enables "Allow auto-merge" and applies branch protection on `main`
   (commands in `tasks.md`). This must happen first. If the workflow landed
   while `main` had no required check, a Dependabot PR could merge before CI.
2. Land the workflow, the cooldown, the gate extension and the ADR note on a
   feature branch. Merge to `main`.
3. Verify on the next weekly Dependabot run. Existing open PRs (#66, #67) are
   major bumps and are not auto-merged.

**Rollback:** delete `.github/workflows/dependabot-automerge.yml` (or disable it
in the Actions UI). To stop a queued merge, run `gh pr merge --disable-auto`
on that PR. Branch protection can stay. It is useful on its own.

## Open Questions

- Should Actions be pinned to commit SHAs, with a `github-actions` Dependabot
  ecosystem added to keep them current? This is a separate change if wanted.
