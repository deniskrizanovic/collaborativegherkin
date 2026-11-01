## 1. Check the collaboration risk first (design D5)

- [x] 1.1 In `src/components/GherkinEditor.tsx`, set `selectable: true` on `gherkin_image` only. Leave `gherkin_data_table` (`src/components/GherkinDataTable.tsx`) unchanged.
- [x] 1.2 In `e2e/collaboration.spec.ts`, add `SC-3.12.6: Collaborator removes an image another user has selected` with two variants: image in the middle (Then, image, And) and image last in the document. The first user clicks the image; the second user clicks it and presses Backspace. Assert the image is gone from the first user's editor, then type in the first user's editor and assert the text appears in a Gherkin block and on the second user's page. Also check the browser console for no page errors.
- [x] 1.3 Run 1.2. If the image-last variant throws in the Y.js binding's `restoreRelativeSelection` (or the remote delete never reaches the first user), **stop and report to the user**: they choose between a `pnpm patch` of the binding and option B (design D1, D5). Do not continue to section 2 until they decide.
- [x] 1.4 If the image-in-the-middle variant leaves a whole Gherkin block selected (typing replaces it), note it: section 3.4 fixes it.

## 2. Regression tests for the Enter bug (write first, expect red)

- [x] 2.1 Add `documentNodes(page)` to `e2e/helpers.ts`: top-level children of `.gherkin-editor .ProseMirror` in order, as `data-gherkin-type`, `"image"`, or `"table"` (design D6).
- [x] 2.2 In `e2e/enter-progression.spec.ts`, change `SC-3.2.2` to assert that the node right after the image is `and`, using `documentNodes`. Keep the wait-for-count step.
- [x] 2.3 In `robot/suites/enter_progression.robot`, change `SC-3.2.2` the same way with `Document Nodes In Editor`.
- [x] 2.4 With `selectable: false` restored temporarily, confirm 2.2 and 2.3 fail (the new block lands before the image). Then set `selectable: true` again.

## 3. Editor fix

- [x] 3.1 In `src/components/useGherkinKeyboard.ts`, add and export `positionAfterSelection(state)` (design D2). Use it in the Enter handler, the insert path of `insertBlock`, and `insertAtomNode`.
- [x] 3.2 In `handleKeyDown`, after the Enter branch and before the `/` branch, return `true` for a single printable key with no Ctrl/Meta/Alt when the selection is a `NodeSelection` on `gherkin_image` (design D3).
- [x] 3.3 In `src/app/globals.css`, add a `.gherkin-image-block.ProseMirror-selectednode` outline using the editor's existing accent colour variable (design D4).
- [x] 3.4 Add a small Tiptap extension (next to `GherkinImage` in `GherkinEditor.tsx`, or its own file under `src/components/`) whose `appendTransaction` turns a `NodeSelection` on any node other than `gherkin_image` into `TextSelection.near` inside that node. Register it in the editor's extensions without changing the `Collaboration` extension's options (design D5 case 1).
- [x] 3.5 Add Vitest unit tests (`src/components/useGherkinKeyboard.test.ts`, or extend the existing file) for `positionAfterSelection` (NodeSelection on an image, cursor inside a block, image at end of doc), the D3 key filter, and the 3.4 selection narrowing. Build plain ProseMirror `EditorState`s from the schema; no `vi.mock`.
- [x] 3.6 Re-run 1.2, 2.2, and 2.3 and confirm they pass.

## 4. Human check: the user tries the fix (stop and wait)

- [x] 4.1 Start `pnpm dev`, tell the user the fix is ready to try, and point them to "Human check walkthrough" in design.md. Do not start section 5.
- [x] 4.2 Wait for the user's verdict on each walkthrough step. If any behaviour should change, revise the spec and design with `/opsx:update` before writing the tests in sections 5 and 6.
- [x] 4.3 Record the verdict here (approved, or which steps changed and how).
  - Verdict (2026-10-30): approved, all walkthrough steps, no behaviour changes. `NarrowNodeSelection` kept as a safeguard: the installed binding (`@tiptap/y-tiptap` 3.0.10, `createSafeNodeSelection`) already avoids both D5 failure cases.

## 5. Image selection tests

- [x] 5.1 In `e2e/image.spec.ts`, add `SC-3.12.1: Clicking an image selects it` (`.gherkin-image-block` gets `ProseMirror-selectednode`).
- [x] 5.2 In `e2e/image.spec.ts`, add `SC-3.12.2: Arrow key moves the selection onto an image` (End on the Then block before the image, ArrowRight, image selected).
- [x] 5.3 In `e2e/image.spec.ts`, add `SC-3.12.3: Typing does not replace a selected image` with variants for a letter and for `/`: image still present, document text unchanged, `.block-picker` not visible (check the picker's actual class first).
- [x] 5.4 In `e2e/image.spec.ts`, add `SC-3.12.4: Backspace removes a selected image` (Then, image, And: after Backspace the nodes are Then, And with their text unchanged).
- [x] 5.5 In `e2e/toolbar.spec.ts`, add `SC-3.12.5: Toolbar insert with an image selected places the block after the image` (nodes `… then, image, and`, and typed text lands in the new And block).
- [x] 5.6 Port 5.1–5.5 and 1.2 to `robot/suites/image.robot`, `robot/suites/toolbar.robot`, and `robot/suites/collaboration.robot` with the same titles. No `Sleep`.
- [x] 5.7 Run the existing image, data-table, drag-and-drop (`SC-3.8.3`), and export suites and confirm nothing regressed. Note in the PR that Backspace in an empty block right after an image now selects the image first.
- [x] 5.8 In `e2e/image.spec.ts`, add `SC-3.12.4: Backspace removes a selected image — undo restores it` (Then, image, And: select the image, close the undo step, Backspace, Cmd/Ctrl+Z; the nodes are Then, image, And again with their text unchanged; undo selects the image again, so typing does not replace it; after a click into And, typing lands there; no page errors). Port it to `robot/suites/image.robot` with the same title, add its `PARITY.md` row, and list it under "Technical tests with no business-language twin" (no spec line describes undo) (design D5, Risks).

## 6. Business-language suites

- [x] 6.1 Add `SC-3.2.2: Enter on image block uses prevType context` to `robot/suites/enter_progression_bdd.robot`, and remove the "#53" exclusion note from its `Documentation`.
- [x] 6.2 Add `SC-3.12.1`–`SC-3.12.4` to `robot/suites/image_bdd.robot`, `SC-3.12.5` to `robot/suites/toolbar_bdd.robot`, and `SC-3.12.6` to `robot/suites/collaboration_bdd.robot`. Each step is a spec line, or a spec line plus a refinement.
- [x] 6.3 Add the step keywords these need to `robot/resources/steps/gherkin_editor.resource` and, for 3.12.6, `robot/resources/steps/realtime_collaboration.resource`. Update the `#53` comment in `robot/resources/steps/shared.resource`.
- [x] 6.4 Run `pnpm lint:robot-steps` and `pnpm lint:robot` and confirm both pass.

## 7. Docs and traceability

- [x] 7.1 In `robot/PARITY.md`, remove the `SC-3.2.2` exclusion row (line ~403), update the SC-3.2.2 row's description to the order assertion, adjust the excluded-count summary (line ~29), and add rows for `SC-3.12.1`–`SC-3.12.6` with status `ported`.
- [x] 7.2 In `robot/README.md`, remove `SC-3.2.2` / #53 from the list of excluded scenarios (line ~188).
- [x] 7.3 Run `pnpm lint:specs` and `pnpm lint:given` and confirm they pass for the change's delta spec.

## 8. Verify

- [x] 8.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`.
- [x] 8.2 Run `pnpm test:e2e` and `pnpm test:robot` in full.
- [x] 8.3 Report results to the user and wait for an explicit commit instruction.
