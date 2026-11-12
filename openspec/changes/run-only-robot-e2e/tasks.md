## 1. Robot parser: expose tags

- [x] 1.1 In `scripts/lint-robot-spec-steps.test.ts`, add failing cases for a new `tags` field on each test from `parseRobotSuite`. Cover:
  - `[Tags]` with several tags;
  - `[Tags]` continued on a `...` line;
  - suite-level `Test Tags`, `Force Tags` and `Default Tags` merged in;
  - a test with no tags, which gives `[]`.
- [x] 1.2 In `scripts/lint-robot-spec-steps.mjs`, extend `parseRobotSuite` to collect `tags`. The change is additive: the `bdd`, `steps` and `other` fields are unchanged (design D4). Confirm the whole `lint-robot-spec-steps.test.ts` file passes and `pnpm lint:robot-steps` is still green.

## 2. Parity gate (write the tests first, expect them to fail)

- [x] 2.1 Create `scripts/lint-e2e-parity.test.ts` with cases against pure functions. Build inputs as in-memory strings and arrays, with no `vi.mock` and no subprocess. Cover:
  - `parsePlaywrightList`: reads `{file, title, skipped}` from a `--list --reporter=json` fixture with a nested `describe` and a `test.skip`; throws when the JSON has no tests or lacks the expected fields.
  - `parseParityTable`: keeps only rows whose first cell ends in `.spec.ts`; splits on unescaped `|` so a `\|` in the assertions cell stays inside it; reads file, title, suite and status by position; throws on a header that doesn't match.
  - `lintParity`, which fails, naming the spec file and title, for each of these:
    - a listed test with no row;
    - a row with no listed test;
    - a `pending` status;
    - an unknown status;
    - a suite file that doesn't exist;
    - a suite with no test of exactly the title;
    - a title that differs only in case or dash;
    - two titles generated in a loop where only one has a row;
    - a duplicated (file, title) pair;
    - each way the Playwright skip, the row's `skip` status and the Robot `skip` tag can disagree.
  - `lintParity` returns no errors for a consistent fixture, including one `skip` row.
- [x] 2.2 Run the tests and confirm they fail because the module doesn't exist yet.
- [x] 2.3 Create `scripts/lint-e2e-parity.mjs`, following the style of the other `scripts/lint-*.mjs` files: header comment, JSDoc, exported pure functions, and a `main()` guarded by `import.meta.url`. `main()` does three things (design D1–D3, D5):
  - runs `node_modules/.bin/playwright test --list --reporter=json` without a shell;
  - reads `robot/PARITY.md` and the suites under `robot/suites/`, using `parseRobotSuite` from section 1;
  - prints `<spec file> › <title>: <problem>` per mismatch and exits 1, or prints a `✓` summary with counts and exits 0.
- [x] 2.4 Re-run 2.1 and confirm it passes.
- [x] 2.5 Add `"lint:e2e-parity": "node scripts/lint-e2e-parity.mjs"` to `package.json`. Run `pnpm lint:e2e-parity` against the current tree and confirm it exits 0 with 123 tests and 1 skip (spec: "The parity checklist is complete at the end").
- [x] 2.6 Prove the gate fails on real drift, then revert each change. Do not commit any of these:
  - rename one Playwright title, and confirm it reports a missing row and a stale row;
  - change one Robot test name, and confirm it reports the missing Robot test;
  - set one row to `pending`, and confirm it reports the row.

## 3. Wire the gate in

- [x] 3.1 Add `pnpm run lint:e2e-parity` to `.husky/pre-commit` after `lint:robot-steps`, with a short comment like the other gates' comments: offline, whole tree, sibling of `lint:robot-steps`.
- [x] 3.2 Add `lint:e2e-parity` to the `run-p` list in the `test:all` script.
- [x] 3.3 Add a "Lint e2e parity" step to `.github/workflows/ci.yml` after "Lint robot (spec steps)". It must come after `pnpm install`, because it needs `node_modules/.bin/playwright`.

## 4. Run only Robot on every change

- [x] 4.1 In `package.json`, change `e2e:all` to `run-s test:robot` (design D6). Keep `test:e2e` unchanged.
- [x] 4.2 In `.github/workflows/ci.yml`, delete the "E2e tests" step and the "Upload Playwright results" step. Keep these unchanged: `PLAYWRIGHT_BROWSERS_PATH`, the browser cache, "Install Playwright browsers", "Install Robot toolchain", "Robot e2e tests", "Upload Robot report", and the `e2e/**` and `playwright.config.*` path filters.
- [x] 4.3 Run `pnpm test:all` locally. Confirm that Robot runs and Playwright does not (no Playwright `list` reporter output), and that the command exits 0.

## 5. Weekly Playwright workflow

- [x] 5.1 Create `.github/workflows/playwright-weekly.yml` (design D7):
  - triggers: `schedule` with cron `0 3 * * 1`, and `workflow_dispatch`;
  - `permissions: contents: read, issues: write`;
  - the same `env` block and setup steps as `ci.yml` through "Install Playwright browsers", with no Robot toolchain.
- [x] 5.2 Add the run step: `pnpm test:e2e --reporter=list,json` with `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json`. Add an upload of `test-results/` on `failure()`.
- [x] 5.3 Add the failure step, gated by `if: failure() && github.event_name == 'schedule'`, with `GH_TOKEN: ${{ github.token }}`:
  - `gh label create playwright-drift --force`;
  - find the open drift issue;
  - if one exists, comment on it; otherwise create it, titled "Playwright suite failing on main";
  - the body or comment links the run URL and lists failing `file › title` lines, extracted from `results.json` with `jq`.
  
  Quote every shell variable, and pass the body through `--body-file` from a temp file, not inline.
- [x] 5.4 Add the recovery step, gated by `if: success() && github.ref == 'refs/heads/main'`: if an open `playwright-drift` issue exists, comment with the run link, then `gh issue close` it.
- [x] 5.5 Run `actionlint` on the new workflow if it is installed; otherwise check it by reading it. Confirm the YAML parses with `node -e` and the `yaml` dev dependency.

## 6. Docs

- [x] 6.1 `README.md`:
  - mark `pnpm test:e2e` as a manual run that CI runs weekly;
  - add a `pnpm lint:e2e-parity` row;
  - mention that `test:all` runs Robot for e2e.
- [x] 6.2 `robot/README.md`:
  - replace the "runs alongside the Playwright TypeScript suite" wording: Robot is the e2e suite that runs, and Playwright is the parity reference, enforced by `lint:e2e-parity` and run weekly;
  - drop or reword "Do not run it at the same time as `pnpm test:e2e`" so it still holds for manual runs.
- [x] 6.3 `robot/PARITY.md`: say in the intro that `pnpm lint:e2e-parity` enforces the rows, and that any change to a Playwright test must update its row and its Robot test in the same change. Relabel the "Totals" table as the port's history (design D8).
- [x] 6.4 `CLAUDE.md`: in Stack › Testing and Key commands, say that Robot is the e2e suite that runs and Playwright is kept for parity and run weekly. Add `pnpm lint:e2e-parity` to the command list.

## 7. Verify

- [x] 7.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test -- --run`, `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:robot-steps` and `pnpm lint:e2e-parity`. Confirm all are green.
- [x] 7.2 Run `openspec validate run-only-robot-e2e --strict` and confirm it passes.
- [ ] 7.3 Report to the user and wait. After merge, the user dispatches `playwright-weekly.yml` once on `main` to confirm a green run (design Migration Plan step 3). Record the outcome here.
