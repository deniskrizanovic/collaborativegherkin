## 1. Regression tests (write first, expect red)

- [x] 1.1 In `e2e/image.spec.ts`, add a `dropImageAt(page, x, y)` helper that dispatches a `drop` event with `clientX`/`clientY` and a `DataTransfer` holding the 1×1 PNG on `.gherkin-editor-wrapper` (design D4). Rewrite `SC-3.8.3: Drag and drop image embeds at drop position` to click Feature, drop at the centre of the Then block's `boundingBox()`, and assert `documentNodes` is `feature, scenario, given, when, then, image`.
- [x] 1.2 In `e2e/image.spec.ts`, add `SC-3.8.3: Drag and drop image embeds at drop position — cancelled file picker`: cursor in Feature, click the Image toolbar button and leave the file chooser unanswered, drop on the Given block, assert `feature, scenario, given, image, when, then`.
- [x] 1.3 In `e2e/image.spec.ts`, add `SC-3.8.5: Image dropped outside every block embeds after the nearest block` with variants `— below the last block` (40px below Then; image last) and `— on the toolbar` (centre of `.gherkin-toolbar`; image right after Feature).
- [x] 1.4 Run 1.1–1.3 and confirm 1.1, 1.2 and the "below the last block" variant fail on the current code (the toolbar variant may pass by accident, since the cursor is in Feature).

## 2. Editor fix

- [x] 2.1 In `src/components/useGherkinKeyboard.ts`, add and export `blockIndexAtY(tops, y)` (design D1).
- [x] 2.2 In the same file, add `insertDroppedImage(file, clientY)` to the hook (design D2, D3): build `tops` from `view.nodeDOM` rects over the top-level nodes (a missing rect takes the previous top), compute the position after the chosen node, wrap it in `trackPosition`, and call the module-level `insertImageFromFile`. Do not read or clear `uploadTargetRef`. Add it to the hook's return type and return value.
- [x] 2.3 In `src/components/GherkinEditor.tsx`, destructure `insertDroppedImage` and call it from the wrapper's `onDrop` with `e.clientY`. Leave the Collaboration extension and the editor's other options unchanged.
- [x] 2.4 Add Vitest cases to `src/components/useGherkinKeyboard.test.ts` for `blockIndexAtY`: inside a block, in the gap between two blocks (upper block), below the last block, above the first block, exactly on a block's top, and an empty array (returns `0`). No `vi.mock`.
- [x] 2.5 Re-run 1.1–1.3 and the Vitest file and confirm they pass.

## 3. Human check: the user tries the fix (stop and wait)

- [x] 3.1 Start `pnpm dev` and tell the user the fix is ready to try. Walkthrough: (a) cursor in Feature, drag a real image file from the desktop onto the Then block, image lands after Then; (b) drag one onto the gap between Scenario and Given, image lands between them; (c) drag one below the last block, image lands at the end; (d) drag one onto the toolbar, image lands after Feature; (e) click the Image toolbar button, cancel the file dialog, drag an image onto Given, image lands after Given; (f) in each case exactly one image is inserted. Do not start section 4.
- [x] 3.2 Wait for the user's verdict on each step. If any behaviour should change, revise the spec and design with `/opsx:update` before section 4.
- [x] 3.3 Record the verdict here.
  - Verdict (2026-11-02): user confirmed steps (a)–(f) all pass.

## 4. Robot technical suite

- [x] 4.1 In `robot/suites/image.robot`, port 1.1–1.3 with the same titles, asserting with `Document Nodes In Editor`. Move the drop JavaScript into a keyword that takes the coordinates. No `Sleep`.
- [x] 4.2 In `robot/PARITY.md`, update the `SC-3.8.3` row (line ~141) to describe the coordinate drop and order assertion, add rows for the cancelled-picker variant and both `SC-3.8.5` variants, and update the chunk 3 and total counts in the Totals table.

## 5. Business-language suite

- [x] 5.1 Sync the delta spec into `openspec/specs/gherkin-editor/spec.md` (`/opsx:sync`), because `lint:robot-steps` matches BDD steps against the main spec only (design, Risks). Fix the `> **Tests:**` link depth for the main spec location.
- [x] 5.2 Add `SC-3.8.3: Drag and drop image embeds at drop position` and `SC-3.8.5: Image dropped outside every block embeds after the nearest block — below the last block` to `robot/suites/image_bdd.robot`, each step a spec line or a spec line plus a refinement. Remove the "#54" exclusion sentence from its `Documentation`.
- [x] 5.3 Add the step keywords they need to `robot/resources/steps/gherkin_editor.resource`. Update the `SC-3.8.3 (#54)` note in `robot/resources/steps/shared.resource` and add the two scenarios to its step inventory.
- [x] 5.4 In `robot/PARITY.md`, remove the `SC-3.8.3` exclusion row (line ~424). In `robot/README.md`, remove `SC-3.8.3` #54 from the excluded-scenario examples (line ~188).
- [x] 5.5 Run `pnpm lint:robot-steps` and `pnpm lint:robot` and confirm both pass.

## 6. Verify

- [x] 6.1 Run `pnpm lint:specs` and `pnpm lint:given`.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`.
- [x] 6.3 Run `pnpm test:e2e` and `pnpm test:robot` in full, and confirm the other image, toolbar, data-table, and collaboration tests have not regressed.
- [x] 6.4 Report results to the user and wait for an explicit commit instruction. When committing, add `Fixes #54` to the commit message.
