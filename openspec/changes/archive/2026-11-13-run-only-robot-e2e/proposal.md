## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/64

## Why

CI and `pnpm test:all` run two e2e suites against the same app: Playwright
(`e2e/*.spec.ts`, 123 tests) and Robot Framework (`robot/suites/`). The Robot
port is complete. `robot/PARITY.md` maps every Playwright test to a Robot test
with the same name, and no row is pending. Running both doubles the e2e time
and checks the same behaviour twice. Robot should be the only e2e suite that
runs on every push and commit.

The Playwright suite stays in the repo as the reference that Robot keeps parity
with. Two problems come with that. Today the only thing keeping the suites in
step is that both run. And Playwright tests that never run go stale without
anyone noticing.

## What Changes

- `pnpm e2e:all`, and therefore `pnpm test:all`, runs only the Robot suite.
  `pnpm test:e2e` stays as a manual command.
- The CI workflow drops the Playwright "E2e tests" step and its
  "Upload Playwright results" step. The Robot step, browser install and
  browser cache stay. **BREAKING** for anyone relying on a Playwright failure
  to fail a pull request: Playwright no longer gates merges.
- A new offline gate, `pnpm lint:e2e-parity`, checks `e2e/` against
  `robot/PARITY.md` and `robot/suites/`. It fails when:
  - a Playwright test has no `PARITY.md` row;
  - a row names a Playwright test that no longer exists;
  - a row is still `pending`;
  - a row's Robot suite has no test with exactly that name;
  - skip status differs between Playwright, the row and the Robot tag.
  
  It reads Playwright titles with `playwright test --list`, so titles built in
  loops are covered too. It runs in the husky pre-commit hook, in CI and in
  `test:all`.
- A new GitHub Actions workflow runs the Playwright suite every Monday
  against `main`, and on manual dispatch. When a scheduled run fails, it
  opens a `playwright-drift` issue that links the run and lists the failing
  tests, or comments on that issue if one is already open. The next green run
  on `main` comments on the open drift issue and closes it. Failed runs upload
  `test-results/`.
- Playwright code in `e2e/` is still typechecked and linted on every commit
  and in CI, as it is today.
- Docs (`README.md`, `robot/README.md`, `robot/PARITY.md`, `CLAUDE.md`) say
  that Robot is the suite that runs and Playwright is the parity reference.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `robot-e2e-suite`:
  - CI runs Robot as the only e2e suite instead of alongside Playwright.
  - The parity requirement is enforced by the new `lint:e2e-parity` gate.
  - A new requirement covers the weekly Playwright run and its drift issue.
  - The finished "port is delivered in independently green chunks"
    requirement is removed.

## Impact

- **Config:**
  - `package.json`: `e2e:all` and `test:all` change, and a new
    `lint:e2e-parity` script is added.
  - `.github/workflows/ci.yml`
  - `.husky/pre-commit`
- **New files:**
  - `scripts/lint-e2e-parity.mjs` and `scripts/lint-e2e-parity.test.ts`
  - `.github/workflows/playwright-weekly.yml`
- **Docs:** `README.md`, `robot/README.md`, `robot/PARITY.md`, `CLAUDE.md`.
- **Unchanged:**
  - `e2e/*.spec.ts`, `e2e/global-setup.ts` and `playwright.config.ts`
    (Robot still mints its auth states through `e2e/global-setup.ts`).
  - Vitest unit tests, the other lint gates, the Claude Code hooks, and all
    app code under `src/`.
- **GitHub:**
  - The weekly workflow needs `issues: write` on `GITHUB_TOKEN`.
  - It creates the `playwright-drift` label if the label is missing.
  - CI time per push drops by the length of the Playwright run.
