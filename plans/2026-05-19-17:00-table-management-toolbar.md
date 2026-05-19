# Plan: Table management toolbar

## Context
The data table node (`gherkin_data_table`) currently shows two plain text buttons below the table — "Add row" and "Add column". The goal is to replace these with a compact icon toolbar that floats above the table, matching the reference design. The toolbar should offer a full set of row/column operations: insert before/after, delete, and delete the whole table.

## Critical files
- `src/components/GherkinEditor.tsx` — `GherkinDataTable` NodeView (lines 85–206)
- `src/app/globals.css` — toolbar & table styles (lines 153–216)
- `e2e/data-table.spec.ts` — selectors `.gherkin-table-add-row` / `.gherkin-table-add-col` must be updated

## E2E selector audit
Selectors currently used in `e2e/data-table.spec.ts`:
- `.gherkin-table-add-row` — line 56: visibility assertion
- `.gherkin-table-add-col` — line 57: visibility assertion

Both will be removed from the DOM. Tests need to be updated to use the new toolbar selectors.

## Implementation steps

### 1. Update `e2e/data-table.spec.ts` first (spec before code)
Replace the test "inserted table has add-row and add-column controls" to check for the new toolbar and its buttons:
- New selector for toolbar: `.gherkin-table-toolbar`
- New selector for insert-row-below: `.gherkin-table-toolbar-btn[data-action="insert-row-below"]`
- New selector for insert-col-after: `.gherkin-table-toolbar-btn[data-action="insert-col-after"]`

The toolbar is always visible (not hover-gated), so no hover step needed in tests.

### 2. Add CSS to `globals.css`
Add after the existing `.gherkin-export-md-btn` block:

```css
.gherkin-table-block {
  position: relative;
  padding-top: 36px; /* space for the toolbar */
}

.gherkin-table-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  gap: 2px;
  padding: 3px 4px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.gherkin-table-toolbar-sep {
  width: 1px;
  background: #e5e7eb;
  margin: 2px 3px;
}

.gherkin-table-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  cursor: pointer;
  color: #374151;
}

.gherkin-table-toolbar-btn:hover {
  background: #ede9fe;
  border-color: #a5b4fc;
  color: #4f46e5;
}

.gherkin-table-toolbar-btn[data-action="delete-table"]:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}
```

Note: the existing `gherkin-table-block` class is already used in the NodeView (`dom.className = "gherkin-table-block"`), so the `position: relative` and `padding-top` rules will apply automatically.

### 3. Rewrite the NodeView DOM in `GherkinDataTable.addNodeView()`

**Remove** the existing `controls` block (lines 158–187).

**Add** focused-cell tracking at the top of the NodeView closure:
```javascript
let focusedRow = 0;
let focusedCol = 0;
```

**Update** `buildTable()` — add a `focus` listener on each `<td>` to track position:
```javascript
td.addEventListener("focus", () => {
  focusedRow = ri;
  focusedCol = ci;
});
```

**Build the toolbar** and prepend it inside `dom` (before the table):
```javascript
const toolbar = document.createElement("div");
toolbar.className = "gherkin-table-toolbar";
```

Seven buttons, each created with `data-action` attribute and an inline SVG icon:

| `data-action`       | Operation |
|---------------------|-----------|
| `insert-row-above`  | `rows.splice(focusedRow, 0, Array(cols).fill(""))` |
| `insert-row-below`  | `rows.splice(focusedRow + 1, 0, Array(cols).fill(""))` |
| `delete-row`        | `rows.splice(focusedRow, 1)` — guard: only if `rows.length > 1` |
| *(separator)*       | |
| `insert-col-before` | each row: `r.splice(focusedCol, 0, "")` |
| `insert-col-after`  | each row: `r.splice(focusedCol + 1, 0, "")` |
| `delete-col`        | each row: `r.filter((_, i) => i !== focusedCol)` — guard: only if cols > 1 |
| *(separator)*       | |
| `delete-table`      | `tr.delete(pos, pos + node.nodeSize)` |

Each button uses `mousedown` + `e.preventDefault()`, then calls `buildTable()` + `commitRows()` (delete-table calls the editor command instead).

**Append order** in `dom`:
1. `toolbar`
2. `table`

Remove the old `controls` append.

### 4. SVG icons
Use simple inline SVG strings (16×16, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.5"`) for all 7 buttons. No new dependency needed. Suggested icons:
- Insert row above/below: a horizontal line with an upward/downward arrow
- Delete row: a horizontal line with a minus
- Insert col before/after: a vertical line with a left/right arrow
- Delete col: a vertical line with a minus
- Delete table: trash can

## Verification
1. `npm run dev` + `npm run dev:ws` — insert a table, confirm the floating toolbar appears above it with icon buttons.
2. Click each button and verify the table structure changes correctly (rows/cols added and removed at the right position relative to the focused cell).
3. Click "delete table" and verify the node is removed from the document.
4. `npm run test` — all existing Vitest unit tests pass.
5. `npx playwright test e2e/data-table.spec.ts` — all 4 table tests pass with updated selectors.
