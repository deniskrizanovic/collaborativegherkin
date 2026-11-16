## Context

Three tooling gaps from the #68 retro (see proposal). Each touches a
different gate, but all three are small and land together.

- **Formatting.** `lint:format` is `biome ci --changed --no-errors-on-unmatched`.
  CI passes `--since="$BASE"` and checks out with `fetch-depth: 0` so the base
  exists. `scripts/biome-config.test.ts` asserts the script matches
  `/^biome ci --changed/`. ADR 0006 records the staged-only choice. A
  whole-tree `biome check --write .` on 2026-11-16 rewrote 72 tracked files, plus
  `.claude/settings.local.json`, which only the user's global Git excludes
  file ignores. Biome reads the repo's `.gitignore`, not global excludes.
- **CRAP gate.** `scripts/lint-crap.mjs` has no argument parsing. `main()`
  runs coverage, scores, and calls `buildReport(scored, cwd)`, which returns
  `{ exitCode, output }`. Exit 2 already means "nothing was scored" (coverage
  run failed).
- **Console.** `.oxlintrc.json` turns every default category off and lists
  rules explicitly. `scripts/oxlint-config.test.ts` lints fixtures in a temp
  dir with a copy of the config, so override globs resolve against the
  fixture. The only `console.*` call in `src/` is the logger's startup
  fallback in `src/lib/logger.ts`, which gets a disable comment. `server.js` patches
  `console.error` on purpose and `prisma/seed.ts` uses `console.log`; both
  sit outside `src/`.

## Goals / Non-Goals

**Goals:**
- The tree is in house style after one commit, and stays there.
- `lint:crap` answers "what does this function score?" without scratch code.
- The Pino-not-console rule is checked by the linter in `src/`.

**Non-Goals:**
- No change to Biome's style options or scope.
- No change to the CRAP formula, threshold or scope.
- No `no-console` outside `src/`. Scripts are CLIs and print to the terminal
  by design.

## Decisions

### Reformat in its own commit, then point blame past it

`pnpm format` (`biome check --write .`) runs once, and its output is
committed alone, with no other change in that commit. A follow-up commit adds
`.git-blame-ignore-revs` holding that commit's SHA, so `git blame` and
GitHub's blame view skip it. Alternative: reformat inside the feature commit.
Rejected, because it buries 72 files of layout change in the diff that
reviewers need to read.

`biome check --write` (not `biome format --write`) so import sorting is
applied too, matching what `lint:format` (`biome ci`) checks.

### Add `.claude/settings.local.json` to `.gitignore`

A whole-tree check run locally would otherwise fail on this per-user file,
while CI (which never has it) passes. Ignoring it in the repo's `.gitignore`
makes both agree. Alternative: exclude `.claude/**` in `biome.json`. Rejected,
since the committed `.claude/settings.json` should stay in scope.

### `lint:format` becomes `biome ci .`

`--changed` and `--no-errors-on-unmatched` go. CI's Lint format step drops the
`BASE` computation and runs `pnpm run lint:format` plain. `fetch-depth: 0`
goes too: its comment ties it to `lint:format` only, and no other step reads
Git history. The hook (`lint-staged`) is unchanged.

### CRAP options filter `buildReport`'s input

`main()` parses `process.argv.slice(2)` into `{ all, file }` with a small
`parseArgs` function, exported for unit tests. Node's `util.parseArgs` with
`strict: true` does the parsing and rejects unknown options. `--file` filters
the scored list by `relative(cwd, fn.file)` equal to the path or starting with
`path + "/"` (after trimming a trailing `/`), before `buildReport`. An empty
result is the exit-2 error. `buildReport` gains an `{ all }` option: when set,
the table lists every function and the heading reads `✓`/`✗` with the count
scored. Coverage still runs the whole unit suite, because a file's coverage
can come from any test.

Alternative: a separate `lint:crap:report` script. Rejected, since one
entry point keeps the report code in one place.

### `no-console` as an override, not a top-level rule

Two overrides in `.oxlintrc.json`: `files: ["src/**"]` turns `no-console` on
as an error; a later `files: ["src/**/*.{test,spec}.{ts,tsx}"]` turns it off.
oxlint applies overrides in order, so the later one wins for tests. A
top-level rule would hit `scripts/`, `server.js` and `prisma/seed.ts`.

### ADR 0008 supersedes ADR 0006's adoption section

New `docs/adr/0008-whole-tree-formatting.md` records the reversal and why.
ADR 0006 keeps its text, with a "Superseded by ADR 0008" note on its
"Adoption is staged-only" section, matching how its oxlint section points at
ADR 0007.

## Risks / Trade-offs

- **[A Biome bump changes formatter output and fails `lint:format` on the
  Dependabot PR]** → Run `pnpm format` on that PR branch and push. ADR 0008
  says so. Biome is pinned exactly, so this only happens on a deliberate bump.
- **[The reformat touches `src/proxy.ts`, the auth gate]** → Layout only;
  `typecheck`, the unit suite and Robot e2e (`test:all`) run after the
  reformat. Four files on or under the Do Not Touch list (`src/lib/gherkin.ts`,
  `src/auth.ts`, `src/components/GherkinEditor.tsx`, `server.js`) are in the
  set; the user approved their layout-only change.
- **[Branches open during the reformat conflict on layout]** → Few branches
  exist (single maintainer). After rebasing, `pnpm format` resolves the
  layout side.
- **[`no-console` blocks a legitimate browser-side `console.error`]** → Write
  an `oxlint-disable-next-line no-console` comment with the reason, as the
  code-linting spec already requires for exceptions.

## Migration Plan

1. Land the config, script and test changes.
2. Run `pnpm format`; commit the result alone.
3. Add `.git-blame-ignore-revs` with that SHA.
4. Rollback: revert the three commits. Nothing else depends on them.

## Open Questions

None.
