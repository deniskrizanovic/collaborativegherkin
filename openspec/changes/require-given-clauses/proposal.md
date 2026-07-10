## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/26

## Why

OpenSpec scenarios in this project follow a GIVEN/WHEN/THEN structure, but only
the `> **Tests:**` traceability line is enforced by an automated gate. Nothing
prevents a scenario from omitting its GIVEN precondition — which is exactly what
happened and had to be repaired by hand on the `docs/restore-given-clauses`
branch. A GIVEN clause makes the initial state of each example explicit;
without it, scenarios read as bare event/outcome pairs that hide the
preconditions a reader (or test author) needs. We should enforce the GIVEN
clause the same way we already enforce test traceability, and give authors
guidance on writing good GIVEN/WHEN/THEN in the first place.

## What Changes

- Add a filesystem lint gate — `lint:given`
  (`scripts/lint-spec-given-clause.mjs`) — that scans every `#### Scenario:` in
  `openspec/specs/**` and `openspec/changes/*/specs/**` and requires each to
  contain a `- **GIVEN**` clause before the next scenario/requirement boundary.
  It mirrors the existing `lint:specs` traceability gate: pure filesystem, no
  network, offline-safe.
- Wire `lint:given` into the husky pre-commit hook, the `test:all` script, and
  the CI workflow — alongside `lint:specs`.
- Edit the project-local `spec-driven` schema so newly generated scenarios
  include a GIVEN line by default: add `- **GIVEN**` to
  `openspec/schemas/spec-driven/templates/spec.md`, update the `specs`
  instruction in `openspec/schemas/spec-driven/schema.yaml`, and add a matching
  rule to `openspec/config.yaml`.
- Replicate the `gherkin-authoring` skill from the intent-driven-template into
  this project at `.claude/skills/gherkin-authoring/SKILL.md`, so authors get
  guidance on writing GIVEN/WHEN/THEN as concrete, observable examples. Wire it
  into the spec-writing flow deterministically by referencing the skill from the
  `spec-driven` schema `specs` instruction and `config.yaml` rule (not relying on
  the skill's `description` alone), and add a note that OpenSpec uses the
  `#### Scenario:` markdown bullet dialect rather than real `.feature` syntax.
- Codify the GIVEN rule as a new requirement in the existing
  `spec-authoring-standards` capability.

## Capabilities

### New Capabilities

_None._ The GIVEN-clause rule is added to the existing `spec-authoring-standards`
capability rather than introducing a new one.

### Modified Capabilities

- `spec-authoring-standards`: add a requirement that every scenario declares an
  explicit GIVEN precondition, enforced by the `lint:given` gate over both the
  archived baseline and unarchived change deltas, and wired into `test:all`.

## Impact

- **New file:** `scripts/lint-spec-given-clause.mjs` (gate) and
  `scripts/lint-spec-given-clause.test.ts` (unit tests), mirroring the existing
  traceability gate pair.
- **New file:** `.claude/skills/gherkin-authoring/SKILL.md` (authoring guidance).
- **Modified:** `package.json` (`lint:given` script + `test:all` wiring),
  `.husky/pre-commit` (or equivalent), `.github/workflows/ci.yml`.
- **Modified:** `openspec/schemas/spec-driven/templates/spec.md`,
  `openspec/schemas/spec-driven/schema.yaml`, `openspec/config.yaml`.
- **No runtime/app code affected** — this is a spec-authoring and tooling
  change only. The 123 existing scenarios across `openspec/specs/**` already
  carry a GIVEN clause, so the gate is green on introduction.
