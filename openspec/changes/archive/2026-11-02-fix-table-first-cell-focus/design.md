## Context

`gherkin_data_table` (`src/components/GherkinDataTable.tsx`) is an `atom`,
`selectable: false` block node. Its node view renders each cell as a
`contenteditable="true"` `th`/`td` with `data-cell="<row>-<col>"` inside a
`contenteditable="false"` wrapper, and `stopEvent`/`ignoreMutation` return
`true`, so ProseMirror ignores everything that happens in a cell. A cell's
text is written back to the node's `rows` attribute on `blur`.

Both insert paths go through the `data_table` branch of `insertBlock`
(`src/components/useGherkinKeyboard.ts`):

- **Toolbar**: the Table button (`GherkinEditor.tsx`) calls
  `handleToolbarInsert("data_table")` from `onMouseDown` with
  `preventDefault`, so the main editor keeps focus.
- **Block picker**: `BlockPicker.tsx` calls `onSelect` from `onMouseDown`
  with `preventDefault`; `handlePickerSelect` calls
  `insertBlock(type, true, …)`, which first removes the `/` with
  `editor.chain().focus().deleteRange(...)`.

The branch then calls `insertAtomNode`, which dispatches the insert and sets
`TextSelection.near(...)` after the table. Nothing focuses a cell, so
`document.activeElement` stays on `.ProseMirror` and typed text goes to the
block after the table (or nowhere useful).

Tiptap 3.32.0's `focus` command (`@tiptap/core/src/commands/focus.ts`) calls
`view.focus()` inside `requestAnimationFrame`. On the picker path, a cell
focused synchronously after the slash deletion would lose focus to the main
editor one frame later.

Clicking a cell and typing already works (`SC-3.11.2 — first cell
interactive`), so a focused cell accepts input and commits on blur.

## Goals / Non-Goals

**Goals:**

- After the toolbar or picker inserts a table, cell 0-0 has DOM focus and the
  next keystrokes land in it.
- The picker path still removes the `/`.
- Remote clients that receive the new table do not have their focus moved.

**Non-Goals:**

- Changing the ProseMirror selection model for tables (still
  `selectable: false`, selection still placed after the table).
- Focus on tables that arrive by paste, import, undo/redo, or from a
  collaborator.
- Any change to cell editing, Tab/Shift+Tab, the table toolbar, or export.

## Decisions

### D1. Focus from the inserting call site, not from the node view

`insertBlock`'s `data_table` branch focuses the cell right after its own
dispatch. Only the client that ran the insert executes that code.

*Alternative rejected:* focus in the node view constructor (or on a "fresh
table" flag in the attrs). Node views are built on every client that renders
the node, including collaborators receiving the Y.js update and anyone
reloading the session, so they would all have focus stolen. A flag in the
attrs would also sync through Y.js and need clearing.

### D2. Find the cell through `view.nodeDOM(insertPos)`

The table branch builds its transaction with `slashAtomInsertTransaction`
(see D3), which returns the position the table went in at. After dispatching
it, the branch calls `editor.view.nodeDOM(pos)` and focuses the first cell
inside it. `view.dispatch` updates the DOM synchronously, so the node view
exists when `dispatch` returns.

The lookup-and-focus step lives in `focusFirstTableCell(dom): boolean`,
exported from `GherkinDataTable.tsx` next to the node view, and finds the
cell through the same `cellId(row, col)` helper the node view uses to name
cells. It is unit-tested in `GherkinDataTable.test.ts` against the real node
view's DOM, with no `vi.mock` (explicit injection, per project preference).

When there is no table to focus (no block to insert after, or no cell found),
the branch calls `editor.view.focus()` so the caret is not left nowhere.

*Alternative rejected:* `document.querySelector('[data-cell="0-0"]')` — wrong
table when the document already has one.

### D3. Remove the `/` in the insert transaction, without deferred focus

In the `data_table` branch only, `slashAtomInsertTransaction` removes the `/`
before the cursor (only when that character is a `/`) and inserts the table
in one transaction. Collaborators never see the slash gone without the table,
and one undo reverts both. No `chain().focus()` is used, so there is no
`requestAnimationFrame` callback to take focus back from the cell.

*Alternative rejected:* focus the cell inside a later `requestAnimationFrame`
(or `setTimeout`). It depends on callback order inside one frame, would
flicker the caret, and leaves a window where typed keys go to the main editor.

The `image` branch and the block-insert path keep their `.focus()` calls
unchanged.

### D4. Leave the ProseMirror selection where it is

`insertAtomNode` still sets `TextSelection.near` after the table. The table
is not selectable, so there is no in-table PM selection to set. The toolbar's
valid-type computation and Enter behaviour after the user leaves the table
stay as they are today.

### D5. Tests type without clicking first

The `SC-3.11.2` e2e and Robot tests drop the click on cell 0-0: after the
insert they assert the cell is focused, type with the keyboard (not `fill`,
which focuses the element itself), and assert the cell's text. The picker
scenario does the same after `/` and choosing Table, and also asserts the
step block's text has no `/`. Then the test blurs (click elsewhere in the
editor) and checks the text survived the commit, so the typed text reached
the `rows` attribute and not only the DOM.

The collaborator scenario reuses the two-context setup in
`e2e/collaboration.spec.ts`: user B clicks into a block, user A inserts a
table, B waits for the table, types, and the text lands in B's block, and B's
`document.activeElement` is not a table cell.

## Risks / Trade-offs

- [The node view's `update()` calls `buildTable()`, which replaces every
  cell element. Typing in a cell and pressing Tab blurs it, the blur commits
  the rows, and the resulting `update()` detached the cell Tab was moving
  focus to.] → `update()` skips the rebuild when the incoming `rows` equal
  `committedRows`. The edit stays in `GherkinDataTable.tsx` and does not
  touch the sync configuration. `SC-3.11.4` types before Tab to cover it.
- [Focusing a descendant blurs the ProseMirror root, so Tiptap emits `blur`
  and the editor's focus-dependent UI (toolbar) reacts.] → Same as clicking a
  cell today; no new behaviour. The human check confirms the toolbar looks
  right.
- [Without `chain().focus()`, a failed cell lookup would leave nothing
  focused.] → The branch falls back to `editor.view.focus()`, which is
  synchronous.

## Migration Plan

None. Client-only behaviour change; no data or sync format change. Rollback
is a revert of the commit.

## Open Questions

None.

## Human check walkthrough

1. Open a session, click the seeded Given block, click toolbar Table, type
   `abc`. `abc` is in row 1, column 1 with no click.
2. Press Tab, type `def`. It lands in row 1, column 2.
3. Click another block, then reload the page. Row 1 shows `abc | def`.
4. In a Then block, type `/`, choose Table, type `xyz`. The `/` is gone from
   the Then block and `xyz` is in the new table's first cell.
5. Open the same session in a second browser profile, put the cursor in a
   block there, insert a table in the first browser. The second browser
   shows the table and its typing still goes into its own block.
