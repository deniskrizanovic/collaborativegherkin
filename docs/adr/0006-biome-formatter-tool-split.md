# ADR 0006 — Biome Formats, the Linter Lints

**Status:** Accepted  
**Date:** 2026-11-13

## Context

The repository had no formatter. Style was kept by habit: every tracked TS/JS file used double quotes, semicolons and 2-space indentation, but nothing checked it, and import order varied from file to file. Review diffs mixed real changes with whitespace, and agents and editors each formatted in their own way (issue #63).

Biome formats TS, TSX, JS, JSON and CSS with one binary and no plugins, and sorts imports through its `organizeImports` assist action. It also ships a linter, which would overlap with ESLint (via `eslint-config-next`) today and with oxlint, which is planned to take over linting later. Running two linters means duplicate diagnostics and two suppression-comment syntaxes (`eslint-disable` and `biome-ignore`).

## Decision

**Biome is the only formatter, and it never lints.** `biome.json` turns the formatter and `organizeImports` on and the Biome linter off. Lint diagnostics come only from the project's linter. The formatter options match the existing style (2-space indent, double quotes, semicolons) with a line width of 100, so the first format of a file changes little beyond long lines and import order. `@biomejs/biome` is pinned to an exact version, because formatter output can change between releases.

### Markdown and YAML are excluded

Biome processes only `*.{ts,tsx,js,mjs,cjs,json,jsonc,css}`, respects `.gitignore`, and skips the generated Prisma client (`src/generated/**`) and `next-env.d.ts`. Biome can format Markdown and YAML, but the `lint:specs`, `lint:given` and `lint:robot-steps` gates parse OpenSpec Markdown line by line, and `lint:dependabot` parses `.github/dependabot.yml`. A formatter rewrapping those files could break a gate, for little gain.

### Adoption is staged-only, with no bulk reformat

There is no one-shot reformat commit and no `pnpm format` script that could rewrite the whole tree. Files get formatted when they are committed:

- The husky pre-commit hook (`lint-staged`) runs `biome check --write` on staged in-scope files before ESLint, and re-stages the result.
- `pnpm lint:format` (`biome ci --changed`) checks only files changed against `main`. It runs in `test:all` and CI; in CI the base is the PR base commit or the pre-push commit. Untouched files are never flagged.
- A manual fix is `pnpm exec biome check --write <path>`.

### Next step: oxlint

Linting moves to oxlint in a separate change. During the transition, `eslint-plugin-oxlint` turns off the ESLint rules oxlint already covers, so ESLint runs only the rules oxlint lacks (for example `react-hooks/set-state-in-effect` and `@next/next/no-img-element`). ESLint goes once oxlint covers them. Formatting and linting have separate configuration, so this ADR does not constrain that change.

## Consequences

- The first commit that touches a file reformats the whole file, so those diffs carry some formatting churn. This was accepted over a single repo-wide reformat.
- A Biome version bump can change formatter output. Because CI checks only changed files, a bump flags at most the files changed in the same PR.
- Biome, ESLint and the spec gates each own one job; ESLint's configuration and its ADR 0004 exception are unchanged.
- Editors should use the Biome plugin as the formatter for in-scope files (WebStorm settings live in the gitignored `.idea/`).
