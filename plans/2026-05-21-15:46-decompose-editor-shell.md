# Plan: Decompose the editor shell

## Context

`GherkinEditor.tsx` is 952 lines — a shallow shell whose single-component interface gives callers no leverage over its internals, and makes every concern untestable in isolation. The architecture review identifies four extractions: `useCollabProvider`, `useGherkinKeyboard` (with picker state and insert logic), `BlockPicker`, and `GherkinDataTable`. The result is a ~150-line shell that composes four focused modules, each with its own testable interface.

Decisions confirmed during grilling:
- `useCollabProvider` extracts Y.js + WS lifecycle, preserving the synchronous-init pattern
- `useGherkinKeyboard` owns picker state (option B) and `insertBlock` (option A); image file upload exposed via a `triggerFileUpload` callback seam
- `GherkinDataTable`: whole node definition (schema + view factory) moves to its own file with Vitest + jsdom unit tests
- `BlockPicker`: moves to its own file as a pure UI component
- No e2e spec changes needed — all DOM selectors (`[data-gherkin-table]`, `.gherkin-table-toolbar-btn`, `.gherkin-editor`) survive unchanged

---

## Files to create

| File | Contents |
|------|----------|
| `src/components/useCollabProvider.ts` | Y.Doc + WebsocketProvider lifecycle |
| `src/components/useGherkinKeyboard.ts` | Enter/Slash handlers, picker state, insertBlock |
| `src/components/BlockPicker.tsx` | Pure picker UI component (extracted verbatim) |
| `src/components/GherkinDataTable.tsx` | Full `Node.create(...)` definition + view factory |
| `src/components/GherkinDataTable.test.ts` | Vitest + jsdom unit tests for toolbar mutations |

## Files to modify

| File | Change |
|------|--------|
| `src/components/GherkinEditor.tsx` | Remove all extracted code; import and compose the four modules above; target ~150 lines |

---

## Step-by-step implementation

### Step 1 — Extract `GherkinDataTable` + unit tests

Create `src/components/GherkinDataTable.tsx`:
- Move lines 63–312 verbatim (the full `GherkinDataTable = Node.create({...})`)
- Export as `export const GherkinDataTable`
- Also export the `STEP_TYPES` constant (line 61) since `useGherkinKeyboard` needs it for `getValidNextTypes`

Create `src/components/GherkinDataTable.test.ts`:
- Import `GherkinDataTable` and call its `addNodeView` factory with:
  - A mock `getPos` function returning a fixed position
  - A minimal mock editor with `commands.command` and `state.doc.nodeAt`
- Fire `mousedown` on toolbar buttons and assert `rows` mutations for:
  - insert row above / below
  - delete row (including guard: rows.length ≤ 1)
  - insert col before / after
  - delete col (including guard: cols ≤ 1)
  - delete table (asserts `tr.delete` was called)
- Test `update()` method: passing a new `rows` attribute rebuilds the table

### Step 2 — Extract `BlockPicker`

Create `src/components/BlockPicker.tsx`:
- Move lines 442–496 verbatim (the `BlockPickerProps` interface and `BlockPicker` function)
- Move the shared types it needs: `InsertableType`, `INSERTABLE_LABELS`
- Export: `BlockPicker`, `BlockPickerProps`, `InsertableType`, `INSERTABLE_LABELS`
- Also export helper types/functions that `useGherkinKeyboard` will need: `getValidNextTypes`, `STEP_TYPES` (or import from `GherkinDataTable`)

### Step 3 — Extract `useCollabProvider`

Create `src/components/useCollabProvider.ts`:

```ts
export function useCollabProvider(sessionId: string, wsUrl: string): {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}
```

Preserve the synchronous-init pattern exactly (refs initialised during render, outside any effect), with cleanup in `useEffect` on unmount.

### Step 4 — Extract `useGherkinKeyboard`

Create `src/components/useGherkinKeyboard.ts`:

```ts
export function useGherkinKeyboard(
  editor: Editor | null,
  triggerFileUpload: () => void
): {
  handleKeyDown: (view: EditorView, event: KeyboardEvent) => boolean;
  pickerState: PickerState;
  closePicker: () => void;
  handlePickerSelect: (type: InsertableType) => void;
}
```

Move into this hook:
- `getPreviousBlockType`, `getCurrentBlockType`, `getAllBlocks` helper functions (currently lines 351–388)
- `insertAtomNode`, `insertImageFromFile` (lines 419–440)
- `insertBlock` callback (lines 668–724)
- Enter key handler (lines 578–604)
- Slash key handler (lines 606–622)
- Picker keyboard navigation effect (lines 726–752)
- All picker state: `pickerState`, `pickerStateRef`, `closePicker`, `handlePickerSelect`
- `blocksToContent` (line 405–417) — moved here if only used by import confirm; otherwise keep in shell

`handleKeyDown` is the function passed to Tiptap's `editorProps.handleKeyDown`.

### Step 5 — Slim `GherkinEditor.tsx` to ~150 lines

After imports, the shell retains:
- `GherkinImage` node definition (lines 25–59) — small, rendering-only, no test value
- `GherkinParagraph` node definition (lines 314–341) — same
- `CURSOR_COLORS` + `randomColor` (lines 343–349)
- `useCollabProvider(sessionId, wsUrl)` call
- `useGherkinKeyboard(editor, () => fileInputRef.current?.click())` call
- `useEditor(...)` with extensions array (now compact — imports replace inline definitions)
- Seeded content effect (lines 630–666)
- `useImperativeHandle` (lines 762–767)
- `handleExport`, `handleExportMarkdown` (lines 769–793)
- `handleImportConfirm` + import modal state (lines 795–825)
- JSX render (~80 lines)

### Step 6 — Update barrel imports / verify TypeScript

Run `npm run build` (or `npx tsc --noEmit`) to confirm no import errors.

---

## Verification

```bash
npm run test                    # Vitest — GherkinDataTable unit tests must pass
npx tsc --noEmit               # no TypeScript errors
npx playwright test            # all e2e specs green (no selector changes)
```

Manual smoke test:
1. Start `npm run dev` + `npm run dev:ws`
2. Create a session — verify 5 scaffold blocks appear
3. Press `/` — verify block picker opens and keyboard nav works
4. Press Enter on a block — verify correct next-block type is inserted
5. Insert a table via `/` → Table — verify toolbar buttons (insert/delete row/col)
6. Drop an image — verify it renders
7. Click "Get AI Coaching" — verify review modal opens
