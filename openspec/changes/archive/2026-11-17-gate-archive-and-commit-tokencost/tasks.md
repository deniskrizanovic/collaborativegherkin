## 1. Gate script

- [x] 1.1 Write failing tests in `scripts/lint-unarchived.test.ts` for finished, open-task, no-checkbox, missing `tasks.md` and archived cases
- [x] 1.2 Implement `scripts/lint-unarchived.mjs` (pure filesystem; reuse the active-change definition from `lint-issue-link.mjs`; exit non-zero naming each finished change)
- [x] 1.3 Add `"lint:unarchived": "node scripts/lint-unarchived.mjs"` to `package.json`

## 2. Wiring

- [x] 2.1 Add `.husky/pre-merge-commit` running `pnpm run lint:unarchived`, with a comment in the style of `.husky/pre-commit`
- [x] 2.2 Add a `PreToolUse` Bash hook in `.claude/settings.json` for `git branch -d*` / `-D*` that runs `pnpm run lint:unarchived` and stops with a reason on failure
- [x] 2.3 Add `git add tokencost/cost.csv` to `.husky/pre-commit` after `lint-staged`, with a comment explaining why

## 3. Workflow docs

- [x] 3.1 Edit the `CLAUDE.md` Git Workflow line to: feature branch → `reviewer` agent → archive the change → commit → push → merge to main → push main → delete branch
- [x] 3.2 Add `lint:unarchived` to the Key commands list in `CLAUDE.md` if the other `lint:*` gates are listed there

## 4. Specs and verification

- [x] 4.1 Replace `> **Tests:** none` in the delta specs with links to `/scripts/lint-unarchived.test.ts` where a test now exists
- [x] 4.2 Run `pnpm run lint:unarchived` on a throwaway fully-checked change to confirm it fails, and on this repo to confirm it passes when no finished change is active
- [x] 4.3 Make a trial commit on a scratch branch with `tokencost/cost.csv` modified and confirm the CSV is in the commit
- [x] 4.4 Run `pnpm test`, `pnpm lint`, `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:spec-layout`, `pnpm lint:openspec`
