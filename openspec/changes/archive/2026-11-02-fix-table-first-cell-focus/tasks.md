## 1. Regression tests (write first, expect red)

- [x] 1.1 In `e2e/data-table.spec.ts`, change `SC-3.11.2: … — first cell interactive` to `SC-3.11.2: … — first cell focused`: after the toolbar Table click, assert cell `0-0` is focused, type `header` with `page.keyboard.type` (no click, no `fill`), assert the cell's text, click `.gherkin-editor` outside the table, and assert the text is still there (design D5).
- [x] 1.2 In `e2e/data-table.spec.ts`, add `SC-3.11.9: Choosing Table in the block picker puts the cursor in the first cell`: on a step block type `/`, choose `Table` in the picker, assert cell `0-0` is focused, type with the keyboard, assert the cell's text, and assert the step block's text contains no `/`.
- [x] 1.3 Port 1.1 and 1.2 to `robot/suites/data_table.robot` with the same titles (`Keyboard Input    type`, no `Fill Text`, no `Sleep`).
- [x] 1.4 Run 1.1–1.3 and confirm they fail on the current code (focus stays on `.ProseMirror`).

## 2. Editor fix

- [x] 2.1 In `src/components/useGherkinKeyboard.ts`, make `insertAtomNodeAt` return the position it inserted at, and `insertAtomNode` return that position or `null` (design D2).
- [x] 2.2 Add and export `focusFirstTableCell(dom: Node | null): boolean` that focuses `[data-cell="0-0"]` inside `dom` when present and returns whether it did (design D2).
- [x] 2.3 In the `data_table` branch of `insertBlock`, remove the `/` with `editor.chain().deleteRange(...).run()` (no `.focus()`), then call `focusFirstTableCell(editor.view.nodeDOM(pos))` with the position from 2.1 (design D1, D3). Leave the `image` and block-insert branches unchanged.
- [x] 2.4 Add Vitest unit tests for `focusFirstTableCell` in a jsdom test file (`// @vitest-environment jsdom`, as in `GherkinDataTable.test.ts`): focuses cell `0-0` of a built table element, picks cell `0-0` and not a later cell, returns `false` for `null` and for an element with no cells. Build the DOM by hand; no `vi.mock`.
- [x] 2.5 Add a unit test in `src/components/useGherkinKeyboard.test.ts` that the position returned by `insertAtomNodeAt` (or the pure part of it, if extracted) is where the table node now sits.
- [x] 2.6 Re-run 1.1–1.3 and confirm they pass. If focus is lost right after the insert because the node view's `update()` rebuilds the cells, make `update()` skip `buildTable()` when the incoming `rows` equal `committedRows`, add a `GherkinDataTable.test.ts` case for it, and note it here (design Risks).
  - Note: not needed. Focus survived the insert in e2e and Robot; `update()` left unchanged. Pure part of `insertAtomNodeAt` extracted as `atomInsertTransaction` for 2.5.

## 3. Human check: the user tries the fix (stop and wait)

- [x] 3.1 Start `pnpm dev`, tell the user the fix is ready to try, and point them to "Human check walkthrough" in design.md. Do not start section 4.
- [x] 3.2 Wait for the user's verdict on each walkthrough step. If any behaviour should change, revise the spec and design with `/opsx:update` before continuing.
- [x] 3.3 Record the verdict here (approved, or which steps changed and how).
  - Verdict (2026-11-02): approved — all five walkthrough steps behave as described; no spec or design change.

## 4. Collaborator focus test

- [x] 4.1 In `e2e/collaboration.spec.ts`, add `SC-3.11.10: Inserting a table does not move a collaborator's cursor` using the existing two-context setup: user B clicks into a Gherkin block; user A inserts a table from the toolbar; B waits for `[data-gherkin-table]`; B's `document.activeElement` is not a `[data-cell]`; B types a marker and it appears in B's block on both pages and not in the table. Also check for no page errors.
- [x] 4.2 Port 4.1 to `robot/suites/collaboration.robot` with the same title. No `Sleep`.

## 5. Business-language suites

- [x] 5.1 Sync the delta spec into `openspec/specs/gherkin-editor/spec.md` with `/opsx:sync` (the `lint:robot-steps` gate reads `openspec/specs/**` only, so the new scenarios must be there before 5.4).
- [x] 5.2 Add `SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell` and `SC-3.11.9: Choosing Table in the block picker puts the cursor in the first cell` to `robot/suites/data_table_bdd.robot`, and remove the `#55` exclusion sentence from its `Documentation`. Add `SC-3.11.10` to `robot/suites/collaboration_bdd.robot`. Each step is a spec line, or a spec line plus a refinement.
- [x] 5.3 Add the step keywords these need to `robot/resources/steps/gherkin_editor.resource` (and `robot/resources/steps/realtime_collaboration.resource` for 3.11.10). The "cursor is placed inside the first cell" step asserts focus without clicking; "text the user types next appears in the first cell" types with `Keyboard Input`. Update the `#55` mention in `robot/resources/steps/shared.resource`.
- [x] 5.4 Run `pnpm lint:robot-steps` and `pnpm lint:robot` and confirm both pass.

## 6. Docs and traceability

- [x] 6.1 In `robot/PARITY.md`: remove the `SC-3.11.2` exclusion row (~line 434); update the `SC-3.11.2 — first cell interactive` row (~line 160) to the new title and no-click description; add rows for `SC-3.11.9` and `SC-3.11.10` with status `ported`; update the data-table BDD summary (~line 341) and the test counts in the Totals table (~line 29) and the collaboration chunk.
- [x] 6.2 In `robot/README.md` (~line 188), replace the `SC-3.11.2` #55 example of an excluded scenario with one that is still excluded, or drop it.
- [x] 6.3 Run `pnpm lint:specs` and `pnpm lint:given` and confirm they pass for the delta spec and the synced main spec.

## 7. Verify

- [x] 7.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test -- --run`.
- [x] 7.2 Run `pnpm test:e2e` and `pnpm test:robot` in full; confirm the other data-table, block-picker, toolbar, and collaboration tests did not regress.
- [x] 7.3 Report results to the user and wait for an explicit commit instruction.

## 8. Code review follow-ups

- [x] 8.1 Make the node view's `update()` skip `buildTable()` when the incoming `rows` equal `committedRows`, so typing then Tab keeps focus. Extend `SC-3.11.4` (e2e and Robot) to type before Tab and after it; add a `GherkinDataTable.test.ts` case (design Risks). This supersedes the 2.6 note: the e2e run showed focus lost after typing and Tab.
- [x] 8.2 Remove the `/` and insert the table in one transaction (`slashAtomInsertTransaction`), deleting only when the character before the cursor is `/`; unit-test it in `useGherkinKeyboard.test.ts` (design D3).
- [x] 8.3 Fall back to `editor.view.focus()` when there is no table or no cell to focus (design D2).
- [x] 8.4 Move `focusFirstTableCell` to `GherkinDataTable.tsx` with a shared `cellId` helper; test it against the real node view DOM and drop the hand-built-DOM test file (design D2).
- [x] 8.5 Make the BDD step "text the user types next appears in the first cell" a pure check (no blur); the technical suite keeps the blur-commit check.
- [x] 8.6 Make the collaborator "focus not in a cell" check `!!document.activeElement?.closest("[data-cell]")` in e2e and Robot, so a null `activeElement` reads as "not in a cell".
