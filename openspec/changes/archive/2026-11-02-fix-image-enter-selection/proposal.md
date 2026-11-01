## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/53

## Why

The spec says that when the cursor is on an image block, Enter inserts the
next block after the image (`SC-3.2.2`). The app cannot do that. The image
node is declared `selectable: false`, so clicking an image, or pressing
ArrowRight from the end of the block before it, leaves the selection in the
preceding block. Enter then inserts the new block before the image. The Enter
handler already has a branch for a selected top-level node, but no selection
can reach it.

`selectable: false` came in with the first data-table commit (`6dce539`),
which said y-prosemirror could not restore a NodeSelection. The editor no
longer syncs through y-prosemirror: `@tiptap/extension-collaboration` 3.32.0
binds through `@tiptap/y-tiptap` 3.0.10, which restores a NodeSelection
(`restoreRelativeSelection`, `relSel.type === "node"`) and falls back to a
text selection when no node is left (`createSafeNodeSelection`). So that
reason no longer holds for the image. y-prosemirror 1.3.7 is still installed,
but only for the unused collaboration-cursor extension.

The existing Playwright and Robot tests pass anyway: they check only that the
last typed block is `and`, and their selector skips images. The BDD suite
excludes `SC-3.2.2` until this is fixed.

## What Changes

- The image block becomes selectable. Clicking it, or moving onto it with the
  arrow keys, selects it, and a selected image is visibly highlighted.
- Enter on a selected image inserts the auto-progression block after the
  image, using the type of the last Gherkin block before it.
- A toolbar or block-picker insert while an image is selected inserts the new
  block after the image instead of throwing.
- Typing while an image is selected no longer replaces (deletes) the image.
- A collaborator deleting an image that another user has selected leaves that
  user's editor working.
- The data table node is unchanged: it stays `selectable: false`, because its
  cells take input.
- The `SC-3.2.2` tests check document order (the block right after the image
  is `and`), and the BDD suite gains the scenario.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `gherkin-editor`: the Enter-key auto-progression requirement says the
  image must be selected, and its image scenario cites the order-checking
  tests. A new Image block selection requirement covers selecting by click and
  arrow key, the highlight, typing protection, Backspace, toolbar insert after
  a selected image, and a collaborator removing a selected image.

## Impact

- `src/components/GherkinEditor.tsx`: `gherkin_image` node, `selectable: true`.
- `src/components/useGherkinKeyboard.ts`: one helper for "position after the
  current selection", used by the Enter handler, `insertBlock`, and
  `insertAtomNode`; key handling for a selected image.
- `src/app/globals.css`: selected-image highlight.
- Tests: `e2e/enter-progression.spec.ts`, `e2e/image.spec.ts`,
  `e2e/collaboration.spec.ts` or a new e2e spec, `robot/suites/enter_progression.robot`,
  `robot/suites/enter_progression_bdd.robot`, `robot/suites/image.robot`, and
  unit tests for the helper.
- Robot docs: the `SC-3.2.2` exclusion notes in `robot/PARITY.md`,
  `robot/README.md`, and `robot/resources/steps/shared.resource`.
- Do-Not-Touch list item 2 (Tiptap + Y.js collaboration configuration): the
  `selectable` flag was set for a Y.js binding reason, so this change sits
  next to the sync layer. It does not change the Collaboration extension or
  the sync server. The user approved this approach (option A) when they
  started this proposal for issue #53.
