## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/68

## Why

Nothing in the build relates how complex a function is to how well it is
tested. Complex code with no tests is where edits break things, and today it
passes every gate. The CRAP metric (Change Risk Anti-Patterns, from Alberto
Savoia and Bob Evans' Crap4j) scores each function as
`comp² × (1 − cov)³ + comp`. Here `comp` is cyclomatic complexity and `cov` is
test coverage as a fraction from 0 to 1. A score above 30 marks a function as
risky to change. The score can drop in two ways: add tests or simplify the
code.

A complexity-only scan of `src/` on 2026-11-16 found 225 functions. None has
complexity above 30, so every function can pass with enough tests. 14 have
complexity 6 or more, so they fail if they have no coverage. The worst is
`SessionView.tsx` at 14, which needs about 60% coverage. Several of them,
including `SessionView.tsx` and `GherkinEditor.tsx`, have no unit tests at
all. The codebase is still small, so this is the cheapest time to set a
ceiling.

## What Changes

- Add a `pnpm lint:crap` gate. It runs the Vitest unit suite with coverage,
  computes cyclomatic complexity for every function under `src/`, combines
  the two into a CRAP score per function, and exits non-zero if any function
  scores above **30**. When it fails, it lists each offender with its
  location, complexity, coverage and score.
- Scope is `src/**/*.{ts,tsx}`. Test files (`*.test.*`, `*.spec.*`), type
  declarations (`*.d.ts`) and generated code (`src/generated/`) are excluded.
- Coverage comes from Vitest unit tests only. Robot and Playwright e2e runs
  are not instrumented. A function exercised only by e2e tests counts as
  uncovered.
- Wire the gate into `test:all` and into CI (`.github/workflows/ci.yml`) as
  its own step, alongside the other `lint:*` gates. It is not added to the
  husky pre-commit hook, because it runs the whole unit suite under coverage.
- Add `@vitest/coverage-istanbul` as a dev dependency, pinned to the
  installed Vitest version.
- Bring the existing offenders under the threshold before the gate is
  switched on, mainly by adding unit tests. This change has no allowlist,
  baseline file or suppression comment. Every function must pass.

## Capabilities

### New Capabilities

- `crap-metric`: the CRAP score definition, what code it covers, the
  threshold of 30, the failure report, and where the gate runs (`test:all`
  and CI).

### Modified Capabilities

None. The gate sits alongside `code-linting` and does not change oxlint's
requirements.

## Impact

- **New files:** `scripts/lint-crap.mjs` (gate) and
  `scripts/lint-crap.test.ts` (unit tests for the complexity counter, the
  coverage join and the scoring).
- **Changed:** `package.json` (`lint:crap` script, entry in `test:all`, new
  dev dependency), `pnpm-lock.yaml`, `.github/workflows/ci.yml` (new step),
  `.gitignore` (coverage output directory), and `CLAUDE.md` (key commands).
- **New unit tests** for whichever `src/` functions score above 30 at
  baseline. The likely candidates are `SessionView.tsx`, `GherkinEditor.tsx`
  and `SignInForm.tsx`. The final list is measured during implementation.
- **Do Not Touch:** `src/lib/gherkin.ts` and the Tiptap + Y.js setup in
  `GherkinEditor.tsx` are protected. Offenders there are fixed with tests
  only. Any refactor of those files needs explicit permission first.
- **CI time:** one extra unit-suite run with coverage.
