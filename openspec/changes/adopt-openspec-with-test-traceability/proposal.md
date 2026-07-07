## Why

The project already has eight hand-written specs in `docs/spec/` whose scenarios each
carry a `> **Tests:**` traceability line linking the behaviour to its e2e/unit test (or
`none` where untested). We are adopting OpenSpec as the spec-driven workflow, but its
default `spec-driven` schema has no notion of test traceability — a naive migration
would silently drop that habit. We want OpenSpec to *enforce* the traceability link
going forward, as early as authoring a change delta, so coverage gaps stay visible
instead of leaking into the archived baseline.

Investigation confirmed the link survives `openspec validate --strict` and `openspec
archive` untouched (the validator ignores the extra blockquote line and the archive
rewrite preserves it verbatim), so no fork of the package is needed — only a
project-local schema customisation plus a lint gate.

## What Changes

- **Clone the `spec-driven` schema project-locally** into `openspec/schemas/spec-driven/`
  (resolution order puts the project copy first). Edit its scenario template to include a
  `> **Tests:**` stub, and its `specs` artifact instruction to require the line on every
  scenario (with the literal word `none` allowed when no test exists yet).
- **Add a lint gate** (`scripts/lint-spec-traceability`) that scans every `#### Scenario:`
  in both the archived baseline (`openspec/specs/**`) **and** change delta specs
  (`openspec/changes/*/specs/**`) and fails if any scenario is not immediately followed by
  a `> **Tests:**` line. Wire it into the existing `test:all` script.
- **Establish spec-authoring standards as a tracked capability** (`spec-authoring-standards`),
  dogfooding the rule: this change's own spec carries `> **Tests:**` links pointing at the
  lint gate's tests.
- **Migrate the existing `docs/spec/` specs** into OpenSpec capabilities, carrying every
  `> **Tests:**` link across unchanged. (Sequenced after the gate exists so migrated specs
  are validated on arrival.)

Out of scope: the `session-access-control` capability, which is left to the in-flight
`add-session-ownership-authz` change to introduce through its normal lifecycle. That
change's delta spec currently has no `> **Tests:**` lines; bringing it into compliance is
called out as a task here but its behaviour is owned by that change.

## Capabilities

### New Capabilities
- `spec-authoring-standards`: The project's rules for how specs are authored — most
  importantly that every scenario declares its test traceability (`> **Tests:**` link or
  `none`), enforced at both delta-authoring and archived-baseline time.

### Modified Capabilities
<!-- None: no existing specs in openspec/specs/ yet. -->

## Impact

- **Schema:** new `openspec/schemas/spec-driven/` (project-local clone; template +
  instruction edits).
- **Tooling:** new `scripts/lint-spec-traceability` + tests; `package.json` `test:all`
  wiring.
- **Config:** `openspec/config.yaml` gains project context and a `rules.specs` entry
  reiterating the traceability requirement.
- **Docs:** `docs/spec/` specs migrated to `openspec/specs/`; final disposition of the
  originals (delete vs keep as narrative) decided during migration.
- **Behaviour:** authoring or archiving a scenario without a `> **Tests:**` line now fails
  the lint gate. No runtime/application behaviour changes.
- No new production dependencies, no schema changes to the app database, no API changes.
