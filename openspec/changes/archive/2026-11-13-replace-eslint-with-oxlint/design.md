## Context

The project lints with ESLint 9 through `eslint-config-next` 16.4
(`core-web-vitals` + `typescript`), plus two local rules in
`eslint.config.mjs`. Lint runs in three places: `lint-staged` (`*.{ts,tsx}`,
`eslint --max-warnings=0`), the CI "Lint" step (`pnpm run lint`, i.e.
`eslint .`), and `test:all`. `eslint .` passes clean today.

ADR 0006 planned a hybrid move to oxlint, with `eslint-plugin-oxlint` turning
off the overlap, because oxlint lacked `react-hooks/set-state-in-effect` and
`@next/next/no-img-element`. Trial runs during planning (oxlint 1.93.0, the
latest release, published 2026-11-09) showed:

- Both rules now exist (`react/set-state-in-effect`, `nextjs/no-img-element`).
  oxlint also ships the React Compiler rules the preset enables
  (`static-components`, `purity`, `refs`, `immutability`, …).
- `eslint --print-config` gives 80 active rules for a `.tsx` file. 76 of them
  map to an oxlint rule. The typescript-eslint extension rules
  (`no-unused-vars`, `no-unused-expressions`, `no-array-constructor`) map to
  oxlint's TS-aware core rules.
- A config generated from that mapping, with oxlint's categories off, linted
  98 files in about 0.3 s with 0 diagnostics and exit 0 under
  `--max-warnings=0`.
- oxlint honors the two existing suppressions (`eslint-disable
  react-hooks/set-state-in-effect`, `eslint-disable-next-line
  @next/next/no-img-element`). With them removed, it reported both rules.
  `oxlint-disable-next-line nextjs/no-img-element` also works.
- Rule sets differ by file type only for `no-var`, `prefer-const`,
  `prefer-rest-params` and `prefer-spread`. typescript-eslint turns these on
  for TS files only. Test files differ only in `no-explicit-any` being off.
- `--format json` reports `number_of_files` and `diagnostics`, so tests can
  assert on results without parsing text output.

The user chose a full replacement (no hybrid) and a parity rule set (no
oxlint `correctness` category).

## Goals / Non-Goals

**Goals:**
- oxlint is the only linter. ESLint, its config, its preset and its ADR 0004
  exception are removed.
- The rules enforced are the same as before, so the switch needs no source
  changes beyond renaming two suppression comments.
- Lint runs in the same places (pre-commit, CI, `test:all`) with the same
  `--max-warnings=0` rule.

**Non-Goals:**
- Turning on oxlint's `correctness` or other categories, or type-aware
  linting (`--type-aware` / `oxlint-tsgolint`). The preset used no type-aware
  rules. A later change can add either deliberately.
- Fixing the 4 `jsx-a11y/no-static-element-interactions` findings that
  `correctness` would raise on the modal backdrops in `SessionView.tsx`.
- Running oxlint's JS-plugin bridge to load ESLint plugins.
- Linting Markdown, YAML or Robot files.

## Decisions

### D1. Full replacement, not the ADR 0006 hybrid
The hybrid existed only to cover two missing rules, and oxlint now has both.
Keeping ESLint would keep six plugins, their peer-range hold on ESLint 9 (the
ADR 0004 exception and the Dependabot ignore), and two suppression syntaxes.
Alternative considered: hybrid via `eslint-plugin-oxlint`. Rejected, because
no rule needs it.

### D2. The rule list is generated from ESLint once, then written as plain JSON
Before ESLint is removed, the implementer runs `eslint --print-config` on one
`.tsx`, one `.test.ts` and one `.mjs` file. They map each active rule to its
oxlint name:

- `@typescript-eslint/*` becomes `typescript/*`, except the extension rules,
  which become the core names;
- `@next/next/*` becomes `nextjs/*`;
- `react-hooks/*` becomes `react/*`;
- `jsx-a11y/*` and `import/*` keep their names.

Severities and options are copied as they are, for example `no-unused-vars`
`["error", { "argsIgnorePattern": "^_" }]` and `react/exhaustive-deps` `warn`.
The result is checked into `.oxlintrc.json` as an explicit rule list with
`categories` all `off`. Plugins: `typescript`, `react`, `nextjs`, `jsx-a11y`,
`import`. Overrides:

- `*.test.{ts,tsx}` and `*.spec.{ts,tsx}`: `typescript/no-explicit-any` off;
- `*.{ts,tsx,mts,cts}`: `no-var`, `prefer-const`, `prefer-rest-params`,
  `prefer-spread` on, which keeps JS files at their current rule set.

`$schema` points at `./node_modules/oxlint/configuration_schema.json`.
Alternative considered: `@oxlint/migrate`, which reads `eslint.config.mjs`.
It works too. The implementer may use it, but the output must still match the
print-config mapping above and keep categories off. Alternative considered:
oxlint defaults plus a few rules. Rejected, because the user chose parity.

### D3. Accepted coverage gaps
These preset rules have no oxlint equivalent and are dropped:

- `@next/next/no-location-assign-relative-destination`: the code never calls
  `location.assign`/`replace` or sets `location.href`.
- `react/no-deprecated`: React 19 has removed those legacy APIs, and `tsc`
  rejects them.
- `react-hooks/config`, `react-hooks/gating`: these validate React Compiler
  options. The project does not configure the compiler.

`react/jsx-uses-react` and `react/jsx-uses-vars` are not needed, because
oxlint's `no-unused-vars` already counts JSX usage. ADR 0007 records this list.

### D4. Exact version pin
`oxlint` is installed with `pnpm add -D -E`. With every warning failing the
lint, a release that changes what a rule reports could fail CI. An exact pin
makes that happen only in the Dependabot PR that bumps it, which is where it
should be reviewed. This matches the Biome pin (ADR 0006). If the npm
`min-release-age` policy blocks the newest version, use the newest one the
registry allows.

### D5. Lint scope via `ignorePatterns` plus `.gitignore`
oxlint respects `.gitignore` by default. `ignorePatterns` adds the tracked
generated paths (`src/generated/**`, `next-env.d.ts`). It also lists the
gitignored tool output directories ESLint listed (`test-results/**`,
`playwright-report/**`, `.venv/**`, `robot/results/**`), which guards against
the `run-p` race with Playwright that the ESLint comment described. When a
generated file is passed by explicit path, oxlint still lints it (seen in the
trial run). That is acceptable, because the generated files keep their
`/* eslint-disable */` header, which oxlint honors.

### D6. Suppression comments use oxlint names
`useCollabProvider.ts` changes to `oxlint-disable react/set-state-in-effect`
/ `oxlint-enable …`, and `SignInForm.tsx` changes to
`oxlint-disable-next-line nextjs/no-img-element`. Each keeps its reason. oxlint
would honor the old comments, but ESLint rule names in a repo with no ESLint
mislead readers. Generated Prisma files are not edited.

### D7. Wiring
- `"lint": "oxlint --max-warnings=0"`. oxlint lints `.` by default.
- In `lint-staged` `*.{ts,tsx}`, `oxlint --max-warnings=0` replaces
  `eslint --max-warnings=0` in the same position (after Biome, before `tsc`).
- CI keeps the `pnpm run lint` step. The path filters swap
  `eslint.config.mjs` for `.oxlintrc.json`.
- `test:all` is unchanged, because it already runs `lint`.
- `pnpm-workspace.yaml`: drop `unrs-resolver` from `allowBuilds`, because
  `pnpm why` shows only `eslint-import-resolver-typescript` uses it. oxlint
  ships prebuilt platform bindings as optional dependencies and needs no build
  script.

### D8. Config test runs the real binary on temp fixtures
`scripts/oxlint-config.test.ts` follows the `biome-config.test.ts` pattern:
`execFileSync` on `node_modules/.bin/oxlint` with no shell and no `vi.mock`
(ADR 0001). For each case it creates a temp directory outside the repo and
copies `.oxlintrc.json` into it, so that override globs resolve against the
fixture directory. It writes the fixture files and runs
`oxlint -c .oxlintrc.json --format json --max-warnings=0` there, then asserts
on the diagnostics' rule codes and the exit status. A temp dir outside the
repo also keeps the fixtures out of a parallel `pnpm lint` under `test:all`.
Static cases (no ESLint left, exact pin, wiring) read `package.json` and
`ci.yml`, parsing the latter with `yaml`. The "no `eslint-disable` in project
source" case runs `git ls-files` and searches the files. It skips
`src/generated/` and builds the search string from parts, so the test file
does not match itself.

### D9. Documentation
- New `docs/adr/0007-oxlint-replaces-eslint.md`: decision, parity rule set,
  categories off, the D3 gaps, exact pin. It supersedes ADR 0006's
  "Next step: oxlint" section.
- In ADR 0006, add a one-line pointer to 0007 in that section, and change the
  consequence that says "ESLint's configuration and its ADR 0004 exception are
  unchanged" so it points to 0007.
- ADR 0004: delete the `eslint` exception section.
- `.github/dependabot.yml`: delete the `eslint` ignore entry.
- `scripts/lint-dependabot.test.ts`: change the fixtures (`validConfig`, the
  fixture ADR, and the "accepts ignore entries cited in the ADR" case) from
  `eslint` to `next-auth`. Keep the `eslint-config-next` substring edge-case
  test, because it tests the gate's name matching with its own fixture.
- `CLAUDE.md` (stack line, `pnpm lint` description) and `README.md` (tooling
  paragraph, editor plugin note).

## Risks / Trade-offs

- [Rule-equivalence drift: an oxlint port may report a slightly different set
  of cases than the ESLint rule] → Parity is checked on today's code (0
  diagnostics both ways). Future differences show up as new findings in the
  PR that causes them.
- [An oxlint bump changes diagnostics] → Exact pin (D4). Dependabot PRs run
  the full CI.
- [Contributors' editors still run the ESLint extension] → README names the
  oxlint editor extension. With no config file, the ESLint extension reports
  nothing.
- [Losing the four D3 rules] → Each is inert for this codebase. ADR 0007
  lists them so a later oxlint release can add them back.
- [`@oxlint/migrate` or a hand mapping misses a rule] → Tasks require diffing
  the print-config rule list against `.oxlintrc.json` before ESLint is
  uninstalled.

## Migration Plan

All in one PR. Generate the mapping while ESLint is still installed, add
oxlint and its config, and confirm `pnpm lint` (oxlint) and `eslint .` both
pass. Then remove ESLint. Rollback is `git revert`, because nothing outside dev
tooling changes.

## Open Questions

None.
