## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/55

## Why

The spec says that clicking the toolbar Table button inserts a 2×2 stub with
the cursor in the first cell (`SC-3.11.2`). The app does not do that.
`insertAtomNode` (`src/components/useGherkinKeyboard.ts`) inserts the table
and puts the ProseMirror selection after it, and nothing focuses a cell. After
the click, `document.activeElement` is still the main `.ProseMirror` element,
so text typed next does not reach the first cell.

Choosing Table in the slash-command block picker runs the same insert code and
has the same bug. It also deletes the `/` with `editor.chain().focus()`, and
Tiptap 3.32.0's `focus` command calls `view.focus()` in a
`requestAnimationFrame`, which would move focus back to the main editor even
if the cell were focused first.

The existing Playwright and Robot tests pass anyway: they click the cell
before typing. The BDD suite excludes `SC-3.11.2` until this is fixed.

## What Changes

- After the toolbar Table button inserts a table, the first cell (row 1,
  column 1) has keyboard focus, so typed text goes into it without a click.
- Choosing Table in the slash-command block picker does the same, and the `/`
  is still removed.
- Only the user who inserted the table gets the focus. A collaborator's
  editor shows the new table but keeps its own focus and cursor.
- The `SC-3.11.2` tests type without clicking the cell first, and a new
  scenario covers the block-picker path. The BDD suite gains both.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `gherkin-editor`: the Data table insertion requirement says the block-picker
  Table option also puts the cursor in the first cell. The `SC-3.11.2`
  scenario cites tests that type without clicking, and a new scenario covers
  choosing Table in the block picker.

## Impact

- `src/components/useGherkinKeyboard.ts`: the `data_table` branch of
  `insertBlock` focuses the first cell of the inserted table, and removes the
  `/` without the deferred editor focus.
- `src/components/GherkinDataTable.tsx`: no behaviour change expected; the
  cells are already focusable `contenteditable` elements.
- Tests: `e2e/data-table.spec.ts`, `robot/suites/data_table.robot`,
  `robot/suites/data_table_bdd.robot`, step keywords in
  `robot/resources/steps/gherkin_editor.resource`, and unit tests in
  `src/components/useGherkinKeyboard.test.ts` if the focus helper is pure
  enough to test there.
- Robot docs: the `SC-3.11.2` / #55 exclusion notes in `robot/PARITY.md`,
  `robot/README.md`, and the `data_table_bdd.robot` `Documentation`.
- Do-Not-Touch list: none. The change does not touch `src/lib/gherkin.ts`,
  the Collaboration extension, the sync server, or export logic. Focus is a
  local DOM action and is not synced.
