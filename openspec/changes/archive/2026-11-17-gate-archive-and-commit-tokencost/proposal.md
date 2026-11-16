## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/75

## Why

The Git Workflow ends at merge and branch delete, and OpenSpec archive happens afterwards. Main is protected, so every archive needs its own `chore-archive-*` branch, and the feature branch is regularly deleted before its change is archived. Separately, `tokencost/cost.csv` is rewritten by the session cost-tracker hook but nothing stages it, so it only reaches history through dedicated `chore(tokencost): record session token usage` commits.

## What Changes

- Add `scripts/lint-unarchived.mjs` and `pnpm lint:unarchived`: fails when an active change (a directory under `openspec/changes/`, excluding `archive/`) has a `tasks.md` with at least one checkbox and no unchecked `- [ ]` item, meaning it is finished but not archived.
- Run `lint:unarchived` in a new `.husky/pre-merge-commit` hook, so a merge into main is blocked while a finished change is still active.
- Run `lint:unarchived` in the Claude `PreToolUse` hook on `git branch -d` / `-D`, so Claude cannot delete the branch of an unarchived change.
- Reorder the `CLAUDE.md` Git Workflow line: archive the change on the feature branch, then commit, push, merge, delete.
- Add `git add tokencost/cost.csv` to `.husky/pre-commit` after `lint-staged`, so the CSV rides along on every commit. Retire the separate `chore-tokencost-usage` branches.

Out of scope (noted in the issue): scoping the `PostToolUse` test run to related files, and pruning stale `prisma`/`eslint` entries in `settings.local.json`.

## Capabilities

### New Capabilities
- `process/change-archive-gate`: the `lint:unarchived` gate, its merge and branch-delete wiring, and the archive-before-merge workflow order.
- `process/commit-cost-tracking`: `tokencost/cost.csv` is staged into every commit by the pre-commit hook.

### Modified Capabilities
<!-- None: no existing requirement changes. -->

## Impact

- New: `scripts/lint-unarchived.mjs`, `scripts/lint-unarchived.test.ts`, `.husky/pre-merge-commit`, `package.json` script `lint:unarchived`.
- Edited: `.husky/pre-commit`, `.claude/settings.json` (`PreToolUse` Bash hook), `CLAUDE.md` (Git Workflow line).
- Not wired into CI or `pre-commit`: a branch legitimately has all tasks checked between finishing implementation and archiving, so those gates would fail on valid intermediate commits and PR runs.
- Fast-forward merges skip `pre-merge-commit`; the workflow's merges are `--no-ff`, and the `git branch -d` hook is the second line of defence.
- Merging a branch with `git merge` run outside Claude is covered only by the husky hook; deleting a branch from a terminal or IDE is not covered (git has no pre-delete hook).
