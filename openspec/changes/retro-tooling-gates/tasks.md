## 1. Setup

- [x] 1.1 Confirm the branch is not `main`.

## 2. CRAP report options (test first)

- [x] 2.1 In `scripts/lint-crap.test.ts`, add one case per scenario in `specs/crap-metric/spec.md` (five), using hand-built scored lists as the existing `buildReport` cases do, plus `parseArgs` cases: no args, `--all`, `--file <path>`, both, unknown option. Run `pnpm exec vitest run scripts/lint-crap.test.ts` and confirm the new cases fail.
- [x] 2.2 In `scripts/lint-crap.mjs`, export `parseArgs(argv)` (Node `util.parseArgs`, `strict: true`) and a path filter, give `buildReport` an `{ all }` option, and wire both into `main()` with exit 2 for an unknown option or a path matching no scored file (design "CRAP options filter").
- [x] 2.3 Rerun the file's tests; every case passes. Run `node scripts/lint-crap.mjs --all --file src/lib` and `node scripts/lint-crap.mjs --file src/missing; echo $?` by hand and check the output and the exit code 2.

## 3. no-console (test first)

- [x] 3.1 In `scripts/oxlint-config.test.ts`, add one `lintFixture` case per scenario in `specs/code-linting/spec.md` (three). Confirm they fail.
- [x] 3.2 Add the two `no-console` overrides to `.oxlintrc.json` (design "no-console as an override"). Rerun the file's tests; all pass. Run `pnpm lint`; it exits 0.

## 4. Whole-tree formatting

- [x] 4.1 In `scripts/biome-config.test.ts`, change the wiring case to expect `lint:format` to be `biome ci .`, a `format` script that runs `biome check --write .`, and a CI Lint format step with no `--since`. Confirm it fails.
- [x] 4.2 In `package.json`, set `lint:format` to `biome ci .` and add `format`. In `.github/workflows/ci.yml`, replace the Lint format step's `BASE` script with `pnpm run lint:format`, update its comment, and drop `fetch-depth: 0` with its comment. Add `.claude/settings.local.json` to `.gitignore`. Rerun the file's tests; all pass.
- [x] 4.3 Run `pnpm format`. Run `git diff --stat` and confirm only the files listed in the proposal changed (Do Not Touch files layout-only, as approved), and none outside Biome's scope. Run `pnpm lint:format`; it exits 0.

## 5. Docs

- [x] 5.1 Write `docs/adr/0008-whole-tree-formatting.md` (context, decision, consequences including the Biome-bump step). Add a "Superseded by ADR 0008" note to ADR 0006's "Adoption is staged-only" section.
- [x] 5.2 In CLAUDE.md: change the Key commands `lint:format` line to the whole-tree check and add `pnpm format`; delete the Architectural decisions bullet about using the logger instead of `console.log` (oxlint now enforces it in `src/`).

## 6. Verify

- [x] 6.1 Replace each `> **Tests:** none` in this change's delta specs with the test file and case name that now covers it, keeping `none` only where no test exists. Use `../../../../../scripts/...` relative links.
- [x] 6.2 Run `pnpm -s lint:specs`, `lint:given`, `lint`, `typecheck`, `lint:format` and `lint:crap`; each exits 0.
- [x] 6.3 Run `pnpm test:all` in the background; it exits 0.
- [x] 6.4 At commit time (only when the user asks): commit the `pnpm format` output alone, then add `.git-blame-ignore-revs` holding that commit's SHA in a follow-up commit (design "Reformat in its own commit").
