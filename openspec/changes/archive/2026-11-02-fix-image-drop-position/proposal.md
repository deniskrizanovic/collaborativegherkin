## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/54

## Why

The spec says a dragged-and-dropped image is embedded at the drop position
(`SC-3.8.3`). The app does not do that. The `onDrop` handler on
`.gherkin-editor-wrapper` (`src/components/GherkinEditor.tsx`) ignores the drop
event's coordinates and calls `insertImageFromFile(file)`, which inserts after
the block holding the cursor. An image dropped onto the last Then block, with
the cursor still in Feature, lands right after Feature.

There is a second fault on the same path. `insertImage`
(`src/components/useGherkinKeyboard.ts`) prefers `uploadTargetRef`, which the
toolbar and slash-command Image actions set when they open the file picker and
which is only cleared when an image is inserted. If the user cancels the file
picker, the next drop lands at that old position.

The existing Playwright and Robot tests pass anyway: they only check that an
image block appears. The BDD suite excludes `SC-3.8.3` until this is fixed.

## What Changes

- A dropped image is inserted immediately after the top-level block under the
  pointer, whatever the cursor position. Dropping onto a data table or another
  image inserts after that node.
- A drop that is not over a block (the toolbar, the gutter, below the last
  block, the gap between two blocks) inserts after the nearest block above the
  drop point: a gap means after the upper block, above the first block means
  after the first block, below the last block means at the end of the
  document.
- A drop never uses the cursor position or a pending file-picker target, so a
  cancelled file picker no longer redirects the next drop.
- The insert position is tracked through changes made while the file is read,
  local or remote, as the file-picker path already does.
- The `SC-3.8.3` tests drop at real coordinates and check document order. New
  tests cover the off-block drop. The BDD suite gains both scenarios.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `gherkin-editor`: the Image insertion requirement defines "drop position" as
  immediately after the block under the drop point, and says where an
  off-block drop lands. `SC-3.8.3` gets a concrete GIVEN/THEN, and a new
  scenario covers the off-block drop.

## Impact

- `src/components/GherkinEditor.tsx`: the wrapper's `onDrop` passes the drop's
  `clientY` to the image insert.
- `src/components/useGherkinKeyboard.ts`: a pure helper that picks the
  top-level block for a vertical coordinate, and an insert entry point for
  drops that bypasses `uploadTargetRef`.
- Tests: `e2e/image.spec.ts`, `robot/suites/image.robot`,
  `robot/suites/image_bdd.robot`, the step keywords in
  `robot/resources/steps/gherkin_editor.resource`, and Vitest unit tests for
  the helper.
- Robot docs: the `SC-3.8.3` / #54 exclusion notes in `robot/PARITY.md`,
  `robot/README.md`, `robot/resources/steps/shared.resource`, and the
  `image_bdd.robot` `Documentation`.
- Do-Not-Touch list: none of it. The change does not touch `src/lib/gherkin.ts`,
  the Collaboration extension or sync server, NextAuth, migrations, or export.
