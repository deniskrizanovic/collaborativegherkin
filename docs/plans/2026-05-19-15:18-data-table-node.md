# Plan: Add Data Table Node Type

## Context

Gherkin data tables are tabular arguments that attach to a step (Given/When/Then/And/But) to supply structured test data inline. Users want to insert editable tables directly in the editor, export them in standard pipe-delimited Gherkin format, and have the tables participate in the document model.

## Decisions

- Insertable only after step blocks: `given`, `when`, `then`, `and`, `but` (and after another `data_table`)
- Export (TXT): pipe-delimited Gherkin table format (`| col | col |`), cells padded to column width
- Export (MD): pipe-delimited markdown table (same format; first row treated as header with separator row)
- Initial state: 2×2 stub with empty cells
- `data_table` is **not** a `GherkinBlockType` — it is a separate Tiptap node (like `gherkin_image`) with its own `DocumentBlock` variant

## Spec updates (implement first per project rule)

### `spec/02-gherkin-document-model.md`
After the image block paragraph in §2.1, add:

> **Data table blocks** carry a 2D array of string cells (rows × columns). They are not keyword blocks and carry no Gherkin step semantics. A data table may appear immediately after any step block (`given`, `when`, `then`, `and`, `but`) or after another data table. Data tables are not subject to `canFollow()` rules — placement is enforced in the editor layer.

### `spec/03-editor.md`
Append §3.11:

> **3.11 Data table insertion**
> - The toolbar shows a "Table" button when `validNext` includes `data_table` (i.e. when current/previous block is a step type or `data_table`).
> - The slash-command picker includes "Table" under the same condition.
> - Inserting a table creates a 2×2 stub with empty cells.
> - Tab moves focus to the next cell; Shift+Tab moves to the previous.
> - Add-row and add-column controls are available within the table UI.
> - Export TXT: each row is one line in `| cell | cell |` format.
> - Export MD: pipe-delimited markdown table; first row is the header row with a `| --- | --- |` separator.

## Critical files

| File | Change |
|------|--------|
| `spec/02-gherkin-document-model.md` | Add data table block type description |
| `spec/03-editor.md` | Add §3.11 data table behaviour |
| `src/lib/gherkin.ts` | Add `DataTableBlock` type, extend `DocumentBlock`, update export functions |
| `src/components/GherkinEditor.tsx` | Add `GherkinDataTable` Tiptap node, insertion logic, toolbar button |
| `src/lib/gherkin.test.ts` | Add unit tests for export of data table blocks |
| `e2e/data-table.spec.ts` | New E2E spec for insertion and export |

## Implementation steps

### 1. Update specs
- `spec/02-gherkin-document-model.md` — add data table block type description after image block paragraph
- `spec/03-editor.md` — append §3.11 with insertion, navigation, and export behaviour

### 2. Extend `src/lib/gherkin.ts`

Add `DataTableBlock` type:
```ts
export type DataTableBlock = { type: "data_table"; rows: string[][] };
```

Expand `DocumentBlock` union:
```ts
export type DocumentBlock = GherkinBlock | ImageBlock | DataTableBlock;
```

Update `exportToText` — add branch before the default return:
```ts
if (b.type === "data_table") {
  const widths = b.rows[0].map((_, ci) =>
    Math.max(...b.rows.map(r => r[ci]?.length ?? 0))
  );
  return b.rows
    .map(row => "| " + row.map((cell, ci) => cell.padEnd(widths[ci])).join(" | ") + " |")
    .join("\n");
}
```

Update `exportToMarkdown` — add branch:
```ts
if (b.type === "data_table") {
  const widths = b.rows[0].map((_, ci) =>
    Math.max(3, ...b.rows.map(r => r[ci]?.length ?? 0))
  );
  const fmt = (row: string[]) =>
    "| " + row.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map(w => "-".repeat(w)).join(" | ") + " |";
  return [fmt(b.rows[0]), sep, ...b.rows.slice(1).map(fmt)].join("\n");
}
```

### 3. Add `GherkinDataTable` Tiptap node in `src/components/GherkinEditor.tsx`

Define `Node.create` with:
- `name: "gherkin_data_table"`, `group: "block"`, `atom: true`, `draggable: true`
- `addAttributes`: `rows` with default `[["",""],["",""]]`
- `parseHTML`: `[{ tag: "div[data-gherkin-table]" }]`
- `renderHTML`: `["div", mergeAttributes(attrs, { "data-gherkin-table": "" })]`
- `addNodeView`: returns a `<div class="gherkin-table-block">` containing:
  - A `<table>` with `contenteditable="false"` on the wrapper; individual `<td>` cells are `contenteditable="true"`
  - On cell `blur`: dispatch `tr.setNodeMarkup(getPos(), undefined, { rows: updatedRows })` to persist cell edits
  - Tab/Shift+Tab key listeners on cells to move focus between cells
  - "Add row" and "Add column" `<button>` elements that dispatch node markup updates
  - CSS class `gherkin-table-block` (used as e2e selector via `[data-gherkin-table]` attribute)

All mutations to `rows` go through:
```ts
editor.commands.command(({ tr }) => {
  tr.setNodeMarkup(getPos(), undefined, { rows: newRows });
  return true;
});
```

Register `GherkinDataTable` in `useEditor` extensions array alongside `GherkinImage`.

### 4. Extend `InsertableType` and insertion logic

Expand type (line ~137):
```ts
type InsertableType = GherkinBlockType | "image" | "data_table";
```

Update `getValidNextTypes` — add `data_table` for step contexts:
```ts
const STEP_TYPES: GherkinBlockType[] = ["given", "when", "then", "and", "but"];

function getValidNextTypes(previous: GherkinBlockType | null): InsertableType[] {
  const types: InsertableType[] = [...GHERKIN_BLOCK_TYPES.filter((t) => canFollow(previous, t))];
  if (previous && STEP_TYPES.includes(previous)) types.push("data_table");
  types.push("image");
  return types;
}
```

Note: when cursor is on a `gherkin_data_table` node, `getCurrentBlockType()` returns null (no `data-gherkin-type` attr) and `getPreviousBlockType()` returns the last keyword block — if that is a step type, `data_table` is offered again, allowing chained tables.

Update `insertBlock` — add branch before the `image` branch:
```ts
if (type === "data_table") {
  if (deleteSlash) {
    const { from } = editor.state.selection;
    editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
  }
  const { $from } = editor.state.selection;
  editor.chain().focus()
    .insertContentAt($from.after(), {
      type: "gherkin_data_table",
      attrs: { rows: [["",""],["",""]] },
    })
    .run();
  return;
}
```

Toolbar (lines ~476–498):
- Change filter from `type !== "image"` to `type !== "image" && type !== "data_table"`
- Add a conditional "Table" button before the Image button:
```tsx
{validNext.includes("data_table") && (
  <button
    className="gherkin-toolbar-btn"
    onMouseDown={(e) => { e.preventDefault(); insertBlock("data_table"); }}
  >
    Table
  </button>
)}
```

`BlockPicker` label (line ~215) — fix undefined label for `data_table`:
```ts
type === "image" ? "Image" : type === "data_table" ? "Table" : GHERKIN_LABELS[type]
```

### 5. Update `getAllBlocks` in `GherkinEditor.tsx`

Add branch after the `gherkin_image` branch:
```ts
if (node.type.name === "gherkin_data_table") {
  blocks.push({ type: "data_table", rows: node.attrs.rows });
}
```

### 6. Add tests in `src/lib/gherkin.test.ts`

- `exportToText` with one `DataTableBlock { rows: [["a","b"],["c","d"]] }`: expect `| a | b |\n| c | d |`
- `exportToMarkdown` with the same block: expect header row, `| --- | --- |` separator, data row
- Edge: cells of unequal width are padded to the widest in each column

### 7. E2E: `e2e/data-table.spec.ts`

```ts
// spec §3.11
test("Table button appears after inserting a Given block")
  // Feature → Scenario → Given, check toolbar button "Table" visible

test("Inserting a table creates a data_table node")
  // click Table button, expect [data-gherkin-table] visible

test("Table button is absent when cursor is on a Feature block")
  // insert Feature only, expect no toolbar button "Table"

test("Export TXT includes pipe-delimited rows for data table")
  // insert Given + Table, type cells via keyboard, export and verify | cell | format
```

## Verification

```bash
npm run test          # unit tests for export functions pass
npm run lint          # no TypeScript errors
npm run dev           # manual check below
```

Manual checks:
1. Cursor on a `given` block → toolbar shows "Table" button
2. Click "Table" → 2×2 stub appears below the step
3. Type in cells, Tab to advance between cells
4. Click "Add row" / "Add column" → table grows correctly
5. Export TXT → rows appear as `| cell | cell |`
6. Export MD → first row has separator line `| --- | --- |`
7. Cursor on `feature` block → "Table" button is absent from toolbar
