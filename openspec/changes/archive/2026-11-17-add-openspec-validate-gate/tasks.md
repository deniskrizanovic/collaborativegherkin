## 1. Baseline and dependency

- [x] 1.1 On branch `collaborativegherkin-72`, save `openspec validate --all --strict --no-interactive` output to `/tmp/openspec-before.txt`, and confirm it reports 14 failed specs and 29 warnings (5 Purpose, 24 long requirements). This is the work list for section 4
- [x] 1.2 Write a scratch script, outside the repo in `/tmp`, that extracts every `#### Scenario:` block (heading through the last bullet) from `openspec/specs/**/spec.md` into a sorted list. Save its output to `/tmp/scenarios-before.txt` (design D4)
- [x] 1.3 `pnpm add -D @fission-ai/openspec@^2.0.0`. Confirm `package.json` and `pnpm-lock.yaml` list it as a direct devDependency, and that `pnpm exec openspec --version` prints 2.x

## 2. Tests first

- [x] 2.1 Create `scripts/openspec-validate-config.test.ts` with a wiring case, "lint:openspec wired into pre-commit, CI and test:all". It asserts that `scripts["lint:openspec"]` is exactly `OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive`, that `test:all` includes `lint:openspec`, that `.husky/pre-commit` runs `pnpm run lint:openspec`, and that a `ci.yml` step's `run` is `pnpm run lint:openspec` (pattern: `scripts/oxlint-config.test.ts`)
- [x] 2.2 In the same file, add fixture cases that run the pinned CLI (`node_modules/.bin/openspec validate --all --strict --no-interactive`, with `OPENSPEC_TELEMETRY=0`) in a temporary directory holding a minimal `openspec/specs/<cap>/spec.md`:
  - "fails a spec whose Purpose is the archive placeholder"
  - "fails a spec with a requirement over 500 characters"
  - "passes a spec with a written Purpose and short requirements" (control)
  Each failing case expects a non-zero exit and the capability name in the output
- [x] 2.3 Run `pnpm exec vitest run scripts/openspec-validate-config.test.ts`. The wiring case fails (nothing is wired yet). The fixture cases pass, which pins the CLI's behaviour before the gate depends on it

## 3. Wire the gate

- [x] 3.1 Add the `lint:openspec` script from design D2 to `package.json`, and add `lint:openspec` to the `run-p` lint group in `test:all`
- [x] 3.2 In `.husky/pre-commit`, add `pnpm run lint:openspec` after `lint:given`, with a comment in the existing style: whole tree, pure filesystem, no network, telemetry off
- [x] 3.3 In `.github/workflows/ci.yml`, add a `Lint specs (openspec validate)` step running `pnpm run lint:openspec` after `Lint specs (given clause)`
- [x] 3.4 Run `pnpm exec vitest run scripts/openspec-validate-config.test.ts`. All cases pass. `pnpm lint:openspec` still fails here, on the 29 existing warnings

## 4. Clear the existing warnings

- [x] 4.1 Write a real `## Purpose` for `code-formatting`, `code-linting`, `crap-metric`, `dependency-maintenance` and `robot-e2e-suite`, following design D5. Read each spec's requirements and the archived change that created it (named in its TBD line) first
- [x] 4.2 Bring each of the 24 over-long requirements listed in `/tmp/openspec-before.txt` to 500 characters or fewer, following the four rules in design D4. Work one capability at a time and re-run `openspec validate <capability> --type spec --strict` after each: `change-issue-traceability`, `data-model`, `gherkin-document-model`, `gherkin-editor`, `gherkin-import`, `llm-review`, `realtime-collaboration`, `robot-e2e-suite`, `session-access-control`, `spec-authoring-standards`
- [x] 4.3 Re-run the scenario script into `/tmp/scenarios-after.txt`. `diff /tmp/scenarios-before.txt /tmp/scenarios-after.txt` must be empty. Investigate and fix any difference before continuing
- [x] 4.4 Read the `git diff` of `openspec/specs/` requirement by requirement. Every SHALL, MUST and SHALL NOT in the old text is still present, in the same or a split requirement. Each split kept the original requirement name for one of its parts
- [x] 4.5 `pnpm lint:openspec` exits 0, with every item passing and no warnings

## 5. Traceability and gates

- [x] 5.1 Update the `> **Tests:**` lines in this change's `specs/spec-authoring-standards/spec.md` from `none` to the cases in `scripts/openspec-validate-config.test.ts`: the two fixture failures, the control pass for "The current spec tree passes", and the wiring case for the three placement scenarios
- [x] 5.2 `pnpm lint`, `pnpm lint:format`, `pnpm typecheck`, `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:robot-steps`, `pnpm lint:e2e-parity`, `pnpm lint:openspec` and `pnpm test` all pass
- [x] 5.3 Check offline safety: run `pnpm lint:openspec` with networking off (or with `HTTPS_PROXY=http://127.0.0.1:9` set). It must exit 0 within a couple of seconds, with no network error
- [x] 5.4 Add `pnpm lint:openspec` to the key-commands block in `CLAUDE.md`, next to `pnpm lint:crap`, with a one-line description
