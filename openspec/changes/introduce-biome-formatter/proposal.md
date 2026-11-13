## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/63

## Why

The repository has no formatter. Style is kept by habit: every tracked TS/JS
file uses double quotes, semicolons and 2-space indentation, but nothing checks
it, and import order varies from file to file. Review diffs mix real changes
with whitespace, and agents and editors each format in their own way.

Biome formats TS, TSX, JS, JSON and CSS with one fast binary and no plugins. Its
linter would overlap with the linter the project already runs (ESLint via
`eslint-config-next`) and with oxlint, which is planned to take over linting in
a later change. This change therefore adopts Biome **as the formatter only**.
Each tool keeps one job: Biome formats and sorts imports, and ESLint (later
oxlint) lints. That avoids duplicate diagnostics and two suppression-comment
syntaxes.

## What Changes

- Add `@biomejs/biome` as a dev dependency, pinned to an exact version,
  because formatter output can change between releases.
- Add a root `biome.json`:
  - formatter on, set to the existing style (2-space indent, double quotes,
    semicolons, line width 100);
  - the `organizeImports` assist action on;
  - the Biome linter **off**;
  - scope limited to `*.{ts,tsx,js,mjs,cjs,json,jsonc,css}`;
  - Git ignore files respected;
  - generated Prisma client (`src/generated/**`) and `next-env.d.ts` excluded.

  Markdown and YAML are out of scope. The spec gates (`lint:specs`,
  `lint:given`, `lint:robot-steps`) parse the Markdown, and `lint:dependabot`
  parses the YAML.
- **No repo-wide reformat.** Files get formatted only when they are staged for
  commit:
  - The husky pre-commit hook (via `lint-staged`) runs `biome check --write`
    on staged in-scope files and re-stages the result, before ESLint.
  - New script `pnpm lint:format` runs Biome in check mode
    (`biome ci --changed`), scoped to files changed against `main`. It is
    added to `test:all` and CI. CI fails when a changed file is not
    formatted or has unsorted imports. Untouched files are never flagged.
- No repo-wide `pnpm format` script, so nothing can reformat the whole tree by
  accident. To fix a CI failure by hand, run
  `pnpm exec biome check --write <path>`.
- ESLint config, rules and its ADR 0004 exception are **unchanged**.
- Record the tool split in a new ADR (`docs/adr/0006-…`): Biome formats, the
  linter lints, oxlint is planned, and Markdown/YAML are excluded. Update
  `CLAUDE.md` key commands and the README commands table.

## Capabilities

### New Capabilities
- `code-formatting`: Biome is the single source-code formatter. It defines
  which files are in scope, the style it enforces, that it never lints, and
  that formatting is applied at commit time and checked in CI only for
  changed files.

### Modified Capabilities
_None._ ESLint behaviour, spec gates and dependency policy are unchanged.

## Impact

- **New files:** `biome.json`, `docs/adr/0006-biome-formatter-tool-split.md`,
  `scripts/biome-config.test.ts`.
- **Modified:** `package.json` (devDependency, `lint:format` script,
  `test:all`, `lint-staged`), `pnpm-lock.yaml`,
  `.github/workflows/ci.yml` (full-history checkout, `lint:format` step,
  `biome.json` in path filters), `CLAUDE.md`, `README.md`.
- **Developer workflow:** the first commit that touches a file reformats the
  whole file, so diffs for those files carry some extra formatting churn. The
  user accepted this trade-off instead of a single repo-wide reformat.
- **Dependencies:** Dependabot picks up `@biomejs/biome` updates with the rest
  of the npm group. Biome releases can change formatter output, so a bump may
  make CI flag files changed in the same PR.
- **No runtime impact.** Biome is dev-only and never imported by app code.
  This change does not edit any protected area (`src/lib/gherkin.ts`, Y.js
  config, NextAuth, migrations, export logic). A later, separately approved
  commit that touches one of them will also reformat it. Formatting and import
  sorting do not change behaviour.
