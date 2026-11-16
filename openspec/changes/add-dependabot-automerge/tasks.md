## 1. Repository settings (owner; the agent's permission classifier blocks these)

- [x] 1.1 Enable auto-merge on the repository: `gh api --hostname github.com -X PATCH repos/deniskrizanovic/collaborativegherkin -F allow_auto_merge=true`
- [x] 1.2 Protect `main`, requiring the `ci` check with `strict: false` and `enforce_admins: false`: `gh api --hostname github.com -X PUT repos/deniskrizanovic/collaborativegherkin/branches/main/protection --input -` with body `{"required_status_checks":{"strict":false,"contexts":["ci"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}`
- [x] 1.3 Read back and confirm: `allow_auto_merge` is `true`, and `branches/main/protection` reports contexts `["ci"]`, strict `false`, and enforce_admins `false`

## 2. Dependabot cooldown gate (test-first)

- [x] 2.1 Add a `lintDependabot — cooldown` describe block to `scripts/lint-dependabot.test.ts` with the three spec cases: "accepts an update entry with a cooldown", "flags an update entry with no cooldown", and "flags a non-positive cooldown default-days". Add `cooldown` to the shared valid-config fixture so the existing cases still pass. Run the tests and confirm the two new rejection cases fail.
- [x] 2.2 In `scripts/lint-dependabot.mjs`, add the cooldown check to the per-entry `forEach`. It fails when `cooldown` is missing or `cooldown["default-days"]` is not a positive integer, naming the entry label. Update the header comment and the success message.
- [x] 2.3 Add `cooldown: { default-days: 3, semver-major-days: 7 }` to the npm entry in `.github/dependabot.yml`
- [x] 2.4 `pnpm test -- --run scripts/lint-dependabot.test.ts` and `pnpm lint:dependabot` both pass

## 3. Auto-merge workflow

- [x] 3.1 Create `.github/workflows/dependabot-automerge.yml`. Trigger: `on: pull_request` (branches `[main]`). Workflow-level `permissions` are `contents: write` and `pull-requests: write`. A single job runs only if `github.event.pull_request.user.login == 'dependabot[bot]'`. Step 1 is `dependabot/fetch-metadata@v2` (id `metadata`). Step 2 runs `gh pr merge --auto --merge "$PR_URL"` only if `steps.metadata.outputs.update-type` is `version-update:semver-minor` or `version-update:semver-patch`, with `PR_URL` and `GH_TOKEN` passed via `env:` and no `${{ }}` in `run:`. If the security-reminder hook blocks the write, stop and hand the file to the owner. Don't work around the hook.
- [x] 3.2 Check the workflow YAML parses (for example with `node -e` and the `yaml` package) and that `ci.yml`'s `.github/**` path filter covers it
- [x] 3.3 In `.github/workflows/dependabot-automerge.yml`, replace the enable step's `run:` with the design's Decision 7 logic: read `gh pr view "$PR_URL" --json autoMergeRequest`; if auto-merge is already on, do nothing; otherwise run `gh pr merge --auto --merge "$PR_URL"` and then `gh pr comment "$PR_URL"` saying auto-merge is enabled and the PR will merge once `ci` passes. No `${{ }}` in `run:`. If the security-reminder hook blocks the write, stop and hand the file to the owner.
- [x] 3.4 Create `.github/workflows/dependabot-ci-alert.yml` (`Dependabot CI alert`) per Decision 8: `on: workflow_run` (`workflows: [CI]`, `types: [completed]`), workflow-level `permissions: pull-requests: write`, one job gated on `conclusion == 'failure'`, `workflow_run.event == 'pull_request'` and `workflow_run.actor.login == 'dependabot[bot]'`, with one step running `gh pr comment "$PR_NUMBER" --repo "$GITHUB_REPOSITORY"` and a body linking `$RUN_URL`. `PR_NUMBER`, `RUN_URL` and `GH_TOKEN` are passed via `env:`, with no `${{ }}` in `run:`. If the security-reminder hook blocks the write, stop and hand the file to the owner.
- [x] 3.5 Check that both workflow files parse and that `ci.yml`'s `.github/**` path filter covers them

## 4. Documentation

- [x] 4.1 Amend ADR 0004 (`docs/adr/0004-latest-stable-dependency-principle.md`) under Consequences: "latest stable" is applied after a Dependabot cooldown (3 days, 7 for majors). Minor and patch bumps auto-merge after `ci` passes, and majors stay manual.

## 5. Verification

- [x] 5.1 Run `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:dependabot`, `pnpm lint` and `pnpm lint:format`. All pass.
- [ ] 5.2 After merge to `main`, on the next Dependabot `minor-and-patch` PR, confirm that the `Dependabot auto-merge` run enabled auto-merge and that GitHub merged the PR only after `ci` passed. Confirm that the PR got exactly one "auto-merge enabled" comment. Confirm that major PRs (for example #67 after a rebase) show auto-merge not enabled and no auto-merge comment.
- [ ] 5.3 On the first Dependabot PR whose `ci` fails, confirm that the `Dependabot CI alert` run posted a comment linking the failed run. If the comment step fails on permissions, report it; don't widen permissions or scope without the owner.
