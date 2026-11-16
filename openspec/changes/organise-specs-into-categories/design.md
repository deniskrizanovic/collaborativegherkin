## Context

`openspec/specs/` holds 18 capability folders at one level. OpenSpec 2.0
supports nested spec folders. We checked this in a scratch repo: at depths 2
and 3, mixed, `list --specs`, `show <path-id>`, `validate --all --strict` and
`archive` (ADDED and MODIFIED deltas at nested paths) all work. The spec id is
the path relative to `specs/`, e.g. `product/gherkin/gherkin-editor`.

The existing gates already scan recursively. `lint:specs` and `lint:given`
walk `openspec/specs/**` and `openspec/changes/*/specs/**` with
`collectMarkdownFiles`, and `lint:robot-steps` matches scenario titles, not
paths. None of them needs changing.

Moving the specs breaks the links, though. The 339 local links in main specs
are relative (`../../../scripts/...`), and 20 already point at nothing:

- `change-issue-traceability` links to a change path that has since been
  archived.
- `session-access-control` uses five `../` segments, copied from delta depth
  (`openspec/changes/<c>/specs/<cap>/`), which climb above the repo root.
- A few bare `src/...` targets resolve against the spec's own folder.

Archive copies delta text as written, and a delta always sits two levels deeper
than its main spec. Relative links therefore break at every archive, whatever
the folder layout.

Owner decisions from the explore session are recorded on issue #74.

## Goals / Non-Goals

**Goals:**
- Group main specs into `product/{gherkin,sessions}/`, `quality/` and
  `process/`.
- Make every spec link valid now, and keep it valid when specs move and
  changes are archived.
- Fail fast, offline, when a spec is uncategorised or a link dangles.
- Point authors and agents at the new paths: schema, template, config rules
  and `CLAUDE.md`.

**Non-Goals:**
- Renaming capabilities or rewriting requirement text, beyond link targets.
- Editing `openspec/changes/archive/**`.
- Changing app code, tests' behaviour, or how scenario titles map to Robot
  tests.
- Restructuring `docs/spec/` (legacy redirects; only their path headers
  change).

## Decisions

### D1: Domain categories, with `product/` split in two

```
product/gherkin/   gherkin-document-model, gherkin-editor, gherkin-export,
                   gherkin-import, llm-review, realtime-collaboration
product/sessions/  session-management, session-access-control, sessions-api,
                   data-model
quality/           code-formatting, code-linting, crap-metric, robot-e2e-suite,
                   test-auth-bypass, dependency-maintenance
process/           spec-authoring-standards, change-issue-traceability
```

Judgment calls:
- `llm-review` goes in gherkin because it critiques Gherkin content.
- `data-model` goes in sessions because it covers only Session and User
  persistence.
- `test-auth-bypass` goes in quality because it exists so e2e tests can sign
  in.
- `dependency-maintenance` goes in quality to avoid a `tooling/` folder with a
  single spec.

Alternatives considered:
- Split by audience (product / engineering / process): `product/` would hold
  most of the specs and need splitting again.
- A flat domain split with no `product/` level: the owner wanted product
  grouped above gherkin and sessions.

### D2: Keep leaf names; pure `git mv`

Each spec folder keeps its name, e.g. `product/gherkin/gherkin-editor`. Git
rename detection and `git log --follow` stay clean, and `rg gherkin-editor`
still finds every mention in Robot docs, `PARITY.md` and `docs/spec`. Trimming
names (`product/gherkin/editor`, `product/sessions/api`) would leave ambiguous
bare words in prose and double the churn.

### D3: Repo-root links (`/path/from/repo/root`)

GitHub resolves a link starting with `/` from the repository root. VS Code's
Markdown preview resolves it from the workspace root. Such a link does not
depend on the depth of the file it sits in, so it survives this move, future
moves, and archive copying delta text into a shallower main spec.

Alternatives considered:
- Recompute the relative `../` depth for each spec: smallest diff, but every
  archive keeps breaking links.
- Leave links broken: the Tests lines would still read as text, but click
  through to nothing.

### D4: One-time rewrite resolves each link against its *current* file

A throwaway rewrite script, which is not committed, handles each local link
(not `http:`, `https:`, `mailto:` or `#`) as follows:

1. Resolve the target against the spec's current location. If it exists,
   rewrite it to `/` plus the repo-relative path.
2. Otherwise, if the link text is a code-span path (`` [`scripts/x.test.ts`](...) ``)
   that exists from the repo root, use `/` plus that path. This repairs the
   `change-issue-traceability` and `session-access-control` cases, where the
   text names the test file.
3. Otherwise, list the link for manual repair.

The rewrite runs **before** the `git mv`, while relative targets still resolve
from their original folders. The moves then need no further link edits. Any
`#fragment` is kept.

### D5: `lint:spec-layout` gate: one script, two checks

`scripts/lint-spec-layout.mjs` follows the shape of the sibling gates: exported
pure functions plus a thin `main`, with tests in
`scripts/lint-spec-layout.test.ts`.

- **File set:** reuse `collectSpecFiles` from `lint-spec-traceability.mjs`.
  It returns main specs plus unarchived change deltas and skips `archive/`.
- **Layout check:** take each `spec.md` path relative to its `specs/` root.
  The first segment must be in `CATEGORIES = ["product", "quality", "process"]`
  and at least one capability folder must follow. The allowlist is a constant
  in the script, so adding a category is a reviewed code change, not a config
  tweak.
- **Link check:** scan lines outside fenced code blocks for inline links
  `[text](target)`. Skip external links and pure anchors. Strip `#fragment`
  and URL-decode the target. A target that does not start with `/` is a
  violation that asks for the repo-root form. A `/` target must exist under
  the repo root. Targets may contain `[id]`, as in
  `/src/app/api/sessions/[id]/route.test.ts`, so the target pattern is
  "everything up to the closing `)`", not a strict path grammar.
- **Output:** list each violation by file and line, with the target or the
  allowed categories, then exit non-zero. On success, print a one-line `✓`
  summary, like the siblings.
- **Wiring:** a `package.json` script, added to the `run-p` list in
  `test:all`, a step in `.husky/pre-commit` next to `lint:specs` with a
  comment, and a CI step next to `lint:specs`. The test file asserts all
  three, as `openspec-validate-config.test.ts` does for `lint:openspec`.

Alternative considered: folding both checks into `lint:specs`. Rejected
because it mixes concerns. Each existing gate enforces one rule and has its
own requirement.

### D6: Move the active `add-dependabot-automerge` delta with the specs

Its last task (5.3) waits on an external Dependabot event, so the change cannot
be archived first. Its delta moves to
`specs/quality/dependency-maintenance/spec.md` in the same commit, and its
links get the D4 rewrite. Once moved, it validates against the moved main spec.

### D7: Point the workflow and docs at category paths

- `openspec/schemas/spec-driven/schema.yaml` (the `proposal` and `specs`
  instructions) and `templates/proposal.md`: replace
  `openspec/specs/<capability>/` with the category path. Tell authors to
  preserve an existing capability's full path, and to place a new capability
  under `product/`, `quality/` or `process/`.
- `openspec/config.yaml` `rules.specs`: add a rule that spec links use
  repo-root targets and specs sit under a category, enforced by
  `lint:spec-layout`.
- `CLAUDE.md`: one line on the category layout, next to the OpenSpec section.
- `docs/spec/0*.md` headers, `robot/README.md`, `robot/PARITY.md` and the Robot
  `Documentation` lines: rewrite `openspec/specs/<cap>` to the new path. These
  are comments only, so no Robot behaviour changes.
- `scripts/biome-config.test.ts:112`: update the path fixture. The test
  checks that Biome ignores Markdown, so the file must exist.
- `robot/results/` is git-ignored output, so it is left alone.

## Risks / Trade-offs

- [This change's own delta sits at `process/spec-authoring-standards` before
  the main spec moves there. Archiving before the move would create a second
  spec.]
  → In the task order, the move comes first and the archive last. The
  `validate --strict` run after the move confirms that the delta targets an
  existing spec.
- [Other branches that still hold flat deltas fail `lint:spec-layout` after
  rebase.]
  → Intended. The fix is a `git mv` of the delta, and the gate message names
  the allowed categories.
- [Some Markdown viewers don't resolve `/` links, e.g. preview tools outside
  GitHub and VS Code.]
  → GitHub is the reference renderer. Link text stays the readable path, so
  the Tests line still makes sense as text.
- [Old spec ids (`openspec show gherkin-editor`) stop working in habits,
  memory notes and docs.]
  → `CLAUDE.md`, the schema and the template carry the new form. `openspec
  list --specs` shows the ids.
- [The D4 rewrite could mis-resolve a link.]
  → After the rewrite, the new gate's link check must pass on the whole tree,
  and any manual-repair cases are reviewed by hand.

## Migration Plan

Single branch, single merge. Steps, in order:

1. Rewrite the links in place.
2. `git mv` the main specs and the active delta.
3. Add the gate and wire it.
4. Update docs and config.
5. Run every spec gate plus `lint:openspec`.

There is no production impact. To roll back, revert the merge commit.

## Open Questions

None blocking. Moving a capability between categories later is a `git mv`
that the gate accepts, so the D1 membership is cheap to revise.
