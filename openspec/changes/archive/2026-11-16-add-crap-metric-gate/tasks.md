## 1. Setup

- [x] 1.1 Confirm the branch is `collaborativegherkin-68`, not `main`.
- [x] 1.2 Run `pnpm add -D -E @vitest/coverage-istanbul@5.1.0`, matching the installed `vitest` (design D2). Confirm `package.json` has no `^`/`~` on it. If pnpm reports a blocked build script, stop and report it. Do not add an `allowBuilds` entry unasked.
- [x] 1.3 Add `coverage/` to `.gitignore`.

## 2. Scoring core (test first)

- [x] 2.1 Create `scripts/lint-crap.test.ts`. Write one case for each scenario in `specs/crap-metric/spec.md` that the scoring core can show. Use inline source strings and hand-built istanbul coverage maps, with no `vi.mock` and no Vitest subprocess (design D3). Cover:
  - complexity 6, 0% coverage, scores 42;
  - complexity 12, full coverage, scores 12;
  - complexity 10, half the branches covered, scores 22.5;
  - `if` + `&&` + two `case` clauses + `default` gives complexity 5;
  - nested arrow callback measured separately (outer 1, inner 3);
  - file missing from the coverage map gives 0% coverage;
  - test, `*.d.ts` and `src/generated/` files excluded, and `scripts/` not scored;
  - one offender exits non-zero and its report row has file, line, name, complexity, coverage and score;
  - score of exactly 30 passes;
  - a skip-me comment above an offender has no effect.

  Confirm the cases fail before section 3.
- [x] 2.2 Create `scripts/lint-crap.mjs` with the header comment and exported-pure-functions + main-guard layout of the sibling gates (design Context). Export:
  - `collectSourceFiles(root)` (scope per spec);
  - `measureFunctions(content, file)` (design D1: name, span, complexity);
  - `scoreFunctions(sources, coverageMap)` (design D3 join and the CRAP formula);
  - `CRAP_THRESHOLD = 30`.
- [x] 2.3 Run `pnpm test -- --run scripts/lint-crap.test.ts` and confirm every case from 2.1 passes.

## 3. Gate runner

- [x] 3.1 In the main guard of `lint-crap.mjs`, run Vitest through `execFileSync` on `node_modules/.bin/vitest` with no shell. Pass the coverage flags from design D2, with `reportsDirectory=coverage/crap` and `include`/`exclude` matching the spec scope. Then read `coverage/crap/coverage-final.json`.
- [x] 3.2 Implement the design D4 report and exit codes:
  - exit 0 prints the `✓ crap:` summary;
  - exit 1 prints the offender rows, worst first;
  - exit 2 when the Vitest run fails or the coverage file is missing.
- [x] 3.3 Add `"lint:crap": "node scripts/lint-crap.mjs"` to `package.json`. Do not add it to `test:all` yet (that waits for section 5).
- [x] 3.4 Cross-check one function's numbers by hand. Run `pnpm lint:crap` and pick one reported function. Confirm its complexity against the throwaway baseline (`SessionView.tsx:14` → 14) and its coverage against istanbul's HTML or JSON for that file.

## 4. Bring the baseline under 30

- [x] 4.1 Run `pnpm lint:crap` and paste the offender list (score, complexity, coverage, name, `file:line`) into this task as a sub-list.
  - 210.0, 14, 0%, `SessionView`, `src/app/sessions/[id]/SessionView.tsx:14`
  - 156.0, 12, 0%, `<anonymous>`, `src/components/useGherkinKeyboard.ts:248`
  - 156.0, 12, 0%, `<anonymous>`, `src/components/useGherkinKeyboard.ts:312`
  - 110.0, 10, 0%, `GherkinEditor`, `src/components/GherkinEditor.tsx:38`
  - 56.0, 7, 0%, `handleImportConfirm`, `src/components/GherkinEditor.tsx:140`
  - 56.0, 7, 0%, `handler`, `src/components/useGherkinKeyboard.ts:363`
  - 56.0, 7, 0%, `parseGherkin`, `src/lib/gherkin.ts:99`
  - 42.0, 6, 0%, `<anonymous>`, `src/app/sessions/[id]/SessionView.tsx:43`
  - 42.0, 6, 0%, `handleReview`, `src/app/sessions/[id]/SessionView.tsx:101`
- [x] 4.2 For each offender, apply the design D6 fix order: unit tests first; extract logic to `src/lib/` only for unprotected files. Prefer explicit injection over `vi.mock` in new tests. Add one sub-task per offender as you go.
  - [x] `SessionView` (`SessionView.tsx:14`): jsdom tests in `src/app/sessions/[id]/SessionView.test.tsx` (stubbed `fetch` and a silent `WebSocket` global; no `vi.mock`). Now 14.0 (100%).
  - [x] `<anonymous>` settings load (`SessionView.tsx:43`): same file, load success, defaults, error status, network failure. Now 6.3 (80%).
  - [x] `handleReview` (`SessionView.tsx:101`): same file, result, error, empty reply, unreachable service. Now 6.1 (86%).
  - [x] `<anonymous>` `insertBlock` (`useGherkinKeyboard.ts:248`): jsdom tests in `src/components/GherkinEditor.test.tsx` through the real editor (toolbar, picker, table, image). Now 15.6 (71%).
  - [x] `<anonymous>` `handleKeyDown` (`useGherkinKeyboard.ts:312`): same file, Enter, "/", other keys. Now 16.6 (68%).
  - [x] `handler` picker keys (`useGherkinKeyboard.ts:363`): same file, ArrowDown/ArrowUp/Enter/Escape. Now 7.2 (83%).
  - [x] `GherkinEditor` (`GherkinEditor.tsx:38`): same file, connection banner, seeding on sync, toolbar, import dialog. Now 10.0 (94%).
  - [x] `handleImportConfirm` (`GherkinEditor.tsx:140`): same file, keyword lines + table, no-Gherkin text, cancel. Now 8.3 (70%).
  - [x] `parseGherkin` (`gherkin.ts:99`): tests added to `src/lib/gherkin.test.ts`. Now 7.0 (100%).
- [x] 4.3 Offenders in `src/lib/gherkin.ts` or in the Tiptap + Y.js setup of `GherkinEditor.tsx` get tests only. If tests cannot reach the threshold, stop and ask the user before any refactor (design Open Questions). Tests alone reached the threshold; neither file was edited. The editor test renders the real Tiptap + Y.js editor in jsdom, with a fake `WebSocket` global playing the sync server.
- [x] 4.4 Re-run `pnpm lint:crap` until it exits 0. `✓ crap: 217 function(s) scored, worst 30.0 (HomeClient src/app/HomeClient.tsx:18)`.

## 5. Wiring

- [x] 5.1 Add `lint:crap` to the `run-p` list in `test:all`.
- [x] 5.2 Add a "Lint CRAP score" step running `pnpm run lint:crap` to `.github/workflows/ci.yml`, right after "Unit tests".
- [x] 5.3 Add `pnpm lint:crap` to the Key commands block in `CLAUDE.md`, with a one-line description.
- [x] 5.4 Confirm `.husky/pre-commit` is unchanged (spec: not in pre-commit).

## 6. Spec traceability and verification

- [x] 6.1 Replace `> **Tests:** none` in `specs/crap-metric/spec.md` with citations of the `scripts/lint-crap.test.ts` cases from 2.1. Keep `none` only where no automated test exists: test:all wiring, CI step, and the current codebase passing.
- [x] 6.2 Run `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint`, `pnpm typecheck` and `pnpm lint:format`. Confirm each exits 0.
- [x] 6.3 Run `pnpm test:all` and confirm it passes with `lint:crap` in the run. If `lint:crap` and `test -- --run` collide when run in parallel, move `lint:crap` to the serial part (design Risks).
- [x] 6.4 Make a scratch edit that adds an untested complexity-6 function under `src/`. Confirm `pnpm lint:crap` exits 1 and names it. Then revert the edit.
