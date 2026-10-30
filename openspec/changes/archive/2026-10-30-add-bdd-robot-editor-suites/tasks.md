## 0. Baseline

- [x] 0.1 Confirm work is on a feature branch, not `main` (`git branch --show-current`). If on `main`, ask the user to create one before editing
- [x] 0.2 Run `pnpm test:robot` and record the pass/skip counts (expected 116 tests: 115 passed, 1 skipped) as the chunk 0 baseline

## 1. Chunk 0 — technical helpers (design D5)

- [x] 1.1 Create `robot/resources/editor.resource` with the shared selector variables `${PICKER}`, `${BLOCKS}`, `${IMAGE_BLOCK}`, `${TABLE}` and `Block Selector    ${type}`
- [x] 1.2 Move `Press Enter And Wait For Block`, `Type Into Block`, `Click Editor`, `Block Types In Editor`, `Last Index Of`, `Texts Of All`, `Toolbar Button Texts`, `Toolbar Button` from `session.resource` to `editor.resource`. Keep the documentation, and say in each where it came from in `helpers.ts`
- [x] 1.3 Add `Click Toolbar Button`, `Build Scaffold To Then`, `Insert Image After Block    ${type}` (uses `files.resource`), `Put Cursor At End Of Block    ${type}`, and move `Remember Blocks` and `Close Picker If Open` in from `editor_domain.resource`
- [x] 1.4 Move `Open Session Page` from `collaboration.robot` into `session.resource`, and make `Open Session` call it and then click Feature
- [x] 1.5 Rewrite the `session.resource` header to state its scope (sessions, page API, contexts, cookies, response waits), and the `editor.resource` header to state its own
- [x] 1.6 Switch each technical suite to the shared helpers and selectors: drop the local `${PICKER}` (`data_table`, `image`), `Build Feature To Then` / `Click Toolbar Button` (`visual_separation`), `Open Session Page` (`collaboration`), and the inline image-insert and Enter-chain sequences (`enter_progression`, `export`, `data_table`). Add `Resource    ../resources/editor.resource`. Leave every assertion line unchanged
- [x] 1.7 Search `robot/` for `[style*="position: fixed"]` and the other moved selector literals, and confirm each is defined only in `editor.resource`

## 2. Chunk 0 — step layer and route counting (design D5–D7)

- [x] 2.1 Create `robot/resources/steps/shared.resource` with `Require Step State    ${name}    ${setter}` (technical helpers section) and the cross-capability steps the pilot already uses (`the user presses ${key:Escape|Enter}` and others that the step inventory in 2.3 shows appear in more than one capability)
- [x] 2.2 Move the pilot's steps from `editor_domain.resource` to `steps/gherkin_editor.resource`. Replace `@{VALID_AFTER_FEATURE}` / `@{INVALID_AFTER_FEATURE}` with `&{VALID_NEXT_LABELS}` / `&{INVALID_NEXT_LABELS}` (design D4). Add `Sets:` / `Reads:` lines and `Require Step State` guards (D6). Delete `editor_domain.resource`
- [x] 2.3 Build a step inventory: for every scenario in scope, list each spec line and the keyword that will implement it, and mark the lines that appear in more than one capability. Put shared lines in `steps/shared.resource`. Keep the inventory as a comment table in the header of `steps/shared.resource`
- [x] 2.4 Point `block_picker_bdd.robot` at `steps/gherkin_editor.resource` and update its Documentation
- [x] 2.5 Add `fulfillCountedRoute` and `routeRequestCount` to `robot/libraries/routes.cjs` (per-page counts, reset by `clearRoutes`), with `rfdoc` strings
- [x] 2.6 Write a throwaway check that calls `Then focus moves to the next item in the list` without its Given, confirm it fails with the `Require Step State` message, then delete it
- [x] 2.7 Run `pnpm lint:robot`, `pnpm lint:robot-steps`, `pnpm test:robot`, and check the counts match the 0.2 baseline exactly

## 3. Chunk 1 — initial content, Enter progression, toolbar

- [x] 3.1 Before writing the steps, check in the running app that after Enter and after a toolbar click the next typed text lands in the new block (`SC-3.2.1`, `SC-3.2.2`, `SC-3.4.2` "cursor" lines). If it does not, stop and report
- [x] 3.2 Add the `gherkin-editor` steps for `SC-3.1.2`, `SC-3.2.1`, `SC-3.4.1`, `SC-3.4.2` to `steps/gherkin_editor.resource`. Cursor lines type a marker and assert it is in the new block. The toolbar valid-next Then step reads `&{VALID_NEXT_LABELS}`
- [x] 3.3 Write `robot/suites/initial_content_bdd.robot`: three `SC-3.1.2` variants (order, empty text, cursor on Feature) plus `— second joiner does not re-seed` (two isolated contexts), so all 6 lines of the scenario are covered
- [x] 3.4 Write `robot/suites/enter_progression_bdd.robot`: the 9 `SC-3.2.1` variants, with the expected type in the Then refinement (`— Scenario`). `SC-3.2.2` is excluded (design D9, #53)
- [x] 3.5 Write `robot/suites/toolbar_bdd.robot`: the 3 `SC-3.4.1` variants and 2 `SC-3.4.2` variants (`When the user clicks a toolbar button labelled Rule`)
- [x] 3.6 Update the `> **Tests:**` lines of the covered `gherkin-editor` scenarios to add the new suites
- [x] 3.7 Run `pnpm lint:robot-steps`, `pnpm lint:specs`, `pnpm test:robot --include bdd`, then the full `pnpm test:robot`

## 4. Chunk 2 — visual separation, image, data table

- [x] 4.1 Read the editor's drop handling. If it uses the drop coordinates, plan `SC-3.8.3` as a drop at a known block's position. If not, stop and ask the user (design Open Questions). Answered: it does not; `SC-3.8.3` is excluded (D9, #54)
- [x] 4.2 Check in the running app that clicking Table puts the cursor in the first cell without another click (`SC-3.11.2`). If not, stop and report. Answered: it does not; `SC-3.11.2` is excluded (D9, #55)
- [x] 4.3 Add the steps for `SC-3.7.1`, `SC-3.7.2` (top border plus vertical space via `Get Style`; the export Then step reuses the `gherkin-export` download helpers), `SC-3.8.1–2` (`Promise To Upload File` for "a file picker opens"; the image block's position checked with `Document Nodes In Editor`, since images have no `data-gherkin-type`), and `SC-3.11.1`, `3.11.3–6` (`SC-3.8.3`, `SC-3.11.2` excluded, D9)
- [x] 4.4 Write `robot/suites/visual_separation_bdd.robot` under the spec titles `… (visual only)`: Given after then/and/but, Scenario after then/and/but, and an export variant for **each** of the two scenarios
- [x] 4.5 Write `robot/suites/image_bdd.robot` (`SC-3.8.1`, `3.8.2`; `3.8.3` excluded, #54)
- [x] 4.6 Write `robot/suites/data_table_bdd.robot` (`SC-3.11.1` on Given, `3.11.3`, `3.11.4`, `3.11.5`, `3.11.6`; `3.11.2` excluded, #55). `SC-3.11.7` / `3.11.8` follow in chunk 3 with export
- [x] 4.7 Update the `Tests:` lines and run the same gates as 3.7

## 5. Chunk 3 — export, import

- [x] 5.1 Create `steps/gherkin_export.resource`: steps for `SC-3.6.1`, `SC-3.9.1`, `SC-3.11.7`, `SC-3.11.8`, with the download, filename and line-by-line checks from `files.resource`
- [x] 5.2 Write `robot/suites/export_bdd.robot`: the `SC-3.6.1` ×3 and `SC-3.9.1` variants, a new `SC-3.9.1 — image inline` variant, and `SC-3.11.7` / `SC-3.11.8` with header, separator and **two** body rows so "subsequent rows follow in order" is checked
- [x] 5.3 Create `steps/gherkin_import.resource`: steps for `SC-7.1.1–4`. The import text comes in as `with ${NAME}` (design D3)
- [x] 5.4 Write `robot/suites/import_bdd.robot`: `SC-7.1.1`, `7.1.2`, `7.1.4`, and the 8 `SC-7.1.3` variants, with their texts in `*** Variables ***`. Check that all 6 `SC-7.1.3` lines are covered across the variants
- [x] 5.5 Update the `gherkin-export` and `gherkin-import` `Tests:` lines and run the gates as in 3.7

## 6. Chunk 4 — collaboration

- [x] 6.1 Create `steps/realtime_collaboration.resource` with the `SC-3.5.1` steps (two isolated contexts through `Open Second Context`; the remote check uses `Wait For Condition … timeout=5s`)
- [x] 6.2 Write `robot/suites/collaboration_bdd.robot` (`SC-3.5.1`). Its Documentation says that `SC-3.1.2` second-joiner lives in `initial_content_bdd` and that `SC-3.5.2` is excluded
- [x] 6.3 Update the `Tests:` line and run the gates

## 7. Chunk 5 — AI review

- [x] 7.1 Create `steps/llm_review.resource`. The review mocks use `fulfillCountedRoute` / `Hold Route`. Mirror `DEFAULT_MODEL` and the second `AVAILABLE_MODELS` entry from `src/lib/llm-constants.ts`, with a source comment, as `DEFAULT_PROMPT_START` already does
- [x] 7.2 Implement the Then steps that check more than the technical tests: request body carries the editor content (`SC-8.1.1`, boundary in `[Documentation]`), button back to normal after a failure (`SC-8.1.3`), pre-selected default model (`SC-8.3.1`), stored non-default model shown after a held load (`SC-8.3.4`), reopening shows the old prompt after Cancel/Escape/outside click (`SC-8.4.3`), and request count still 1 (`SC-8.8.2`)
- [x] 7.3 Write `robot/suites/llm_review_bdd.robot` with the spec titles: `SC-8.1.1` ×2, `8.1.2` ×2, `8.1.3`, `8.2.1–3`, `8.3.1`, `8.3.4`, `8.4.1`, `8.4.3` ×3 (`— Cancel` / `— Escape` / `— outside click`), `8.4.4`, `8.4.6`, `8.4.7`, `8.8.1–5`
- [x] 7.4 Update the `llm-review` `Tests:` lines and run the gates

## 8. Documentation and figures

- [x] 8.1 Add a "Writing a business-language test" section to `robot/README.md`: the D3 refinement table, the D5 placement and naming rules, the D6 state contract, the exclusion rule, and a worked example. Update the Layout tree
- [x] 8.2 Extend the business-language section of `robot/PARITY.md`: one subsection per new BDD suite with its stronger assertions, the D9 exclusion table, and the BDD-only tests
- [x] 8.3 Update `docs/robot-framework-evaluation.md` §6.7: test and step counts, domain-keyword reuse (uses per keyword, how many are used once), lines of code per layer before and after the refactor, and the §6.7.6 next steps that this change answers
- [x] 8.4 Final gates: `pnpm lint:robot`, `pnpm lint:robot-steps`, `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint`, `pnpm test:robot`, and `pnpm test:e2e` to confirm Playwright still passes. Report the counts
