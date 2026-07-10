## Context

The project already has one spec-authoring gate: `lint:specs`
(`scripts/lint-spec-traceability.mjs`), which scans every `#### Scenario:` under
`openspec/specs/**` and `openspec/changes/*/specs/**` and requires a
`> **Tests:**` line. It is a pure filesystem check with an exported,
unit-tested core (`findViolations`, `collectSpecFiles`, `lintFiles`) and a
`main()` CLI guarded by the `import.meta.url` idiom. It runs in the husky
pre-commit hook (offline-safe), in `test:all`, and in CI.

This change adds a sibling gate for the GIVEN clause. All 123 existing
scenarios already carry a `- **GIVEN**` bullet (restored on
`docs/restore-given-clauses`), so the gate is green on introduction — its job
is to keep it that way. Alongside the gate we update the project-local
`spec-driven` schema so generated scenarios include GIVEN by default, and we
port the `gherkin-authoring` skill for authoring guidance.

## Goals / Non-Goals

**Goals:**
- Enforce a `- **GIVEN**` clause on every scenario, in baseline and deltas,
  with the same reach and offline-safety as `lint:specs`.
- Make the default-generated scenario include GIVEN so authors don't have to
  remember it.
- Provide authoring guidance (the `gherkin-authoring` skill) for writing GIVEN
  as concrete initial state.
- Reuse the existing gate's structure so the two gates are maintained the same
  way.

**Non-Goals:**
- No changes to application/runtime code (`src/**`), the Gherkin editor, or
  `src/lib/gherkin.ts`.
- Not validating GIVEN *content* quality (e.g. "no UI interaction in GIVEN") —
  that is guidance in the skill, not a mechanical gate. The gate checks
  presence only.
- Not enforcing WHEN/THEN presence (out of scope; the traceability gate and
  this gate already cover the highest-value structural checks).
- Not rewriting the archived flat-vs-nested delta convention.

## Decisions

**1. Clone the traceability gate rather than generalise it.**
`scripts/lint-spec-given-clause.mjs` is a near-copy of
`lint-spec-traceability.mjs` with a different per-scenario predicate. The
`collectMarkdownFiles` / `collectSpecFiles` file-walk logic is duplicated rather
than extracted into a shared module. Rationale: the existing gate is small,
stable, and already unit-tested; a shared abstraction would couple two
independently-evolving gates and expand the review surface. This matches the
established project pattern (`lint-issue-link.mjs` is also standalone). If a
third gate appears, revisit extraction then.

**2. Scan window = from the `#### Scenario:` heading to the next boundary.**
A scenario "owns" every line until the next `#### Scenario:`, `### Requirement:`,
or `## ` heading (or EOF). The gate collects that window and passes if any line
matches the GIVEN predicate. This is more permissive than the traceability
gate's "first non-empty line must match" rule — correctly so, because GIVEN can
legitimately appear after the `> **Tests:**` line and among other bullets, and
may be preceded by `- **GIVEN**` on any bullet line.

**3. GIVEN predicate matches the established bullet form.**
The regex matches a bullet line whose emphasised keyword is `GIVEN`:
`/^\s*[-*]\s*\*\*GIVEN\*\*/`. Every existing scenario uses `- **GIVEN**`, so
this matches the baseline exactly. Case-sensitive uppercase `GIVEN` mirrors the
uppercase `WHEN`/`THEN` convention already in the specs.

**4. Wire into the same three places as `lint:specs`.**
Add `lint:given` to `package.json` scripts, add it to the `test:all` run-p list,
add it to the husky pre-commit hook, and add it to the CI workflow's spec-lint
step. It stays out of the Claude Code commit hook (that hook is reserved for the
network-dependent `lint:issue-link`).

**5. Template/schema edits keep the traceability line ordering.**
In `templates/spec.md` the scenario stub becomes:
```
#### Scenario: <!-- scenario name -->
> **Tests:** <!-- ... -->
- **GIVEN** <!-- initial state -->
- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->
```
The `schema.yaml` `specs` instruction and its inline example gain the GIVEN
line, and `openspec/config.yaml` gains a `specs` rule mirroring the existing
traceability rule.

**6. Port the skill into `.claude/skills/gherkin-authoring/`, with a dialect note.**
This project keeps skills under `.claude/skills/` (e.g. `openspec-propose`), not
`.agents/skills/`. The upstream `SKILL.md` is copied at
`.claude/skills/gherkin-authoring/SKILL.md`. Its authoring *judgment* is
project-agnostic (GIVEN = known initial state, not user interaction; WHEN = one
meaningful event; THEN = an observable outcome; concrete examples over
implementation detail). Its *syntax* reference is not: it describes real Gherkin
(`Feature:`/`Scenario:` with colons, `Given/When/Then` keywords, `.feature`
files), whereas OpenSpec specs use a markdown dialect — `#### Scenario:`
headings with `- **GIVEN**` / `- **WHEN**` / `- **THEN**` bullets, enforced by
`lint:given`. So we append a short provenance-and-dialect note to the ported
skill making clear that in this repo the on-disk format is the bullet dialect,
and the skill is used for its authoring principles.

**7. Wire the skill into the flow via the schema instruction, not just its description.**
A skill's `description` frontmatter is a probabilistic trigger — the agent has
to connect "I'm writing `#### Scenario:` bullets" to "this is Gherkin
authoring." The deterministic lever is the openspec flow itself: `/opsx:propose`
and `/opsx:apply` run `openspec instructions specs` and are told to follow the
`instruction` field (from `schema.yaml`) and apply the `rules` (from
`config.yaml`). So we make the `specs` instruction in `schema.yaml` explicitly
say "invoke the `gherkin-authoring` skill and apply its GIVEN/WHEN/THEN
guidance before authoring scenarios," and add a one-line reinforcement to the
`specs` rule in `config.yaml`. The skill's broad `description` stays as a
backstop for spec edits made outside the flow. This is layered: schema
instruction (primary, in-flow) → config rule (reinforcement) → skill
description (backstop).

## Risks / Trade-offs

- **[Duplicated file-walk logic across two gates]** → Accepted per Decision 1;
  the shared logic is ~20 lines and covered by each gate's own tests. Revisit
  if a third gate lands.
- **[A scenario could satisfy the gate with a GIVEN that is vacuous or in the
  wrong place]** → The gate checks presence, not quality. Mitigation: the
  `gherkin-authoring` skill provides the quality guidance; reviewers enforce it.
- **[Skill drift from upstream]** → The ported `SKILL.md` is a point-in-time
  copy and won't track upstream changes. Mitigation: it is small and stable;
  note its provenance in the tasks so a future sync is intentional.
- **[Regex too strict/loose vs. real bullet styles]** → Mitigated by unit tests
  covering `- **GIVEN**`, `* **GIVEN**`, leading whitespace, and the
  missing-GIVEN case, plus running the gate over the full existing baseline
  (must report zero violations).
