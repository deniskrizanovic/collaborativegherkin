## Context

Merges in this repo are `--no-ff` merge commits made after the `reviewer` step, followed by branch delete. Archive currently comes after delete, so each archive needs its own `chore-archive-*` branch (main is protected). `tokencost/cost.csv` is rewritten by the global `cost-tracker.py` SessionStart/SessionEnd hook; nothing stages it. Husky v9 generates stubs in `.husky/_/` including `pre-merge-commit`; only `.husky/pre-commit` exists as a real hook today. Git has no pre-branch-delete hook, and husky does not ship `reference-transaction`.

## Goals / Non-Goals

**Goals:**
- Make "finished but not archived" a checkable state, and block the two moments it hurts: merge and branch delete.
- Move archive onto the feature branch.
- Make the cost CSV part of every commit without a manual step.

**Non-Goals:**
- Covering branch deletion from a terminal or IDE (no git hook exists; `reference-transaction` is unversioned).
- Running the gate in CI or `pre-commit`.
- Scoping the `PostToolUse` test run or pruning `settings.local.json` permissions.

## Decisions

- **"Finished" means at least one checkbox and no `- [ ]` in `tasks.md`.** Alternative: ask `openspec status`. Rejected: it reports artifact existence, not task completion, and the script stays a pure filesystem check like its `lint:*` siblings. A missing `tasks.md` or zero checkboxes is not finished, so planning-stage changes never trip it.
- **Reuse `collectActiveChanges` logic from `lint-issue-link.mjs`.** Same active-change definition (directory under `openspec/changes/`, not `archive`). Import it rather than copy, so the definition stays in one place; if exporting it from that module is awkward, extract it to a shared module.
- **Hook on `pre-merge-commit`, not `pre-push` or `pre-commit`.** The working tree at that point is the merged result, so the check sees what main will contain. `pre-commit` and CI would fail valid intermediate states (all tasks done, archive still to do). Trade-off: fast-forward merges skip the hook; the workflow uses `--no-ff`.
- **Claude hook on `git branch -d/-D` reuses the existing `PreToolUse` Bash entry style** (`if: "Bash(git branch -d*)"`, `-D` too), running `pnpm run lint:unarchived` and stopping with a reason on failure. It is offline, unlike `lint:issue-link`, so no timeout concern.
- **`git add tokencost/cost.csv` after `lint-staged`.** lint-staged stashes unstaged changes while it runs; adding afterwards keeps the file out of that stash cycle. Plain `git add` of an unchanged file is a no-op. Alternative: a Claude `PreToolUse` hook; rejected because it misses commits made outside Claude.
- **Reorder `CLAUDE.md` as one edit to the existing Git Workflow line**, not a new section.

## Risks / Trade-offs

- [Branch deleted by hand in terminal/IDE] → Not covered; the merge gate still forces archive before the merge that precedes deletion in the workflow.
- [Developer wants to merge a finished change deliberately without archiving] → Gate fails; archive it, or uncheck a task. No bypass flag is added.
- [Staged CSV in a commit unrelated to token usage] → Intended per the issue; the diff is one appended row per session.
- [Partial or `--only` commits (`git commit <path>`)] → `git add` in the hook may not affect that commit's index; accepted, the CSV lands on the next normal commit.
