## Context

The repository has no formatter. The only style tooling is ESLint 9 via
`eslint-config-next` (`core-web-vitals` + `typescript`). Those presets carry no
stylistic rules. ESLint runs in `lint-staged` (`*.{ts,tsx}`), in CI
(`pnpm lint`) and in `test:all`.

Measured style of tracked TS/JS, excluding `src/generated/**`:

- 81 of 81 files with imports use double quotes and end statements with
  semicolons;
- no file uses tab indentation (2-space throughout);
- of 10,478 lines, 861 exceed 80 characters, 277 exceed 100, and 99 exceed
  120.

The user's constraints for this change:

- Biome formats only.
- Oxlint will take over linting in a later, separate change.
- No repo-wide reformat. Files are formatted when they are staged.

The npm config on the dev machine enforces `min-release-age=3`, so the newest
Biome release may not install on its first days.

## Goals / Non-Goals

**Goals:**
- Biome is the one formatter for TS/TSX/JS/JSON/CSS, plus import sorting.
- Its output matches today's style, so the first touch of a file causes little
  churn.
- Staged files are formatted automatically at commit. CI rejects changed files
  that are not formatted.
- ESLint, the spec gates and the dependency policy are unchanged.

**Non-Goals:**
- Biome linting (the linter stays disabled).
- Introducing oxlint, or cutting ESLint down with `eslint-plugin-oxlint`.
  Both belong to a separate change.
- A one-shot reformat of the repo, or a `.git-blame-ignore-revs` file.
- Formatting Markdown, YAML, Python or `.robot` files.

## Decisions

### D1 — Biome as formatter only, linter disabled

`biome.json` sets `linter.enabled: false`, `formatter.enabled: true`, and
`assist.actions.source.organizeImports: "on"`. The pre-commit hook and CI both
run `biome check`/`biome ci` (formatter + assist), so one command covers
formatting and import order.

*Alternatives:*
- **Biome lint + format.** Its rules would duplicate ESLint now and oxlint
  later, with a second suppression syntax (`biome-ignore`).
- **Prettier.** Slower, and import sorting needs a plugin.
- **oxfmt** (pairs with oxlint). Issue #63 asks for Biome, which is the more
  mature formatter today. Formatting and linting have separate config, so
  choosing Biome does not limit the oxlint choice later.

### D2 — Style options match the measured codebase

`formatter.indentStyle: "space"` and `indentWidth: 2` override Biome's tab
default. Quote style (`double`) and semicolons (`always`) already match
Biome's defaults, but they are stated in `javascript.formatter` so the intent
is explicit. `lineWidth: 100` replaces the default 80: 8% of current lines
exceed 80 characters and 2.6% exceed 100, so 100 cuts first-touch rewrapping
roughly threefold. Trailing commas (`all`) and arrow parentheses (`always`)
keep Biome's defaults, which are Prettier-3-compatible and need no
configuration.

### D3 — Scope is an allowlist of extensions, not "everything minus excludes"

`files.includes` lists `**/*.{ts,tsx,js,mjs,cjs,json,jsonc,css}`, then negated
patterns for `src/generated` and `next-env.d.ts`. Use Biome 2's force-ignore
(`!!`) form for the generated directory so it is never indexed.
`vcs.enabled`, `clientKind: "git"`, `useIgnoreFile: true` and
`defaultBranch: "main"` make Biome honour `.gitignore` (`.next/`,
`node_modules/`, `logs/`, `.venv`, `test-results/`, `robot/results/`) and give
`--changed` its base.

Markdown and YAML are left out on purpose. Biome 2.6 can format both, but the
`lint:specs`, `lint:given` and `lint:robot-steps` gates parse OpenSpec
Markdown line by line, and `lint:dependabot` parses `dependabot.yml`. A
formatter rewrapping those files could break a gate, and the gain is small.

### D4 — Pre-commit: Biome runs first, on disjoint globs

```jsonc
"lint-staged": {
  "*.{ts,tsx}": [
    "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true",
    "eslint --max-warnings=0",
    "bash -c 'tsc --noEmit'"
  ],
  "*.{js,mjs,cjs,json,jsonc,css}": [
    "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true"
  ]
}
```

lint-staged runs the commands for one glob in order, and runs separate globs
in parallel. The two globs are disjoint, so no two tasks write the same file,
and ESLint sees formatted output. `--no-errors-on-unmatched` keeps a commit
that stages only ignored files (e.g. something under `src/generated/`) from
failing. lint-staged's default stash of unstaged hunks means only staged
content is formatted. Files that are not staged are never passed in.

There is deliberately no `pnpm format` script. `biome check --write` with no
paths would reformat the whole tree, which the user ruled out. A manual fix is
`pnpm exec biome check --write <path>`.

### D5 — `lint:format` checks only changed files; CI supplies the base

The script is
`"lint:format": "biome ci --changed --no-errors-on-unmatched"`. `biome ci`
never writes and fails on any formatting or assist diff. `--changed` limits
the check to files committed since `vcs.defaultBranch` (`main`). On `main`
itself, or on a branch with no in-scope changes, nothing is processed and
`--no-errors-on-unmatched` makes that a pass.

CI changes:

- `actions/checkout` gets `fetch-depth: 0`, so the base commit is present.
- A "Lint format" step runs after "Lint":
  `pnpm run lint:format --since="$BASE"`, with
  `BASE=${{ github.event.pull_request.base.sha || github.event.before }}`.
  The step falls back to `HEAD^` when `BASE` is empty, all zeros, or not in
  the clone (`git cat-file -e "$BASE^{commit}"` fails). That covers force
  pushes and first pushes.
- `biome.json` is added to both `paths` filters.

The project's flow is merge to `main` locally, then push `main`. So the push
event's `before..HEAD` covers exactly the merged branch's files, which is the
intended scope.

`lint:format` also joins the `run-p` group in `test:all`. Locally, `--changed`
only sees committed work. Uncommitted edits are covered by the pre-commit hook
instead.

### D6 — Exact pin, latest installable stable

Install with `pnpm add -D -E @biomejs/biome@<version>`, using the newest
stable 2.x the registry policy allows at implementation time (2.6.7 was
released on 2026-11-11). `$schema` in `biome.json` points at
`./node_modules/@biomejs/biome/configuration_schema.json`, so the schema
always matches the installed version. Biome ships platform binaries as
optional dependencies, so no `allowBuilds` entry should be needed. If pnpm
reports a blocked build script, stop and report it rather than allowlisting by
reflex. Dependabot keeps bumping Biome inside the existing `minor-and-patch`
group, as ADR 0004 intends. No ignore rule is added, so `lint:dependabot` is
unaffected.

### D7 — One config test guards the contract

`scripts/biome-config.test.ts` (Vitest, which already includes `scripts/**`)
calls `node_modules/.bin/biome` through `execFileSync`. It covers:

- **Style and imports:** `format --stdin-file-path=x.ts` on single-quoted,
  tab-indented input gives house style. `check --write --stdin-file-path` on
  unsorted imports sorts them. A house-style fixture comes back byte-identical.
- **No lint output:** `check` on a correctly formatted file with an unused
  variable exits 0.
- **Scope:** `check` on an OpenSpec `spec.md`, `.github/dependabot.yml` and a
  `src/generated/prisma` file processes zero files.
- **Wiring:** reads `package.json` for an exact pin, the `lint-staged` order,
  and `test:all` containing `lint:format`. Parses `ci.yml` with the existing
  `yaml` devDependency to find the `lint:format` step and
  `fetch-depth: 0`.

The two `--changed` scenarios need a scratch Git repo and stay at
`Tests: none`. They are verified by hand in tasks.

This test runs Biome as a child process instead of mocking. That matches the
project's preference for real collaborators over `vi.mock` (ADR 0001).

### D8 — Record the tool split in ADR 0006

`docs/adr/0006-biome-formatter-tool-split.md` records:

- Biome formats and the linter lints;
- why Markdown and YAML are excluded;
- staged-only adoption;
- the planned oxlint step, using `eslint-plugin-oxlint` to cut ESLint down to
  rules oxlint lacks (e.g. `react-hooks/set-state-in-effect`,
  `@next/next/no-img-element`) until ESLint can go.

`CLAUDE.md` (Stack, Key commands) and the `README.md` command table gain
`lint:format`, plus a line on the Biome editor plugin (the user's IDE is
WebStorm). The plugin setting itself lives in `.idea/`, which is gitignored.

## Risks / Trade-offs

- **[First touch of a file reformats all of it, adding noise to feature
  diffs]** → Matching style options and `lineWidth: 100` keep the change
  mostly to rewrapped long lines and reordered imports. The user accepted
  this over a single reformat commit.
- **[A Biome bump changes formatter output]** → The exact pin means output
  changes only on a deliberate bump. CI checks only changed files, so a bump
  flags at most the files in the same PR. Dependabot PRs change only
  `package.json` and the lockfile, and the lockfile is YAML and out of scope.
- **[Biome and ESLint disagree on style]** → `eslint-config-next` has no
  stylistic rules. Verify by running `pnpm lint` on Biome-formatted files
  during implementation.
- **[Import reordering changes side-effect order]** → Biome's
  `organizeImports` does not move imports across side-effect-only imports
  (`import "./globals.css"`). Check the CSS imports in `src/app/layout.tsx`
  after a test format.
- **[`--changed` misses uncommitted work in local `test:all`]** → The
  pre-commit hook formats staged files, so nothing unformatted can be
  committed through the hook. CI is the backstop for commits made with
  `--no-verify`.
- **[A protected file (Do Not Touch list) gets reformatted]** → This only
  happens inside a commit that already needs explicit approval to touch that
  file. Formatting does not change behaviour.

## Migration Plan

1. Install Biome and add `biome.json`, the scripts, the `lint-staged` entries,
   the CI step, the test and the docs, in one commit.
2. Don't reformat any existing file in this change. The only files Biome
   touches are the ones this change edits (`package.json`, the new test), and
   lint-staged formats them at commit.
3. Rollback: delete `biome.json` and the `lint:format` script and CI step,
   remove the `lint-staged` Biome entries, and uninstall the dependency. No
   data or runtime state is involved.

## Open Questions

- None blocking. A follow-up GitHub issue for oxlint adoption should be opened
  separately. This change does not create it.
