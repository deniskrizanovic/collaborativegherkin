## 1. Spec-layout gate (test-first, not yet wired)

- [x] 1.1 Create `scripts/lint-spec-layout.test.ts` with one case per scenario in the delta `specs/process/spec-authoring-standards/spec.md`:
  - layout cases, using temp-dir fixtures: categorised main spec passes; uncategorised main spec fails, naming the file and the allowed categories; uncategorised delta fails; archived delta is ignored
  - link cases: resolving repo-root link passes; relative link fails with file and line; dangling repo-root link fails with the target; `https:` and `#anchor` links are ignored; a target containing `[id]` resolves; links inside fenced code blocks are skipped

  Run the tests and confirm they fail.
- [x] 1.2 Create `scripts/lint-spec-layout.mjs` per design D5:
  - `CATEGORIES` constant
  - reuse `collectSpecFiles` from `scripts/lint-spec-traceability.mjs`
  - exported `findLayoutViolations` and `findLinkViolations` functions plus a thin `main`
  - a header comment matching the sibling gates

  `pnpm exec vitest run scripts/lint-spec-layout.test.ts` passes.
- [x] 1.3 Add `"lint:spec-layout": "node scripts/lint-spec-layout.mjs"` to `package.json`. Do not wire it into `test:all`, husky or CI yet. Run it on the current tree and record the counts: 18 layout violations from the main specs, 1 from the active dependabot delta, and about 339 relative-link violations.

## 2. Rewrite spec links to repo-root form (before any move)

- [x] 2.1 Write a throwaway rewrite script outside the repo, and do not commit it. It applies design D4 to every `spec.md` under `openspec/specs/**`, `openspec/changes/add-dependabot-automerge/specs/**` and `openspec/changes/organise-specs-into-categories/specs/**`, in this order:
  1. resolve the target against the file's current folder
  2. else fall back to the code-span path in the link text
  3. else print the link for manual repair

  Keep `#fragment`s.
- [x] 2.2 Run it, then repair every printed link by hand. Expect about 20, from `change-issue-traceability`, `session-access-control` and the bare `src/...` targets.
- [x] 2.3 Review `git diff --stat openspec/`. Only link targets changed, and no requirement or scenario text.
- [x] 2.4 `pnpm lint:spec-layout` reports zero link violations. Only the layout violations remain.

## 3. Move specs into categories

- [x] 3.1 `git mv` the 18 main specs into `product/gherkin/`, `product/sessions/`, `quality/` and `process/`, using the exact mapping in design D1.
- [x] 3.2 `git mv openspec/changes/add-dependabot-automerge/specs/dependency-maintenance openspec/changes/add-dependabot-automerge/specs/quality/dependency-maintenance`
- [x] 3.3 `openspec list --specs` shows 18 path-like ids. `pnpm lint:spec-layout` passes with zero violations.
- [x] 3.4 `pnpm lint:openspec`, `pnpm lint:specs`, `pnpm lint:given` and `pnpm lint:robot-steps` all pass. `openspec validate organise-specs-into-categories --strict` and `openspec validate add-dependabot-automerge --strict` pass against the moved specs.

## 4. Wire the gate

- [x] 4.1 Add `lint:spec-layout` to the `run-p` list in `test:all`.
- [x] 4.2 Add a `pnpm run lint:spec-layout` block to `.husky/pre-commit` after `lint:given`, with a comment in the sibling style ("whole-tree, pure filesystem, no network").
- [x] 4.3 Add a `lint:spec-layout` step to `.github/workflows/ci.yml` next to the `lint:specs` step.
- [x] 4.4 Add wiring assertions to `scripts/lint-spec-layout.test.ts`, mirroring `scripts/openspec-validate-config.test.ts`: the `test:all` script, the husky pre-commit hook and the CI step. Run the test file; it passes.

## 5. Point workflow config and docs at the new layout

- [x] 5.1 Update the `openspec/schemas/spec-driven/schema.yaml` `proposal` and `specs` instructions. Replace `openspec/specs/<capability>/` with the category path. Tell authors to keep an existing capability's full path and to put a new capability under `product/`, `quality/` or `process/`. Update `openspec/schemas/spec-driven/templates/proposal.md` line 18 to match.
- [x] 5.2 Add a `rules.specs` entry to `openspec/config.yaml`: specs sit under a category, and local links use repo-root targets that exist, enforced by `lint:spec-layout`.
- [x] 5.3 Add one line to `CLAUDE.md` describing the spec category layout and repo-root Tests links.
- [x] 5.4 Rewrite the `openspec/specs/<cap>` paths in the `docs/spec/0*.md` headers, `robot/README.md` (including the resource-to-spec table), `robot/PARITY.md`, and the `Documentation` lines in `robot/suites/*.robot` and `robot/resources/steps/*.resource`. Comments only.
- [x] 5.5 Update the `scripts/biome-config.test.ts:112` fixture to `openspec/specs/product/gherkin/gherkin-editor/spec.md`.
- [x] 5.6 `rg 'openspec/specs/(?!product/|quality/|process/)[a-z]' -P -g '!openspec/changes/archive/**' -g '!robot/results/**' -g '!.agents/**'` returns only generic mentions (e.g. `openspec/specs/**`), with no stale capability paths.

## 6. Verification

- [x] 6.1 `pnpm exec vitest run scripts/lint-spec-layout.test.ts scripts/biome-config.test.ts scripts/openspec-validate-config.test.ts` passes.
- [x] 6.2 `pnpm lint:spec-layout`, `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:openspec`, `pnpm lint:robot-steps`, `pnpm lint:e2e-parity`, `pnpm lint` and `pnpm lint:format` all pass.
- [x] 6.3 Spot-check on GitHub after push: three `> **Tests:**` links resolve to the test file, one from each of `product/gherkin`, `quality` and `process`.
- [x] 6.4 Negative check: put a scratch `openspec/specs/scratch/spec.md` in place, confirm that `pnpm lint:spec-layout` fails and names it, then remove the file.
