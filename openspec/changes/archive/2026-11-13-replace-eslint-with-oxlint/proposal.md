## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/61

## Why

The project lints with ESLint 9 through `eslint-config-next`. That preset pulls
in six plugins. Their `eslint` peer ranges hold ESLint at 9.x, which is a
standing exception to ADR 0004 (latest stable) plus a Dependabot ignore rule.
ADR 0006 already planned to move linting to oxlint, with a hybrid period in
which ESLint would keep the rules oxlint lacked:
`react-hooks/set-state-in-effect` and `@next/next/no-img-element`.

oxlint 1.93 now has both rules (`react/set-state-in-effect`,
`nextjs/no-img-element`). A trial run of a config that copies today's ESLint
rule set passed the whole repo clean in about 0.3 s. It honored the two
existing `eslint-disable` comments and exited 0 with `--max-warnings=0`, the
same as `eslint .` does today. Nothing is left for a hybrid period to cover, so
this change removes ESLint completely instead of running two linters.

## What Changes

- Add `oxlint` as a dev dependency and a root `.oxlintrc.json` that copies the
  rules `eslint-config-next` (`core-web-vitals` + `typescript`) enables today,
  with the same severities and options, including the two local overrides:
  - `no-unused-vars` ignores `_`-prefixed arguments;
  - `no-explicit-any` is off in `*.test.*` / `*.spec.*` files.

  oxlint's default rule categories are **off**, so this change adds no new
  rules. The user chose parity over oxlint's `correctness` category, which
  would flag 4 modal-backdrop elements in `SessionView.tsx`.
- `pnpm lint` runs `oxlint --max-warnings=0`. The `lint-staged` `*.{ts,tsx}`
  task runs oxlint after Biome, in place of ESLint. The CI "Lint" step and
  `test:all` keep calling `pnpm lint`.
- **BREAKING (dev tooling):** remove `eslint`, `eslint-config-next` and
  `eslint.config.mjs`. Contributors whose editor runs the ESLint plugin need
  the oxlint plugin instead.
- Change the two `eslint-disable` comments in `src/` to `oxlint-disable` with
  oxlint rule names. The generated Prisma client keeps its `/* eslint-disable */`
  header, because it is generated and out of lint scope.
- Remove the ADR 0004 `eslint` exception and the matching Dependabot `ignore`
  entry. Remove `unrs-resolver` from `pnpm-workspace.yaml` `allowBuilds`,
  because only the ESLint import resolver needed it.
- CI path filters: replace `eslint.config.mjs` with `.oxlintrc.json`.
- Add ADR 0007 (oxlint replaces ESLint, superseding ADR 0006's "Next step"
  section). Update `CLAUDE.md`, `README.md` and the ADR 0006 consequences that
  name ESLint.

## Capabilities

### New Capabilities
- `code-linting`: oxlint is the project's only linter. The spec covers the
  rule set it enforces (parity with the former Next.js ESLint preset), that
  any warning fails the lint, how suppression comments work, which files are
  in scope, and where the lint runs (pre-commit, CI, `test:all`).

### Modified Capabilities
- `code-formatting`: two requirements name ESLint. "Biome is the formatter and
  never lints" defers diagnostics to "ESLint today", and "Only files being
  committed are formatted" orders Biome before ESLint in `lint-staged`. Both
  now name oxlint.
- `dependency-maintenance`: the documented-exception scenario uses the
  `eslint` ignore rule as its example, and that rule is being removed, so the
  example changes to `next-auth`. The CI-trigger scenario names
  `eslint.config.mjs` as the lint config file, and that becomes
  `.oxlintrc.json`.

## Impact

- **New files:** `.oxlintrc.json`, `scripts/oxlint-config.test.ts`,
  `docs/adr/0007-oxlint-replaces-eslint.md`.
- **Deleted:** `eslint.config.mjs`.
- **Modified:** `package.json` (devDependencies, `lint` script,
  `lint-staged`), `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `.github/workflows/ci.yml` (path filters), `.github/dependabot.yml`,
  `docs/adr/0004-…`, `docs/adr/0006-…`, `scripts/biome-config.test.ts`
  (lint-staged ordering test and a comment), `scripts/lint-dependabot.test.ts`
  (fixture), `src/components/useCollabProvider.ts` and
  `src/app/auth/signin/SignInForm.tsx` (suppression comments only),
  `CLAUDE.md`, `README.md`.
- **Rule coverage gaps:** four rules that ESLint enables today have no oxlint
  equivalent. None of them matters to this codebase (design D3).
- **No runtime impact.** oxlint is dev-only. No protected area is touched:
  not `src/lib/gherkin.ts`, Y.js config, NextAuth, migrations or export logic.
