# ADR 0008 — The Whole Tree Is Formatted and Checked

**Status:** Accepted  
**Date:** 2026-11-16  
**Supersedes:** the "Adoption is staged-only" section of [ADR 0006](0006-biome-formatter-tool-split.md)

## Context

ADR 0006 adopted Biome without a bulk reformat. Files were formatted only when committed, and `lint:format` (`biome ci --changed`) checked only files changed against `main`. Three days later, a retro on the add-crap-metric-gate session (#68, #70) found that most of the tree was still off-style. On 2026-11-16 `biome check --write .` rewrote 72 tracked files. The first edit to any of them pulled a whole-file reformat into a feature diff, as appending a few tests to `src/lib/gherkin.test.ts` did in #68. Reviewers then had to read layout changes to find the real change.

The staged-only check had a cost of its own too. CI had to compute a comparison base (PR base, pre-push commit, or `HEAD^` as a fallback) and check out full history (`fetch-depth: 0`) so that base existed.

## Decision

**The whole tree is in house style, and `lint:format` checks every in-scope file.**

- `pnpm format` (`biome check --write .`) formats every in-scope file and sorts its imports. It ran once, and its output was committed alone. `.git-blame-ignore-revs` lists that commit, so `git blame` and GitHub's blame view skip it.
- `pnpm lint:format` is `biome ci .`. It checks every in-scope file, changed or not. It runs in `test:all` and in the CI "Lint format" step with no comparison base, and CI checks out with the default shallow depth.
- The husky pre-commit hook (`lint-staged`) is unchanged: it formats staged files and re-stages them.
- Biome's scope and style options are unchanged (ADR 0006). `.claude/settings.local.json` is now in `.gitignore`, so a per-user file that only a global Git excludes file used to ignore cannot fail the local check while CI passes.

The one-time reformat touched four files on or under the CLAUDE.md Do Not Touch list (`src/lib/gherkin.ts`, `src/auth.ts`, `src/components/GherkinEditor.tsx`, `server.js`). The changes were layout only, and the user approved them. `typecheck`, the unit suite and the Robot e2e suite ran against the reformatted tree.

## Consequences

- A feature diff carries only its own changes. The first edit to a file no longer drags in a whole-file reformat.
- **A Biome version bump can fail `lint:format`.** If a new Biome release changes formatter output, its Dependabot PR fails CI across the tree, not just on changed files. To fix it, run `pnpm format` on that PR branch, commit the result alone, add the commit to `.git-blame-ignore-revs`, and push. Biome is pinned exactly, so this happens only on a deliberate bump.
- Branches open during the reformat conflict on layout when rebased. Running `pnpm format` after the rebase resolves the layout side.
- `pnpm exec biome check --write <path>` still works as a manual fix, but `pnpm format` covers the whole tree.
