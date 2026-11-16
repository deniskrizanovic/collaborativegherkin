## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/70

## Why

A retro on the add-crap-metric-gate session (#68) found three gaps in the
tooling gates.

- **Format churn on first touch.** ADR 0006 adopted Biome staged-only: no
  bulk reformat, and `lint:format` checks only files changed against `main`.
  On 2026-11-16, `biome check --write .` (formatting plus import sorting)
  rewrote 72 tracked files across `src/`, `e2e/`, `scripts/`, `server.js`,
  `prisma/seed.ts`, `robot/libraries/routes.cjs`, `tsconfig.json` and
  `vitest.config.ts`. An earlier count of 20 used `biome format .`, which
  skips import sorting and missed most of them. The first edit to any of them carries a
  whole-file reformat, as appending a few tests to `src/lib/gherkin.test.ts`
  did in #68. That noise lands in feature diffs and review. A single
  reformat commit removes it for good.
- **`lint:crap` hides every score at or under 30.** To check how close a
  function sat to the threshold, the agent wrote two scratch scripts that
  imported the gate's internal functions. The gate should show that itself.
- **The `console.*` ban is prose only.** CLAUDE.md and the OpenSpec project
  context tell agents to use the Pino logger rather than `console.log`, but
  no lint rule checks it. `src/` has one `console.*` call today: the
  logger's own startup fallback in `src/lib/logger.ts`, which takes an
  `oxlint-disable-next-line` comment.

## What Changes

- **BREAKING (process):** reverse ADR 0006's staged-only adoption. Reformat
  every in-scope file once, in its own commit. Add a `pnpm format` script
  that writes formatting for the whole tree.
- `lint:format` checks the whole tree (`biome ci .`), not just changed files.
  CI drops the comparison-base logic for this step.
- The husky pre-commit hook keeps formatting staged files, unchanged.
- `lint:crap --all` lists every scored function, worst first, not just the
  offenders. `lint:crap --file <path>` limits the report and the exit code to
  functions in that file, or under that directory. With no flags the gate
  behaves as today.
- `.oxlintrc.json` enables `no-console` as an error for `src/**`, with test
  files exempt.
- Add ADR 0008, superseding the adoption section of ADR 0006.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-formatting`: "Only files being committed are formatted" no longer
  forbids a wholesale reformat or a whole-tree format script. "Changed files
  are checked for formatting" becomes a whole-tree check. "The format check
  gates CI and test:all" drops the CI comparison base.
- `crap-metric`: new requirement for the `--all` and `--file` report options.
- `code-linting`: new requirement that `src/` code makes no `console.*`
  calls.

## Impact

- **Reformatted files:** the 72 files listed above. Four sit on or under the
  CLAUDE.md Do Not Touch list: `src/lib/gherkin.ts`, `src/auth.ts`,
  `src/components/GherkinEditor.tsx` and `server.js`. The user approved the
  layout-only change to them on 2026-11-16. `src/proxy.ts` (the auth gate)
  also changes only in layout.
- **Config:** `package.json` (`format`, `lint:format`), `.github/workflows/ci.yml`
  (Lint format step), `.oxlintrc.json` (`no-console` override).
- **Code:** `scripts/lint-crap.mjs` gains argument parsing.
- **Tests:** `scripts/biome-config.test.ts`, `scripts/lint-crap.test.ts`,
  `scripts/oxlint-config.test.ts`.
- **Docs:** new `docs/adr/0008-*.md`; ADR 0006 gets a superseded note;
  CLAUDE.md's `lint:format` line.
- **Dependabot:** a Biome version bump that changes formatter output now
  fails `lint:format` on its PR until someone runs `pnpm format` on that
  branch.
