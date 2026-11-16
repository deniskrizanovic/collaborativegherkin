## Context

Every `lint:*` gate in this repo is a single Node script under `scripts/`. It
exports pure functions that its sibling `*.test.ts` drives, and it has a
`process.argv[1] === fileURLToPath(import.meta.url)` main guard (see
`scripts/lint-robot-no-sleep.mjs`). `test:all` runs the gates in parallel
through `run-p`, and CI runs each one as its own step in
`.github/workflows/ci.yml`.

Facts measured on 2026-11-16:

- No coverage provider is installed. `vitest` is 5.1.0, and
  `vitest.config.ts` has no `coverage` block.
- oxlint 1.93 has no rule that reports per-function complexity values.
  ESLint has been removed (`code-linting` spec), so its `complexity` rule is
  not available either.
- `typescript` 6 is already a dev dependency.
- A throwaway scan with the TypeScript compiler API, using the counting rules
  in the spec, found 225 functions under `src/`. The maximum complexity is 14
  (`SessionView.tsx:14`). 14 functions have complexity 6 or more. None is
  above 30.
- `src/` has 11 unit test files. `SessionView.tsx`, `GherkinEditor.tsx`,
  `SignInForm.tsx` and `HomeClient.tsx` have none. They are exercised only by
  the Robot e2e suite.

## Goals / Non-Goals

**Goals:**

- A deterministic, offline `pnpm lint:crap` that scores every function under
  `src/` and fails if any score is above 30.
- Complexity and coverage measured on the same TypeScript source, so the join
  between them is exact.
- The gate passes on the codebase at the end of this change, with every
  function scored and nothing exempted.

**Non-Goals:**

- Scoring `scripts/`, `prisma/`, `server.js`, `e2e/` or `robot/`.
- Counting coverage from e2e runs.
- Mutation testing or any other check on test quality.
- Any allowlist, baseline or suppression comment.
- Running the gate in the husky pre-commit hook.

## Decisions

### D1. Measure complexity with the TypeScript compiler API

`scripts/lint-crap.mjs` parses each source file with
`ts.createSourceFile` (TSX script kind for `.tsx`). It visits every
function-like node and counts the decision points the spec lists, without
descending into nested functions. For each function it records the name,
the start and end positions, and the complexity.

- The name comes from the declaration, the method or property key, or the
  variable it is assigned to (`const onKey = () => …`). Otherwise it is
  `<anonymous>`.
- Optional chaining (`?.`) and default parameters are not counted. The spec's
  list is the full definition.

*Alternatives:* oxlint has no per-function output (see Context). Packages like
`escomplex` or `typhonjs-escomplex` are unmaintained and lag behind TS syntax.
The compiler API is already installed, handles TSX exactly, and matches the
scan that produced the baseline.

### D2. Get coverage from `@vitest/coverage-istanbul`, configured on the command line

The gate runs Vitest itself:

```
vitest run --coverage.enabled --coverage.provider=istanbul \
  --coverage.reporter=json --coverage.reportsDirectory=coverage/crap \
  --coverage.include='src/**/*.{ts,tsx}' --coverage.exclude=…
```

It then reads `coverage/crap/coverage-final.json`. Coverage settings live in
these flags, not in `vitest.config.ts`, so `pnpm test` and the CI unit-test
step behave exactly as they do today. `coverage.include` makes files that no
test loads appear with zero hits, which the spec requires. The dependency is
pinned to exactly `5.1.0` to match Vitest, which requires provider and runner
versions to match.

*Why istanbul over v8:* istanbul instruments the AST. Its branch types (`if`,
`cond-expr`, `binary-expr` for `&&`/`||`/`??`, `switch`) line up with the
decision points D1 counts. v8 block coverage reports executed byte ranges,
and v8-to-istanbul turns those into branches that do not always match source
constructs. That would make "half of its branches" fuzzy. Instrumentation is
slower, but the suite has 11 files.

*Why the gate runs Vitest itself instead of reusing the CI unit-test run:*
this keeps the gate runnable on its own with `pnpm lint:crap` and keeps CI
steps independent. The cost is one extra unit-suite run.

### D3. Join coverage to functions by source span

For each function from D1:

- `cov` is the number of executed branch arms inside its span divided by the
  total arms inside it. Arms inside a nested function's span are left out.
- If the function has no branch arms, `cov` is the same ratio over
  statements.
- If the file is missing from the coverage map, `cov` is 0.

Each istanbul arm location is assigned to the innermost D1 function whose
span contains it. Istanbul and the TypeScript parser both work on the
original source because of source maps, so the line and column positions
line up.

The scoring core is `scoreFunctions(sources, coverageMap)`. It takes plain
data, with no Vitest and no filesystem access. `scripts/lint-crap.test.ts`
drives it with inline source strings and hand-built coverage maps, which
covers every spec scenario without spawning Vitest. This follows the
project's preference for explicit inputs over `vi.mock`.

### D4. Report and exit codes

- **Exit 0:** prints `✓ crap: N function(s) scored, worst <score> (<name>
  <file>:<line>)`, matching the other gates' summary style.
- **Exit 1:** prints one row per offender, worst first: score, complexity,
  coverage %, name, `file:line`.
- **Exit 2:** the Vitest run failed or no coverage file was produced. The
  gate stops loudly instead of scoring stale or missing data. A failing unit
  test is already reported by the unit-test step. Exit 2 just keeps the gate
  from passing silently on no data.

The threshold is a constant, `CRAP_THRESHOLD = 30`, and the comparison is
`score > 30`.

### D5. Wiring

- `package.json`: add `"lint:crap": "node scripts/lint-crap.mjs"` and put
  `lint:crap` in the `run-p` list of `test:all`.
- `ci.yml`: add a "Lint CRAP score" step right after "Unit tests".
- `.gitignore`: add `coverage/`.
- `CLAUDE.md` key commands: add `pnpm lint:crap`.
- Not added to `.husky/pre-commit`, which holds only fast filesystem checks.

### D6. Fixing the baseline: tests first, refactor where it isn't protected

1. Implement the gate.
2. Run it and record the real offender list in `tasks.md`.
3. Fix each offender:

- **Default fix:** unit tests for the offending function. Logic-heavy
  components (`SessionView.tsx`, `SignInForm.tsx`) get jsdom tests. jsdom is
  already a dev dependency. Server routes get tests through their existing
  route test files.
- **When tests would only exercise React rendering plumbing:** extract the
  decision logic into a plain function under `src/lib/` and test that
  directly. Extraction lowers the component's complexity and makes the logic
  easy to test.
- **Do Not Touch:** functions in `src/lib/gherkin.ts`, or in the Tiptap +
  Y.js setup in `GherkinEditor.tsx`, get tests only. If tests cannot reach
  the threshold, implementation stops and asks for permission before any
  refactor.

## Risks / Trade-offs

- **Code covered only by e2e tests needs unit tests just to pass the gate.**
  Some components are well exercised by Robot and still score as uncovered.
  Mitigation: this is a deliberate effect of the metric, and the user chose a
  hard gate. Extracting logic from components (D6) keeps the new tests about
  behavior rather than DOM plumbing.
- **Tests can be written to raise coverage without asserting anything.**
  Mitigation: code review. Mutation testing is out of scope.
- **`test:all` runs `lint:crap` and `test -- --run` in parallel, so two
  Vitest processes run at once.** Mitigation: unit tests use mocks or temp
  files and share no port or database. If they collide, run `lint:crap` in
  the serial part of `test:all` instead.
- **Istanbul and the D1 counter disagree on some constructs.** For example,
  istanbul treats default parameters as branches while D1 doesn't count them.
  Mitigation: coverage is a ratio over whatever arms istanbul reports inside
  the function, so a mismatch only shifts the ratio slightly. It never
  changes the complexity.
- **CI gets slower** by one instrumented unit-suite run. That is acceptable at
  the current suite size.

## Migration Plan

This is additive. The gate is wired into `test:all` and CI in the same change
that brings the offenders under 30, so `main` never has a failing gate. To
roll back, revert the change.

## Open Questions

- Can `GherkinEditor.tsx`'s complexity-10 and complexity-7 functions reach
  the threshold through unit tests without mocking Tiptap heavily? If not,
  the user decides whether a small extraction counts as touching the
  protected collaboration config. This is settled during D6.
