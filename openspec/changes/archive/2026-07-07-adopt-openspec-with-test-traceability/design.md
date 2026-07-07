## Context

The project has eight hand-authored specs in `docs/spec/` (`01-session-management`
through `08-llm-review`, plus non-spec docs `06-out-of-scope` and
`99-Cosmic-Point-Count`). Each scenario is written as `#### SC-x.y.z <title>` followed by
a `> **Tests:**` blockquote linking the e2e/unit spec (or `none`) and Given/When/Then
prose. OpenSpec 1.4.1 is initialised (`openspec/config.yaml`, schema `spec-driven`), with
one in-flight change (`add-session-ownership-authz`) and an empty `openspec/specs/`.

OpenSpec's `spec-driven` schema expresses specs as `### Requirement:` (SHALL/MUST prose)
containing one or more `#### Scenario:` blocks with `- **WHEN** / - **THEN**` bullets. It
has no native concept of test traceability.

Empirically verified against the installed CLI (1.4.1):
- A `> **Tests:**` line placed between `#### Scenario:` and its WHEN/THEN bullets passes
  `openspec validate --strict` (exit 0).
- `openspec archive` reparses and rewrites the spec into `openspec/specs/` with the
  `> **Tests:**` line preserved verbatim.
- Schema resolution order is project-local first:
  `<project>/openspec/schemas/<name>/` → `$XDG_DATA_HOME/openspec/schemas/<name>/` →
  `<package>/schemas/<name>/`. So a project-local clone overrides the built-in with no
  package fork.
- The validator does **not** require the `> **Tests:**` line; enforcement must come from
  the artifact instruction (AI-facing) plus a lint gate (machine-facing).

## Goals / Non-Goals

**Goals:**
- Preserve the existing scenario→test traceability habit through the full OpenSpec
  lifecycle (author → validate → archive).
- Enforce the `> **Tests:**` line as early as possible — at change-delta authoring time,
  not just on the archived baseline.
- Provide a real machine gate (fail non-zero) wired into `test:all`, in addition to
  AI-facing instructions.
- Migrate the eight existing specs into OpenSpec capabilities, carrying every link across.

**Non-Goals:**
- Introducing the `session-access-control` capability — owned by the in-flight
  `add-session-ownership-authz` change.
- Changing any application runtime behaviour, DB schema, or API surface.
- Deciding the final fate of `docs/spec/` up front (delete vs keep-as-narrative) — decided
  during migration once converted output can be compared side-by-side.

## Decisions

**Decision 1 — Clone the schema project-locally rather than fork the package or use only config rules.**
Copy `<package>/schemas/spec-driven/` into `openspec/schemas/spec-driven/` and edit the
scenario template + `specs` instruction there. Rationale: checked into git, versioned with
the project, survives package upgrades, and stronger than `config.yaml` rules alone
(the stub appears in the literal skeleton the AI fills). Alternatives considered:
(a) config `rules.specs` only — kept *as well* for belt-and-suspenders, but too weak alone
since it does not shape the template; (b) forking the npm package — rejected, unmaintainable.

**Decision 2 — Machine enforcement via a standalone lint script, not the OpenSpec validator.**
`openspec validate` cannot be extended to require the line, so add
`scripts/lint-spec-traceability` that greps every `#### Scenario:` for a following
`> **Tests:**` line. Rationale: keeps enforcement in the project's own test tooling
(consistent with commit `ed43dfd` adding lint/typecheck to `test:all`); no dependency on
OpenSpec internals.

**Decision 3 — Gate change deltas as well as the archived baseline.**
The gate scans both `openspec/specs/**` and `openspec/changes/*/specs/**`. Rationale:
catch a missing link while proposing, before it can be archived. Trade-off: this will flag
the existing `add-session-ownership-authz` delta spec, whose four scenarios currently have
no `> **Tests:**` lines. Handled explicitly as a task — that change's scenarios get
`none` (or real links) so the gate goes green; the *behaviour* remains owned by that change.

**Decision 4 — `none` is required, not optional, for untested scenarios.**
An absent line and an overlooked line are indistinguishable, so the gate treats absence as
a failure and requires the explicit `none` marker. Rationale: makes coverage gaps a visible,
greppable inventory rather than silent holes.

**Decision 5 — Migrate specs only after the gate exists.**
Build schema + gate first, then convert `docs/spec/`. Rationale: every migrated capability
is validated by the gate on arrival, so no untraceable scenario slips in during the bulk
conversion. Capability mapping (one Requirement per `##` section, one Scenario per `SC-`):
`session-management`, `gherkin-document-model`, `gherkin-editor`, `realtime-collaboration`,
`gherkin-export`, `sessions-api` (only `04-api` 4.1/4.2 collection endpoints — 4.3/4.4
belong to `session-access-control`), `gherkin-import`, `llm-review`, `data-model`.
`06-out-of-scope` and `99-Cosmic-Point-Count` are not capabilities.

## Risks / Trade-offs

- **Gate flags the existing in-flight change delta** → Mitigation: add `none`/real links to
  `add-session-ownership-authz`'s scenarios as an explicit task; do not silence the gate.
- **Relative `> **Tests:**` link paths differ between `docs/spec/` and `openspec/specs/`
  depths** → Mitigation: recompute relative paths during migration; the gate checks for the
  line's presence, not link resolvability (a separate, optional broken-link check could
  follow later).
- **Project-local schema clone drifts from upstream `spec-driven` on OpenSpec upgrades** →
  Mitigation: the clone is small and diffable; note the base version and re-diff on upgrade.
- **`none` can be abused to blanket-pass untested specs** → Accepted: `none` is greppable,
  so coverage debt stays auditable rather than hidden.
