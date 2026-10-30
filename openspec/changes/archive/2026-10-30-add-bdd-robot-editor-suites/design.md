## Context

The Robot suite (`robot/`) has one technical suite for each Playwright spec.
It also has one business-language pilot, `block_picker_bdd.robot`, whose steps
live in `editor_domain.resource` and which `pnpm lint:robot-steps`
(`scripts/lint-robot-spec-steps.mjs`) checks against
`openspec/specs/**`. The lint matches a test to a scenario by title. It
requires every body line to be a step that states or refines a line of that
scenario, and every line of the scenario to be exercised by at least one
`bdd` test, in any `bdd` suite. Husky and CI already run it.

What we found reading the current code:

- **Title drift.** Robot test names copy the Playwright titles. For
  `SC-3.7.1`, `SC-3.7.2`, `SC-8.3.1` and `SC-8.4.2` those titles are not the
  spec titles, so 11 tests have no matching scenario.
- **Gaps in coverage.** Several technical tests check less than their spec
  lines say: where the cursor goes after Enter or after a toolbar insert, that
  the image lands right after the current block, the image line in an MD
  export, the separator kept out of the export for `SC-3.7.2`, "closes
  without saving", "without a new API call", "the button returns to its
  normal state", and the pre-selected model. Under the lint's coverage rule,
  each of these needs a BDD assertion.
- **Duplication.** The picker selector `[style*="position: fixed"]` is
  defined in `editor_domain.resource`, `data_table.robot` and `image.robot`.
  The image-insert sequence (`Write Tiny PNG`, click Then, toolbar Image,
  upload, wait) appears in `enter_progression`, `image` and `export`. The
  Enter chain from Feature to Then appears in `visual_separation` (as
  `Build Feature To Then`), `enter_progression` and `data_table`. The
  two-line "toolbar button, then click" pattern appears in six suites, and
  `visual_separation` wraps it in a local keyword. `collaboration` defines
  `Open Session Page`, which overlaps `Open Session`. `session.resource`
  mixes API calls, session opening, editor DOM helpers, toolbar helpers,
  contexts, cookies and response waits.
- **Hidden state.** The pilot passes 7 test variables between steps. Each
  one is documented, but an unset variable fails with Robot's generic error.

The user chose: BDD siblings for **all** editor suites, kept **next to** the
technical suites, with a keyword review that also refactors
`session.resource`.

## Goals / Non-Goals

**Goals:**

- One `*_bdd.robot` for each editor-area suite, each passing `lint:robot-steps`
  and `pnpm test:robot`.
- One place, with one name, for each step and each technical helper, so a
  new test author finds the step they need by its spec text.
- One written convention for step naming, refinement and shared state, in
  `robot/README.md`.
- Keyword-reuse figures to answer evaluation doc §6.7.2.

**Non-Goals:**

- Changing app behaviour, `src/lib/gherkin.ts`, or the Playwright suite.
- Strengthening the technical suites or Playwright tests to match the new BDD
  assertions. That is §6.7.6 item 3, a separate decision.
- Changing the spec scenario text. Only `> **Tests:**` lines change. If a
  spec line turns out not to match the app, we stop and report it (see Risks).
- New lint rules. Step order checking and a duplicate-keyword lint stay out
  of scope.
- BDD siblings for `home`, `session_access_control*`, `websocket_auth` and
  `00_smoke`. They are not editor areas.

## Decisions

### D1. BDD suites sit next to the technical suites

Each `<area>_bdd.robot` is new. The technical `<area>.robot` stays and still
holds the Playwright parity row. **Why:** parity (`robot/PARITY.md`, the
requirement "Every Playwright test has a Robot counterpart") stays as it is,
and the evaluation can compare the two forms. **Alternative:** replace the
technical suites. Rejected by the user, and it would also mean rewriting
parity.

### D2. BDD test names use the spec title

Name a test `SC-x.y.z: <spec scenario title>[ — <variant>]`. Variants keep the
technical test's suffix where it has one (for example `— feature → scenario`).
For the four drifted scenarios, the BDD name uses the spec title, for example
`SC-3.7.1: Given after then/and/but gets top border (visual only) — after
then`. **Why:** the lint keys on the spec title. **Alternative:** rename the
spec scenarios to the Playwright titles. Rejected, because it changes
behaviour specs to suit tests.

### D3. One refinement convention

A step either equals its spec line or refines it by appending words after a
single space. The lint already accepts that. Two forms, picked by how the
line ends:

| Spec line ends in… | Refine with | Example |
|---|---|---|
| a noun the detail qualifies | a plain phrase | `Given the cursor is at the end of a block of type Feature` · `…on a new line after Then` (pilot) |
| a full clause (expected values, a branch of an "or" line) | ` — <detail>` | `Then a new block of the auto-progression type is inserted immediately after the current block — Scenario` · `When the user clicks "Cancel" or presses Escape or clicks outside the panel — Escape` |

Multi-line test data, such as import texts, lives in the suite's
`*** Variables ***`. A step refers to it with `with ${NAME}`, for example
`Given the user pastes or types Gherkin text into the textarea and clicks
Insert with ${MARKDOWN_PREFIXED}`. A keyword with an embedded argument
receives the value.

**Why:** a reader sees the concrete case in the test itself, and expected
values are not hidden in keywords. **Alternative:** Scenario Outlines in the
specs. That is a better long-term fix (§6.7.5), but it changes the specs and
is out of scope.

Expected values are test data, never rules. A step MUST NOT work out an
expected block type from a progression or `canFollow()` table of its own,
because that would copy `src/lib/gherkin.ts`. The expected type comes from
the refinement in the test. The one exception is valid-next lists, which
come from the shared dictionary in D4.

### D4. Valid-next expectations live in one dictionary

The picker Then step (pilot) and the toolbar Then step both check "valid next
blocks for the current block, according to `canFollow()`". The pilot keeps
`@{VALID_AFTER_FEATURE}` / `@{INVALID_AFTER_FEATURE}` inside its resource.
These become one dictionary in `steps/gherkin_editor.resource`:
`&{VALID_NEXT_LABELS}` / `&{INVALID_NEXT_LABELS}`, keyed by block type and
filled only for the contexts the tests visit (Feature, plus Then for the
Image check). The values come from the technical tests. Both Then steps read
it, and they fail with a clear message for a context that has no entry.
**Why:** one place for the data, and no rule logic.

### D5. Resource layout

```
robot/resources/
  common.resource        Browser import, suite/test setup (unchanged)
  variables.resource     globals (unchanged)
  api.resource           RequestsLibrary (unchanged)
  files.resource         temp files, downloads (unchanged)
  session.resource       sessions + page API + contexts + cookies + response waits
  editor.resource        NEW: editor selectors and DOM helpers
  steps/
    shared.resource            steps whose text is in >1 capability
    gherkin_editor.resource    from editor_domain.resource + new editor steps
    gherkin_export.resource
    gherkin_import.resource
    realtime_collaboration.resource
    llm_review.resource
```

Rules, written into `robot/README.md`:

- **Where a step goes**: look up which `openspec/specs/<capability>/` holds
  the line. If the text appears in more than one capability, the step goes in
  `steps/shared.resource`. Each `steps/<cap>.resource` imports
  `shared.resource`, `editor.resource` and `session.resource`. A BDD suite
  imports `common.resource` and the `steps/` files it uses.
- **Where a helper goes**: by what it touches. `editor.resource` gets editor
  selectors, blocks, toolbar, picker, image insertion and tables.
  `session.resource` gets the session lifecycle, the page API, contexts,
  cookies and response waits.
- **Naming**: steps are lower-case sentences, copied from the spec line.
  Helpers are Title Case verb phrases (`Insert Image After Block`).
- **Synonyms**: when two spec lines mean the same thing
  (`a user is in a session editor` / `a user is on a session page`), the
  second keyword calls the first. Its `[Documentation]` says so.

Moves out of `session.resource` into `editor.resource`:
`Press Enter And Wait For Block`, `Type Into Block`, `Click Editor`,
`Block Types In Editor`, `Last Index Of`, `Texts Of All`,
`Toolbar Button Texts`, `Toolbar Button`. New shared helpers in
`editor.resource`, which replace the duplicates listed in Context:

| Helper | Replaces |
|---|---|
| `${PICKER}`, `${BLOCKS}`, `${IMAGE_BLOCK}`, `${TABLE}`, `Block Selector    ${type}` | local `${PICKER}` ×3, `[data-gherkin-type="…"]` literals |
| `Click Toolbar Button    ${label}` | `Toolbar Button` + `Click` pairs, `visual_separation`'s local keyword |
| `Build Scaffold To Then` | `Build Feature To Then`, the Enter chains in `enter_progression` / `data_table` |
| `Insert Image After Block    ${type}` | the three image-insert sequences |
| `Put Cursor At End Of Block    ${type}` | Click + End sequences. Reaches and/but/background/rule through the toolbar, the rest through Enter |
| `Remember Editor` (was `Remember Blocks`; also replaces the import and image snapshots), `Close Picker If Open` | moved from `editor_domain.resource` |
| `Open Session Page    ${id}` | moved from `collaboration.robot` into `session.resource`; `Open Session` calls it |

`Require Step State` (D6) goes in `steps/shared.resource`, in its technical
helpers section.

When a technical suite is moved onto these helpers, its assertions stay
exactly as they are. Only the setup and action lines change.

### D6. Shared state contract

- Each step keyword's `[Documentation]` ends with `Sets:` and/or `Reads:`
  lines that list its test variables.
- Each `steps/*.resource` header lists every variable its keywords set, with
  a one-line meaning.
- A step that reads state starts with
  `Require Step State    ${NAME}    <step that sets it>`. That fails with
  `"<step>" must run before this step (${NAME} is not set)`.
- Variable names are UPPER_SNAKE and describe the state, not the step
  (`${BLOCKS_BEFORE}`, `${FOCUSED_INDEX}`).

**Why:** this is the §6.5 cost the pilot noted. The failure message turns a
hidden dependency into an instruction. **Alternative:** return values passed
through the test. That is not possible, because BDD test bodies can hold
steps only.

### D7. Counting route requests

Add `fulfillCountedRoute(url, status, body, method)` and
`routeRequestCount(url)` to `robot/libraries/routes.cjs`. They are keyed per
page, like `held`. `clearRoutes` resets the counts. "Without a new API call"
is then asserted as `Route Request Count == 1` once the reopened modal shows
the result. **Why:** Browser's `Wait For Request` can prove that a request
happened, but not that one didn't, and the lint forbids fixed waits.
**Alternative:** listen for `page.on("request")`. Rejected: more code, same
semantics.

Counts are kept per URL and request method; `routeRequestCount(url, method)`
reads one method or, without `method`, all. Requests that `holdRoute` holds
count too, so a held review is not invisible to the count. Registering the
same counted route again replaces its handler and keeps the count. A handler
registered for one `method` hands other methods to the earlier route
(`route.fallback()`), so routes for one URL and different methods compose.

### D8. Then steps assert the browser-visible part

Where a spec line describes a server-side effect, the Then step asserts the
part the browser can see, and its `[Documentation]` says where the boundary
is. Examples:

- `SC-8.1.1`, "content is sent to the resolved model via the OpenRouter
  gateway": wait for the `POST /api/llm-review` request and check that its
  body carries the editor's current content. The model resolution and the
  OpenRouter call are covered by the API unit tests.
- `SC-8.3.4`, "becomes enabled, showing the session's stored model": the held
  settings GET returns a **non-default** model (the second entry of
  `AVAILABLE_MODELS`), so the check can tell "stored" apart from "default".
- `SC-3.8.x`, "a file picker opens": arm `Promise To Upload File` before the
  click. That fails if no file chooser opens, which is stronger than
  `Upload File By Selector`.
- `SC-8.4.3`, "closes without saving": reload the page, reopen the prompt
  and check that it shows the prompt from before the edit. Reopening without
  a reload is not enough: the page keeps the unsaved text in its state, so
  the textarea shows the edit again until the page reloads.

If nothing in a line can be seen from the browser (`SC-8.4.2`, "the next
review uses the updated prompt"), the scenario is excluded (D9).

### D9. Exclusions

| Technical test | Reason | BDD |
|---|---|---|
| `SC-3.7.1 — first given after scenario has no border` | No scenario line describes a Given after Scenario | none |
| `SC-3.11.1 — absent on Feature` | No line describes the cursor on Feature | none |
| `SC-8.3.1 — expected models listed` | No line describes the model list | none |
| `SC-8.4.1 — button visible` | Covered by the full `SC-8.4.1` test | none |
| `SC-8.1.1 — modal opens` | Covered by `SC-8.1.2`, "the result is displayed in a modal" | none |
| `SC-8.4.2` | "the next review uses the updated prompt" cannot be observed in the browser | none |
| `SC-3.5.2` | Skipped: no stable collaboration-cursor extension | none |
| `SC-3.2.2` | The app does not satisfy the Given: the image node is `selectable: false`, so the cursor is never on an image and Enter inserts before it (issue #53) | none until #53 is fixed |
| `SC-3.8.3` | The app does not satisfy "at the drop position": the drop handler ignores the drop coordinates (issue #54) | none until #54 is fixed |
| `SC-3.11.2` | The app does not satisfy "the cursor is placed inside the first cell": focus stays in the main editor (issue #55) | none until #55 is fixed |

BDD-only tests, with no technical twin: `SC-3.7.2 — separator not in export`
and `SC-3.9.1 — image inline`. Both exist because of the coverage rule. The
suites added more for spec lines with several branches; `robot/PARITY.md`
lists them all.

### D10. Delivery in chunks

Each chunk is complete only when `pnpm lint:robot-steps`, `pnpm lint:robot`,
`pnpm lint:specs` and `pnpm test:robot` all pass:

0. Refactor: `editor.resource`, the split of `session.resource`, `steps/`,
   `Require Step State`, `routes.cjs` counting, technical suites and the
   pilot moved over. No new tests.
1. `initial_content_bdd`, `enter_progression_bdd`, `toolbar_bdd`
2. `visual_separation_bdd`, `image_bdd`, `data_table_bdd`
3. `export_bdd`, `import_bdd`
4. `collaboration_bdd`
5. `llm_review_bdd`
6. Docs, `PARITY.md`, `Tests:` lines, reuse figures

The `Tests:` line for each scenario is updated in the chunk that covers it.
Because of the lint's coverage rule, a scenario's BDD tests must all land in
the same chunk. The one exception is `SC-3.1.2`, whose "seed is applied
exactly once" line is only covered in chunk 4. So its BDD tests in chunk 1
include the second-joiner test in `initial_content_bdd`, rather than waiting
for `collaboration_bdd`. Chunk 4 then covers only `SC-3.5.1`.

## Risks / Trade-offs

- [A spec line the app does not satisfy, for example "the cursor is placed
  inside the first cell" (`SC-3.11.2`) or "at the drop position"
  (`SC-3.8.3`): the technical tests never checked them] → The first task of
  each chunk confirms these lines against the app. If one does not hold,
  stop and report it, as an app bug or a spec fix. Never weaken the step.
- [The synthetic drop event may not carry coordinates the editor uses] →
  Read the drop handler first. If it takes the position from the event,
  dispatch the drop at a known block's coordinates and check that the image
  lands next to it. Otherwise this becomes an open question for the user.
- [Total code grows again (§6.7.1: about 2× per area)] → Accepted. The
  refactor in chunk 0 and the reuse figures in §6.7.2 measure whether reuse
  pays for it.
- [Suite run time grows by about 45 s] → Accepted. Tag selection
  (`--exclude bdd`) is available for local runs.
- [Moving keywords breaks a suite's imports] → Chunk 0 is gated on a full
  `pnpm test:robot` before and after, with the same pass/skip counts.
- [The `SC-3.1.2` second-joiner test opens two contexts but lives in
  `initial_content_bdd`, not `collaboration_bdd`] → Its keyword uses
  `Open Second Context` from `session.resource`, the same isolation as the
  collaboration tests. The suite's documentation says why it is there.

## Migration Plan

Test-only change. No deploy steps. Rollback is a revert of the chunk's
commit. Chunk 0 leaves the suite at the same test count, so it can be
reverted alone.

## Open Questions

- `SC-3.8.3` "at the drop position": answered. The editor ignores the drop
  position. The user chose to exclude the scenario and open an app bug
  (#54). The same choice was made for `SC-3.2.2` (#53) and `SC-3.11.2` (#55),
  whose lines the app also does not satisfy (see D9).
- Should the four-plus new strong assertions go back into the technical and
  Playwright suites? Out of scope here (§6.7.6 item 3), but the change will
  list them in `PARITY.md` so that decision can be made.
