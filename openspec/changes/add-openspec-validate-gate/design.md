## Context

The repo has its own spec gates. `lint:specs` checks the `> **Tests:**` lines
and `lint:given` checks for a GIVEN clause. Both run in the husky pre-commit
hook, `test:all` and CI. OpenSpec's own structural validator,
`openspec validate`, runs only when someone types it.

On today's tree (18 main specs and 1 active change):

| Mode | Result |
| --- | --- |
| `openspec validate --all --no-interactive` | 19 passed, exit 0. Warnings are printed but do not fail the run |
| `openspec validate --all --strict --no-interactive` | 14 failed, exit 1, on 29 warnings |

The 29 warnings:

- **Purpose placeholder (5):** `code-formatting`, `code-linting`,
  `crap-metric`, `dependency-maintenance`, `robot-e2e-suite`. `openspec archive`
  writes `TBD - created by archiving change <name>. Update Purpose after
  archive.` when it creates a capability, and nobody replaced it.
- **Requirement text over 500 characters (24):** in
  `change-issue-traceability`, `data-model`, `gherkin-document-model`,
  `gherkin-editor`, `gherkin-import`, `llm-review`, `realtime-collaboration`,
  `robot-e2e-suite`, `session-access-control` and `spec-authoring-standards`.
  The worst are `robot-e2e-suite`'s "Robot tests preserve the Playwright
  suite's robustness techniques" (about 1,800 characters) and `llm-review`'s
  "POST /api/llm-review" (about 1,200).

The CLI comes from a global pnpm install (`openspec` 2.0.0 on the developer's
machine). It is not in `package.json`, so CI has no `openspec` binary. The
package `@fission-ai/openspec@2.0.0` has no install scripts, so it needs no
`allowBuilds` entry. It sends telemetry unless `OPENSPEC_TELEMETRY=0` or
`DO_NOT_TRACK=1` is set. A strict run over the whole tree takes about 0.25 s.

`lint:robot-steps` matches each business-language Robot test to the spec
scenario with the same title, and checks its steps against that scenario's
GIVEN/WHEN/THEN lines. Any change to a scenario's title or step text could
break that gate or the traceability links.

## Goals / Non-Goals

**Goals:**

- `openspec validate --all --strict` passes on the tree and fails a commit,
  `test:all` run or CI run that introduces an error or warning.
- Every environment runs the same pinned CLI version.
- The gate stays offline-safe, so it can sit in pre-commit next to
  `lint:specs`.
- The 29 existing warnings are cleared without changing what any spec
  requires.

**Non-Goals:**

- `openspec validate --archived` (checks that archived changes have every task
  ticked). It passes today (22 of 22) and could be added later, but it guards a
  different thing.
- Rewriting spec content beyond what the 29 warnings need.
- Replacing `lint:specs` or `lint:given`. OpenSpec's validator does not check
  for `> **Tests:**` lines or GIVEN clauses, so all three gates stay.
- Changing how `openspec archive` writes Purpose for new capabilities. That is
  upstream behaviour; this gate makes the archive commit fix it.

## Decisions

### D1. Strict mode, with every warning cleared in this change

Run with `--strict`, so warnings fail the gate.

- **Why:** Without `--strict` the gate passes on today's tree and would not
  have caught the `crap-metric` placeholder that prompted this change. Errors
  only appear for broken structure (a missing `## Requirements`, a requirement
  with no scenario), which `lint:specs` and authoring habits already mostly
  prevent.
- **Alternatives considered:**
  - Run without `--strict` now and switch later. This adds a gate that catches
    almost nothing until the follow-up lands.
  - Write a wrapper that fails on Purpose placeholders but tolerates the
    500-character warning. That is extra code to maintain, and it filters
    OpenSpec's output by message text, which can change between releases.

### D2. Pin the CLI as a devDependency and call it through a package script

Add `@fission-ai/openspec` (`^2.0.0`, the latest stable, per ADR 0004) to
devDependencies, and add:

```json
"lint:openspec": "OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive"
```

- pnpm puts `node_modules/.bin` first on `PATH` for scripts, so the script runs
  the pinned CLI even when a global one is installed.
- `OPENSPEC_TELEMETRY=0` keeps the gate offline. The `VAR=value cmd` form runs
  under the POSIX `sh` that pnpm and husky use on macOS and Linux, the only
  platforms this project uses.
- `--no-interactive` stops the CLI prompting when it has no TTY (in CI, or in
  a hook run from a GUI git client).
- Dependabot keeps the pin current, like any other devDependency.

### D3. Wire it in next to `lint:given`

- `.husky/pre-commit`: `pnpm run lint:openspec` after `lint:given`, with a
  comment in the existing style (whole tree, pure filesystem, no network).
- `test:all`: add `lint:openspec` to the `run-p` lint group.
- CI: a `Lint specs (openspec validate)` step after `Lint specs (given clause)`.
  CI's `paths` filters already include `openspec/**` and `package.json`.
- A wiring test in `scripts/openspec-validate-config.test.ts` asserts the
  script's exact command, that `test:all` includes it, that
  `.husky/pre-commit` runs it, and that `ci.yml` has a step running
  `pnpm run lint:openspec`. This follows the "lint wired into lint-staged, CI
  and test:all" case in `scripts/oxlint-config.test.ts`. The same file runs the
  pinned CLI on fixture trees to pin the two failing scenarios: a placeholder
  Purpose and a requirement over 500 characters, each in a temporary
  `openspec/` root, each expected to exit non-zero and name the spec.

### D4. Edit the 14 affected main specs in place, not through delta specs

The Purpose rewrites and requirement trims go straight into
`openspec/specs/<capability>/spec.md`.

- **Why:** OpenSpec reads a delta's `## Purpose` only when it creates a
  capability. The validator's own message says to fix an existing Purpose by
  editing the main spec. For the 24 long requirements, a `MODIFIED` delta has
  to copy each whole requirement block, all scenarios included, into the change.
  That would duplicate thousands of lines and risk a bad merge at archive time,
  only to change no behaviour. The only behaviour this change adds, the gate,
  goes through a normal delta on `spec-authoring-standards`.
- **Rules for the trims**, so "editorial" stays true:
  1. No scenario is added, removed, renamed or reworded. Each `#### Scenario:`
     block, `> **Tests:**` line included, stays byte-identical. A scenario may
     move to a new requirement when one is split, but its scenario group stays
     intact.
  2. No SHALL, MUST or SHALL NOT statement is dropped. A long requirement is
     shortened by cutting restatement and examples the scenarios already show,
     or by splitting it into narrower requirements, each with the scenarios
     that exercise it.
  3. A split keeps the original requirement name for one of its parts, so
     links and searches for the name still land.
  4. Each requirement's text, measured as the validator measures it, ends up
     at 500 characters or fewer.
- **One exception, recorded here:** `robot-e2e-suite`'s "Step keywords are
  organised by spec capability" has one scenario, so it cannot be split, and
  trimming it below 500 characters would drop its naming example or its
  selector-variable rule. Its sentence "Step keywords MUST be lower-case
  sentences; technical helpers MUST be Title Case and MUST NOT appear in a
  `bdd` test body" moves, unchanged, to "Business-language tests follow their
  spec scenario", next to the rule on what a `bdd` test body may contain.
- **Verification:** before editing, a scratch script captures every scenario
  block across `openspec/specs/` into a sorted list. After editing, the list
  must match exactly. `lint:specs`, `lint:given`, `lint:robot-steps` and
  `lint:e2e-parity` must still pass.
- **Alternative considered:** one `MODIFIED` delta per affected capability.
  Rejected for the duplication and merge risk above.

### D5. Purpose text

Each new Purpose is two to four sentences saying what the capability is for
and what it covers, in the style of `spec-authoring-standards`. It is written
from that spec's requirements and the archived change that created it, and
claims nothing those sources don't say.

## Risks / Trade-offs

- [A new OpenSpec release adds a warning type and the gate goes red on an
  unchanged tree] → The pin means this only happens on a Dependabot bump PR,
  where CI shows it before merge. Fix the specs in that PR, or hold the bump.
- [Pre-commit now blocks a commit of a half-written change whose delta has a
  warning] → Intended: the same rule already applies to `lint:specs` and
  `lint:given`. The delta must be valid before it is committed.
- [`openspec archive` keeps writing a TBD Purpose for new capabilities] → The
  archive commit fails pre-commit until the Purpose is written. That is the
  point. The archive skill already prints this warning.
- [In-place spec edits skip the delta review step] → Bounded by D4's rules and
  the before/after scenario check. The reviewer agent sees the diff before
  commit.
- [Splitting requirements changes `requirements[n]` indexes] → Nothing in the
  repo refers to requirements by index. Robot tests and `> **Tests:**` links key
  on scenario titles, which do not change.

## Migration Plan

1. Land this change. The gate starts green.
2. On the next `openspec archive` that creates a capability, replace the TBD
   Purpose before committing.

Rollback: remove the script, hook line, CI step and devDependency. The spec
edits can stay; they are valid without the gate.

## Open Questions

None.
