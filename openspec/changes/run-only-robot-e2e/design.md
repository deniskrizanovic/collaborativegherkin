## Context

The project has two e2e suites against the same app:

- **Playwright:** `e2e/*.spec.ts`, 122 `test()` calls that produce 123 tests,
  because one call in `e2e/image.spec.ts:141` is inside a loop and builds its
  title from a template literal.
- **Robot Framework:** `robot/suites/*.robot`. The suites without the `_bdd`
  suffix are the port. The `_bdd.robot` suites are business-language extras
  and are not part of parity.

Where e2e runs today:

```
  package.json   e2e:all  = run-s test:e2e test:robot     <- test:all runs e2e:all
  ci.yml         ... unit tests -> Install Playwright browsers -> Install Robot toolchain
                 -> "E2e tests" (pnpm test:e2e) -> "Upload Playwright results" (on failure)
                 -> "Robot e2e tests" -> "Upload Robot report" (always)
  husky          lint-staged + offline lint gates, no e2e
```

Parity today is complete:

- `robot/PARITY.md` has 123 rows. 122 are `ported` and one (`SC-3.5.2`) is
  `skip`.
- Every Playwright title matches a Robot test name exactly, including the
  lowercase API and WebSocket titles.
- `PARITY.md` is kept by hand, and nothing checks it.

Constraints found while exploring:

- **Robot depends on `e2e/`.** `scripts/mint-e2e-auth.ts` imports
  `e2e/global-setup.ts`, and `robot/resources/variables.resource` reads
  `e2e/.auth/user.json` and `user2.json`. So `e2e/` must stay, as the
  proposal already requires.
- **`playwright test --list` works offline.** It enumerates all 123 tests
  with exact titles: no server, no global setup, about 0.3 s warm. A cold
  first run took about 30 s. With `--reporter=json` each test carries
  `expectedStatus: "skipped"` for `test.skip`.
- **`PARITY.md` rows are pipe tables with 6 cells** (file, title, key
  assertions, Robot suite, chunk, status). Some assertion cells contain
  escaped pipes (`\|`). A second table near the end (the BDD exclusions)
  has rows whose first cell is a scenario ID, not a `*.spec.ts` file.
- **`scripts/lint-robot-spec-steps.mjs` exports `parseRobotSuite`.** It finds
  test cases (non-indented lines under `*** Test Cases ***`) but records
  only a `bdd` flag, not the full tag list.

## Goals / Non-Goals

**Goals:**

- Robot is the only e2e suite run by CI on push and pull request, and by
  `test:all`.
- Playwright stays in the repo, still compiles and lints, and stays in
  parity with Robot through a gate that runs on every commit.
- Playwright still runs weekly, so tests that don't run don't go stale
  unnoticed. A failure becomes a tracked GitHub issue.

**Non-Goals:**

- Checking that Robot assertions are as strong as Playwright's. That stays
  a code-review concern under the existing robustness requirement.
- Changing any test in `e2e/` or `robot/suites/`, or the auth-minting path.
- Gating merges on Playwright.
- Parity for the `_bdd.robot` suites, which have their own
  `lint:robot-steps` gate.
- Removing the `@playwright/test` dependency. It is still needed for
  `test:e2e`, `--list` and the weekly run.

## Decisions

### D1. Gate reads Playwright tests from `playwright test --list --reporter=json`

The gate runs `./node_modules/.bin/playwright test --list --reporter=json`
and keeps each `{file, title, skipped}` it finds.

- **Why:** this is the only way to see generated titles such as the two
  `SC-3.12.3 — letter` and `— slash` tests without running JS by hand.
  Titles match Playwright's own view exactly.
- **Alternative rejected:** a regex or AST scan of `e2e/*.spec.ts`. It
  misses template-literal titles built in loops, and it would need
  `describe` and skip handling re-implemented.
- **Keep it testable:** the parsing and comparison live in pure exported
  functions (`parsePlaywrightList`, `parseParityTable`, `lintParity`) that
  take strings and arrays. `main()` alone runs the `--list` subprocess and
  reads files. This follows the explicit-injection preference and
  `lint-schema-parity.mjs`, so the Vitest tests need no `vi.mock`.

### D2. Match on (spec file, exact title), with no normalisation

A Playwright test matches a `PARITY.md` row when the spec file basename and
the title are byte-equal. A row then matches a Robot test when the row's
`Robot suite` cell names a file under `robot/suites/` that has a test case
named exactly the title.

- **Why:** `PARITY.md` already says "the Robot test case uses the same
  name", and the current tree matches exactly. Normalising (case,
  whitespace, dashes) would hide real renames.
- Duplicate (file, title) pairs in Playwright or in `PARITY.md` are
  themselves an error, because a row must map to exactly one test.

### D3. Parse `PARITY.md` rows by first cell, split on unescaped pipes

Only table rows whose first cell ends in `.spec.ts` are parity rows. Cells
are split on `|` not preceded by `\`. Each row must have 6 cells. The gate
reads columns by position (file, title, assertions, suite, chunk, status)
and checks the header row once so a reordered table fails loudly.

- **Status:** allowed values are `ported` and `skip`. Anything else
  (`pending`, empty, a typo) fails.

### D4. Reuse and extend `parseRobotSuite` for test names and tags

Add a `tags` array to each test returned by `parseRobotSuite` in
`scripts/lint-robot-spec-steps.mjs`. It collects the `[Tags]` cells,
including `...` continuations, and merges the suite-level `Test Tags`,
`Force Tags` and `Default Tags`. Existing fields stay unchanged.

- **Why:** this is one Robot parser instead of two that could disagree. The
  change is additive, and the existing `lint-robot-spec-steps.test.ts` keeps
  passing.
- **Alternative rejected:** a second Robot parser in the new script.

**Skip agreement:** three facts must all be true or all be false: Playwright
`skipped`, row status `skip`, and the Robot test's tags including `skip`.

### D5. Gate name and placement: `lint:e2e-parity`, offline, everywhere

- **Name:** the script is `scripts/lint-e2e-parity.mjs`, run as
  `pnpm lint:e2e-parity`. It is distinct from `lint:schema-parity`, which
  compares Prisma schemas.
- **Where it runs:**
  - in `.husky/pre-commit` after `lint:robot-steps`;
  - in `ci.yml` as a "Lint e2e parity" step next to the other lints;
  - in the `run-p` list of `test:all`.
- **Offline-safe:** the gate needs only `node_modules`, with no network,
  server or browser, so it belongs in the pre-commit hook under the
  project's rule for that hook.
- **On failure** it prints one line per mismatch:
  `<spec file> › <title>: <problem>`.

### D6. CI keeps browser install, drops only the Playwright run

In `ci.yml`, delete the "E2e tests" and "Upload Playwright results" steps.
Keep the following:

- `PLAYWRIGHT_BROWSERS_PATH`, the cache, and "Install Playwright browsers".
  `--with-deps` installs the system libraries Chromium needs, and Robot's
  Browser library uses the same browser directory.
- The `e2e/**` and `playwright.config.*` path filters, because typecheck,
  lint and the parity gate still read those files.
- The "Robot e2e tests" step, which already starts the dev server through
  `scripts/run-robot.mjs`.

**Alternative rejected:** dropping "Install Playwright browsers" and relying
on `rfbrowser init`. Its system-dependency coverage on ubuntu-latest is
unverified, and the step is cheap with the cache.

`package.json`: `"e2e:all": "run-s test:robot"`. It keeps the alias, so
`test:all` and the docs stay stable.

### D7. Weekly workflow: `.github/workflows/playwright-weekly.yml`

- **Triggers:**
  - `schedule: cron '0 3 * * 1'`, every Monday at 03:00 UTC. GitHub runs
    schedules on the default branch only.
  - `workflow_dispatch`.
- **Permissions:** `contents: read`, `issues: write`.
- **Job:** the same `env` block and setup steps as `ci.yml` up to the
  browser install (checkout, pnpm, node 22, install, prisma generate,
  migrate deploy, seed, browser cache, Playwright install). No Robot
  toolchain.
- **Run:** `pnpm test:e2e --reporter=list,json` with
  `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json`, so failing
  titles can be extracted with `jq`. Playwright's `webServer` starts
  `pnpm dev` as it did in CI.
- **Upload:** `test-results/` on `failure()`.
- **Drift steps** use the preinstalled `gh` with
  `GH_TOKEN: ${{ github.token }}`. The repo's `GH_HOST=github.com` rule is
  for local agent `gh` calls; on Actions, `gh` already targets the run's
  repository.
  - **Failure** (`if: failure() && github.event_name == 'schedule'`):
    1. `gh label create playwright-drift --force`, with a description and
       colour.
    2. Look up the open issue with
       `gh issue list --label playwright-drift --state open --json number --limit 1`.
    3. If it exists, `gh issue comment`. Otherwise
       `gh issue create --label playwright-drift`, titled
       "Playwright suite failing on main". The body links
       `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`
       and lists the failing `file › title` lines from `results.json`.
  - **Recovery** (`if: success() && github.ref == 'refs/heads/main'`): if an
    open drift issue exists, comment with a link to the run, then close it.
    This runs for scheduled and manual runs alike, as the spec requires.
- **Why one issue, not one per failure:** a broken suite left for weeks
  becomes one issue with a comment per week, not a pile of duplicates.
  Auto-close keeps the issue's lifetime equal to the drift.
- **Alternative rejected:** a third-party "create issue from failure"
  action. `gh` is preinstalled, needs no pinned dependency, and keeps
  Dependabot's scope unchanged.

### D8. Docs

- `README.md`: the `test:e2e` row says it is manual and runs weekly in CI.
  Add a `lint:e2e-parity` row.
- `robot/README.md`: replace "runs alongside the Playwright TypeScript
  suite" with: Robot is the suite that runs, and Playwright is the parity
  reference, enforced by `lint:e2e-parity`.
- `robot/PARITY.md`: the intro says the gate enforces the rows. The chunk
  "Totals" table becomes historical: label it as the port's history, or
  remove it, because the gate does not check counts and they will go stale.
- `CLAUDE.md`: under Testing and Key commands, note that Robot is the e2e
  suite that runs and Playwright is kept for parity.

## Risks / Trade-offs

- **[Playwright assertions drift from Robot, and the gate can't see it]**
  The gate checks names, files and skip status only. Mitigation: the
  weekly run catches Playwright tests that stop passing, and assertion
  strength stays a review item under the robustness requirement.
- **[Slow cold start of `playwright test --list` in pre-commit]** The first
  run took about 30 s, and later runs about 0.3 s. Mitigation: accept it,
  since it is a one-off per machine. If it becomes a problem, run the gate
  in pre-commit only when `e2e/`, `robot/` or `PARITY.md` is staged.
- **[`--list` output format changes in a future Playwright version]** The
  JSON reporter schema is stable but not guaranteed. Mitigation: the
  parser fails loudly when no tests are found or when expected fields are
  missing, so a Dependabot bump that breaks it fails pre-commit and CI
  rather than passing silently.
- **[Weekly run fails for reasons outside the code (GitHub outage, flaky
  dev server)]** That opens a drift issue that isn't about drift.
  Mitigation: a manual re-dispatch that passes closes it. `retries: 0`
  stays, per `playwright.config.ts`.
- **[Scheduled workflows are disabled after 60 days without repository
  activity]** This is GitHub's rule for public repositories. Mitigation:
  the repo is active, and GitHub emails the owner before disabling.
- **[Losing Playwright as a merge gate]** A Playwright-only regression can
  merge and is found up to 7 days later. This is accepted: Robot covers the
  same 123 behaviours on every pull request.

## Migration Plan

1. Land the gate first (D1–D5), green against the current tree.
2. In the same change, switch `e2e:all` and `ci.yml` (D6), add the weekly
   workflow (D7), and update the docs (D8).
3. After merge, dispatch the weekly workflow by hand once on `main` to
   prove it passes. Optionally prove the issue path on a scratch branch with
   a deliberately failing test, by temporarily allowing `workflow_dispatch`
   to run the failure steps, then revert.

**Rollback:** restore `"e2e:all": "run-s test:e2e test:robot"` and the two
`ci.yml` steps. The gate and the weekly workflow can stay; they do no harm.

## Open Questions

None blocking. If the cold-start cost of `--list` in pre-commit turns out to
be a problem, the staged-paths filter in Risks can be added later.
