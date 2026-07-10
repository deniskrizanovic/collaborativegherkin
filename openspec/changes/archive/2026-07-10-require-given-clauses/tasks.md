## 1. GIVEN-clause lint gate

- [x] 1.1 Create `scripts/lint-spec-given-clause.mjs`, cloning the structure of `scripts/lint-spec-traceability.mjs` (reuse `collectMarkdownFiles` / `collectSpecFiles` file-walk, `import.meta.url`-guarded `main()`).
- [x] 1.2 Implement `findViolations(content, file)` that, for each `#### Scenario:`, collects lines up to the next `#### Scenario:` / `### Requirement:` / `## ` heading (or EOF) and flags the scenario when no line matches `/^\s*[-*]\s*\*\*GIVEN\*\*/`.
- [x] 1.3 Export `findViolations`, `collectSpecFiles`, `collectMarkdownFiles`, and `lintFiles` for unit testing; have `main()` print a success summary and exit non-zero with file:line and scenario name on violations.
- [x] 1.4 Create `scripts/lint-spec-given-clause.test.ts` covering: GIVEN present passes, `* **GIVEN**` bullet passes, GIVEN with leading whitespace passes, missing GIVEN fails, GIVEN after `> **Tests:**` and other bullets passes, and change-delta files are scanned.

## 2. Wire the gate into the toolchain

- [x] 2.1 Add `"lint:given": "node scripts/lint-spec-given-clause.mjs"` to `package.json` scripts.
- [x] 2.2 Add `lint:given` to the `test:all` run-p list, next to `lint:specs`.
- [x] 2.3 Add `npm run lint:given` to the husky pre-commit hook alongside `lint:specs` (keep it out of the network-dependent Claude Code commit hook).
- [x] 2.4 Add `lint:given` to the spec-lint step in `.github/workflows/ci.yml`.
- [x] 2.5 Run `npm run lint:given` against the current tree and confirm zero violations over all 123 existing scenarios.

## 3. Update the project-local spec-driven schema

- [x] 3.1 Add a `- **GIVEN** <!-- initial state -->` line to the scenario stub in `openspec/schemas/spec-driven/templates/spec.md`, above the WHEN line.
- [x] 3.2 Update the `specs` artifact instruction in `openspec/schemas/spec-driven/schema.yaml` to (a) require a GIVEN line, (b) add GIVEN to its inline example scenario, and (c) direct the author to invoke the `gherkin-authoring` skill and apply its GIVEN/WHEN/THEN guidance before authoring scenarios.
- [x] 3.3 Add a `specs` rule to `openspec/config.yaml` requiring a `- **GIVEN**` clause on every scenario (mirroring the existing traceability rule, naming the `lint:given` gate) and reinforcing the directive to invoke the `gherkin-authoring` skill.

## 4. Replicate the gherkin-authoring skill

- [x] 4.1 Create `.claude/skills/gherkin-authoring/SKILL.md` with the content ported from the intent-driven-template `gherkin-authoring` skill (frontmatter + guidance).
- [x] 4.2 Add a short provenance note (source repo/path) so a future upstream sync is intentional.
- [x] 4.3 Append a dialect note: OpenSpec specs in this repo use the markdown `#### Scenario:` + `- **GIVEN**` / `- **WHEN**` / `- **THEN**` bullet form (enforced by `lint:given`), not real `.feature` syntax — the skill is used for its authoring principles, not its literal syntax reference.

## 5. Codify the requirement and verify

- [x] 5.1 Confirm the delta spec `openspec/changes/require-given-clauses/specs/spec-authoring-standards/spec.md` matches the implemented gate behaviour (scan window, predicate, wiring).
- [x] 5.2 Run `npm run lint:specs`, `npm run lint:given`, and the new unit test file to confirm all pass.
- [x] 5.3 Run `npm run test:all` (or the offline subset) to confirm the gate is integrated and green.
