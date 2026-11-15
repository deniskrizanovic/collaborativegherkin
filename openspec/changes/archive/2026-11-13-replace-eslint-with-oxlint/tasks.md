## 1. Capture the ESLint baseline (while ESLint is still installed)

- [x] 1.1 Confirm the branch is not `main`. Run `pnpm lint` and confirm `eslint .` exits 0. That is the parity baseline.
- [x] 1.2 Run `pnpm exec eslint --print-config` on `src/app/HomeClient.tsx`, `scripts/biome-config.test.ts` and `server.js`. Save the active-rule lists (severity not `off`/`0`) to a scratch file outside the repo. Expect about 80 rules for `.tsx`; the `.mjs`/`.js` list lacks only `no-var`, `prefer-const`, `prefer-rest-params` and `prefer-spread`, and the test file differs only in `@typescript-eslint/no-explicit-any` (design Context).

## 2. Add oxlint and its config

- [x] 2.1 Run `pnpm view oxlint dist-tags --json`, then `pnpm add -D -E oxlint@<latest allowed>` (design D4). Confirm `package.json` has no `^`/`~` on it. If pnpm reports a blocked build script, stop and report it; do not add an `allowBuilds` entry unasked.
- [x] 2.2 Write root `.oxlintrc.json` (design D2, D5):
  - `$schema` set to `./node_modules/oxlint/configuration_schema.json`;
  - `plugins`: `typescript`, `react`, `nextjs`, `jsx-a11y`, `import`;
  - every `categories` entry `off`;
  - `rules`: the mapped rule list from 1.2, with ESLint severities and options;
  - `overrides`: `no-explicit-any` off for `**/*.{test,spec}.{ts,tsx}`; the four TS-only core rules on for `**/*.{ts,tsx,mts,cts}`;
  - `ignorePatterns`: `src/generated/**`, `next-env.d.ts`, `test-results/**`, `playwright-report/**`, `.venv/**`, `robot/results/**`.
- [x] 2.3 Check the mapping by diffing the 1.2 rule names, after the D2 renames, against the `.oxlintrc.json` rule keys. The only names allowed in the diff are the D3 list: `no-location-assign-relative-destination`, `no-deprecated`, `react-hooks/config`, `react-hooks/gating`, `jsx-uses-react` and `jsx-uses-vars`. Any other gap must be resolved before continuing.
- [x] 2.4 Run `pnpm exec oxlint --max-warnings=0` and confirm 0 diagnostics, exit 0 and about 98 files linted. If anything is reported, compare it with ESLint's behavior on the same line before changing config or code. Stop and report a real difference instead of suppressing it.

## 3. Config test (write first; ESLint-removal cases fail until section 4)

- [x] 3.1 Create `scripts/oxlint-config.test.ts` (design D8). It uses `execFileSync` on `node_modules/.bin/oxlint` with no shell and no `vi.mock`, and a temp-dir fixture helper that copies `.oxlintrc.json` in and runs `-c .oxlintrc.json --format json --max-warnings=0`. Cover every scenario in `specs/code-linting/spec.md` that cites this file, using the exact case titles cited there:
  - no ESLint packages or config remain;
  - devDependency pinned without a range;
  - warning-only file exits non-zero;
  - reports set-state-in-effect;
  - unused vars honor the underscore pattern;
  - no-explicit-any off in test files only;
  - default categories off;
  - oxlint-disable-next-line suppresses the named rule;
  - no eslint-disable outside generated code;
  - ignores generated client;
  - lint wired into lint-staged, CI and test:all.
- [x] 3.2 Run `pnpm test -- --run scripts/oxlint-config.test.ts`. The rule-behavior and scope cases pass. The "no ESLint", "no eslint-disable" and wiring cases fail until section 4.

## 4. Switch over and remove ESLint

- [x] 4.1 In `package.json`:
  - set `"lint": "oxlint --max-warnings=0"`;
  - in `lint-staged` `*.{ts,tsx}`, replace `eslint --max-warnings=0` with `oxlint --max-warnings=0` in the same position (design D7).
- [x] 4.2 Rename the suppressions (design D6), keeping each reason text:
  - `src/components/useCollabProvider.ts` becomes `oxlint-disable react/set-state-in-effect` / `oxlint-enable react/set-state-in-effect`;
  - `src/app/auth/signin/SignInForm.tsx` becomes `oxlint-disable-next-line nextjs/no-img-element`.

  Then run `pnpm lint` and confirm it still reports 0 diagnostics, which proves the new comments suppress.
- [x] 4.3 `pnpm remove eslint eslint-config-next`. Delete `eslint.config.mjs`. Remove `unrs-resolver` from `pnpm-workspace.yaml` `allowBuilds`, after confirming `pnpm why unrs-resolver` is empty.
- [x] 4.4 In `.github/workflows/ci.yml`, replace `eslint.config.mjs` with `.oxlintrc.json` in both `paths` filters. Leave the "Lint" step as `pnpm run lint`.
- [x] 4.5 In `scripts/biome-config.test.ts`:
  - rename the case "lint-staged runs Biome write before ESLint" to "lint-staged runs Biome write before oxlint" and match `oxlint` instead of `eslint`;
  - change the "`eslint .` running in parallel" comment to name `pnpm lint` (oxlint).
- [x] 4.6 Run `pnpm test -- --run scripts/oxlint-config.test.ts scripts/biome-config.test.ts`. All cases pass.

## 5. Dependency policy

- [x] 5.1 Delete the `eslint` ignore entry from `.github/dependabot.yml` and the "Exception: `eslint`" section from `docs/adr/0004-latest-stable-dependency-principle.md`.
- [x] 5.2 In `scripts/lint-dependabot.test.ts`, change `validConfig`, the fixture ADR and the "accepts ignore entries cited in the ADR" case from `eslint` to `next-auth`. Keep the `eslint-config-next` substring edge-case test as it is (design D9).
- [x] 5.3 Run `pnpm lint:dependabot` and `pnpm test -- --run scripts/lint-dependabot.test.ts`. Both pass.

## 6. Documentation

- [x] 6.1 Write `docs/adr/0007-oxlint-replaces-eslint.md` in the ADR 0004 format (Status, Date, Context, Decision, Consequences). Cover:
  - full replacement, and why the hybrid was dropped;
  - parity rule set with categories off;
  - the D3 gap list;
  - exact pin;
  - suppression syntax;
  - that it supersedes ADR 0006's "Next step: oxlint" section.
- [x] 6.2 In ADR 0006, add a pointer to ADR 0007 in the "Next step: oxlint" section, and change the consequence that says ESLint's config and ADR 0004 exception are unchanged.
- [x] 6.3 Update `CLAUDE.md`:
  - Stack: change the Formatting line's "ESLint lints" to "oxlint lints", and add a Linting line for oxlint;
  - Key commands: `pnpm lint` becomes "lint with oxlint".
- [x] 6.4 Update `README.md`: the tooling paragraph says oxlint does the linting, and add a note to install the oxlint editor extension in place of ESLint.
- [x] 6.5 Run `rg -n -i eslint` outside `node_modules`, `pnpm-lock.yaml`, `src/generated/`, `openspec/changes/archive/` and dated history docs (`docs/plans/`, `docs/*-story.md`, `docs/architecture-review/`). Confirm the only matches left are intentional: ADR 0006/0007 history, the `lint-dependabot` edge-case test, and this change's own artifacts.

## 7. Verify behavior by hand (scenarios marked `Tests: none`)

- [x] 7.1 "The current codebase passes": `pnpm lint` reports 0 diagnostics and exits 0.
- [x] 7.2 Commit-hook check without committing:
  - stage a scratch `.tsx` under `src/` containing a plain `<img>`;
  - run `pnpm exec lint-staged` and confirm it fails on `no-img-element`;
  - unstage and delete the scratch file.

## 8. Full verification

- [x] 8.1 Run `pnpm test:all` and confirm it is green: typecheck, every lint gate including `lint`, `lint:format`, `lint:specs` and `lint:given`, unit tests and Robot.
- [x] 8.2 Run `openspec validate replace-eslint-with-oxlint` and confirm no errors.
- [x] 8.3 Report the results and wait for an explicit commit instruction.
