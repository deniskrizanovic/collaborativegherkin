## 1. Install and configure Stryker

- [x] 1.1 Add `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` as dev dependencies with `pnpm add -D`, and check the vitest runner's peer range accepts the installed Vitest
- [x] 1.2 Add `stryker.config.json`: `testRunner: "vitest"`, no checkers, `mutate` globs for `src/lib/**/*.ts` and `src/db/**/*.ts` excluding `*.test.ts`, `*.spec.ts`, `*.d.ts` and `src/db/testing.ts`, reporters `html`, `json`, `clear-text`, `progress` writing to `reports/mutation/`, `tempDirName` `.stryker-tmp`, explicit `concurrency`
- [x] 1.3 Add the `test:mutation` script (`stryker run`) to `package.json`; leave it out of `test:all`
- [x] 1.4 Add `reports/` and `.stryker-tmp/` to `.gitignore`; confirm `pnpm lint:format` and `pnpm lint` ignore them

## 2. Baseline and threshold

- [x] 2.1 Run `pnpm test:mutation` and record the total score, run time and the files with the most survivors
- [x] 2.2 Set `thresholds` in `stryker.config.json` so `0 < break < low < high`, with `break` a few points below the baseline score; note the baseline in design.md D3
- [x] 2.3 If schema files only add unkillable survivors, drop them from `mutate` and record that in design.md D2 (first pass kept them; superseded by 6.1)
- [x] 2.4 Re-run and confirm the command exits zero at baseline, and exits non-zero when `break` is temporarily set above the score

## 3. Config test

- [x] 3.1 Add `scripts/mutation-config.test.ts` asserting: Vitest runner, `mutate` scope and exclusions, threshold ordering, report paths under `reports/mutation/`, and that neither `test:all` nor `.github/workflows/ci.yml` runs `test:mutation`
- [x] 3.2 Run `pnpm exec vitest run scripts/mutation-config.test.ts` and confirm it passes
- [x] 3.3 Replace `> **Tests:** none` in the spec with links to this test for the scenarios it covers (scope, test files not mutated, application code not mutated, threshold configured, test:all, per-push CI); keep `none` for the run-time and workflow scenarios

## 4. Weekly workflow

- [x] 4.1 Add `.github/workflows/mutation-weekly.yml` per design D4: Monday 04:00 UTC cron, `workflow_dispatch`, `permissions` contents read and issues write, `timeout-minutes: 60`, install, `pnpm run test:mutation`, upload `reports/mutation/` as `mutation-report` with `if: always()`
- [x] 4.2 Add the drift steps: on scheduled failure open or comment on the single `mutation-drift` issue (body via `--body-file`, label created with `gh label create --force`); on success on `main` comment on and close it
- [x] 4.3 Run `pnpm lint:format` and confirm the workflow file and Stryker config are clean

## 5. Docs and gates

- [x] 5.1 Add `pnpm test:mutation` to the key-commands block in `CLAUDE.md` and the command table in `README.md`, noting it is manual and weekly in CI
- [x] 5.2 Run `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:spec-layout`, `pnpm lint:openspec`, `pnpm lint:issue-link`, `pnpm lint`, `pnpm lint:format`, `pnpm typecheck` and `pnpm exec vitest run`; all must pass
## 6. Narrow scope (design D2)

- [x] 6.1 In `stryker.config.json`, set `mutate` to `src/lib/**/*.ts` minus `**/*.test.ts`, `**/*.spec.ts`, `**/*.d.ts`, `src/lib/llm-constants.ts`, `src/lib/logger.ts` and `src/lib/db.ts`; drop the `src/db/**` glob and the `src/db/testing.ts` exclusion
- [x] 6.2 In `scripts/mutation-config.test.ts`, replace "mutates database source" with "does not mutate declarative and wiring files" (the three `src/lib` files and both `src/db/schema.*.ts`), rename "does not mutate test files, the test helper or declaration files" to "does not mutate test files or declaration files", and assert `break` is at least 80
- [x] 6.3 Link the "Declarative and wiring files are not mutated" scenario to the new test, and update the "Test files and declaration files are not mutated" link text to the renamed test

## 7. Kill the real survivors (design D8)

- [x] 7.1 `src/lib/wsAuth.ts` tests: cookie value containing `=`, cookie part with no `=`, session-cookie regex (line 27) with prefix and suffix junk, path regex (line 49), and each reject branch at lines 67, 76, 79 and 88 asserted to reject
- [x] 7.2 `src/lib/coaching.ts` tests: error body with no `metadata` and with no `retry_after_seconds`, empty `choices`, a choice with no `message`, and the request shape (URL, `POST`, `Content-Type` and `Authorization` headers, model, `system`/`user` roles)
- [x] 7.3 Add `// Stryker disable next-line StringLiteral: error message text, no behaviour` to each prompt or message string line in `src/lib/coaching.ts` that no code branches on; no other edit to the file
- [x] 7.4 `src/lib/gherkin.test.ts` only (do not edit `gherkin.ts`): keyword lines with leading and trailing text against the `^`/`$` anchors (lines 97–99), headings and list markers followed by several spaces, table rows without a leading or trailing `|`, lines needing `trim` (102, 122), and the optional-chaining cases at lines 45 and 73
- [x] 7.5 Add `src/db/schema.test.ts` running each case on `createTestDb("sqlite")` and `createTestDb("pg")`: duplicate `User.email`, duplicate `Account` (provider, providerAccountId), duplicate `VerificationToken` (identifier, token), user delete cascades to `Account`, user delete rejected while a `Session` exists, generated CUID `id` for `User`, `Account` and `Session`, `Session` `createdAt` set and `updatedAt` moving on update
- [x] 7.6 Replace `> **Tests:** none` with links to `src/db/schema.test.ts` in the `data-model` delta scenarios (Session record constraints, both User email scenarios, all Auth record constraints scenarios)
- [x] 7.7 Set `thresholds` to `break` 80, `low` 85, `high` 90; run `pnpm test:mutation`, confirm it exits zero with a score of at least 80, and record the score and run time in design.md D3

## 8. Staged-file run in pre-commit (design D9)

- [x] 8.1 Add `scripts/mutation-staged.mjs`: filter the passed paths by the `mutate` globs read from `stryker.config.json`, exit 0 when none remain, otherwise run `stryker run --mutate <files> --reporters clear-text,progress --allowEmpty`; export the filter and the argument builder as pure functions
- [x] 8.2 Add `scripts/mutation-staged.test.ts`: in-scope `src/lib` files kept whole, out-of-scope paths (tests, excluded files, `src/components/`) dropped, no remaining file means no Stryker invocation, and the Stryker arguments name each kept file and contain only console reporters and `--allowEmpty`
- [x] 8.3 Add `test:mutation:staged` (`node scripts/mutation-staged.mjs`) to `package.json`, and append it as the last command of the `*.{ts,tsx}` lint-staged array
- [x] 8.4 Extend `scripts/mutation-config.test.ts`: lint-staged runs `test:mutation:staged` last for `.ts` files, and `ci.yml` does not run `test:mutation:staged`
- [x] 8.5 Link the "Staged library files are mutation-tested before a commit lands" scenarios to the 8.2 tests (staged files mutated whole, out-of-scope files, no mutants, report left alone); keep `none` for "A staged file scoring below the threshold fails the commit", verified by 8.6
- [ ] 8.6 Manually verify: stage `src/lib/session.ts` with a new untested branch and confirm the commit is rejected; stage a comment-only change to it and confirm it passes; confirm `reports/mutation/mutation.json` is unchanged afterwards

## 9. Docs and gates

- [x] 9.1 Add `pnpm test:mutation:staged` to `CLAUDE.md` and `README.md`, noting it runs in the pre-commit hook on each staged in-scope `src/lib` file
- [x] 9.2 Run `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:spec-layout`, `pnpm lint:openspec`, `pnpm lint:issue-link`, `pnpm lint`, `pnpm lint:format`, `pnpm typecheck`, `pnpm lint:crap` and `pnpm exec vitest run`; all must pass

## 10. After merge

- [ ] 10.1 After merge, dispatch the `Mutation testing` workflow once from the Actions page and confirm it uploads `mutation-report` and, on a green run, opens no drift issue
