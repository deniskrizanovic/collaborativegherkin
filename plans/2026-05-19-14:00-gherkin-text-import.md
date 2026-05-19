# Plan: Gherkin Text Import Modal

**Date:** 2026-05-19

## Context

Users want to paste Gherkin text from external tools (Jira, `.feature` files, notes) and have it land as structured blocks in the collaborative editor. Currently there is no way to bring external Gherkin in — the editor only supports building documents block by block by hand.

**Decisions made:**
- Entry point: dedicated Import button → modal (not a paste interceptor)
- Insert position: at cursor (standard paste behaviour)
- Sequence validation: lenient — insert all recognisable lines regardless of `canFollow()` order

---

## Spec selector audit

Affected by adding an "Import" button to the toolbar:

| File | Line | Assertion | Impact |
|------|------|-----------|--------|
| `e2e/toolbar.spec.ts` | 10 | `.gherkin-toolbar-btn` count = 1 (empty editor) | **Safe** — Import button will use `.gherkin-import-btn`, not `.gherkin-toolbar-btn` |
| `e2e/toolbar.spec.ts` | 25–29 | `.gherkin-toolbar-btn` text contents | **Safe** — same reason |

No conflicts. Export buttons already use distinct classes (`.gherkin-export-btn`, `.gherkin-export-md-btn`); Import follows the same pattern.

---

## Implementation plan

### Step 1 — Spec first: create `spec/07-import.md`

New file `spec/07-import.md`:

```
## 7.1 Gherkin text import

**Given** a user is in a session editor
**When** the editor renders
**Then** an "Import" button with class `gherkin-import-btn` is always visible in the toolbar

**Given** the user clicks the Import button
**Then** a modal overlay with class `gherkin-import-modal` opens
**And** the modal contains a textarea with class `gherkin-import-textarea`
**And** the modal contains a confirm button `.gherkin-import-confirm` ("Insert")
**And** the modal contains a cancel button `.gherkin-import-cancel` ("Cancel")

**Given** the user pastes or types Gherkin text into the textarea and clicks Insert
**Then** each recognisable keyword line is inserted as a Gherkin block at the current cursor position
**And** pipe-delimited rows (| cell | cell |) are grouped into DataTable blocks
**And** lines that do not match any keyword or table pattern are skipped
**And** blocks are inserted in the order they appear in the text, regardless of canFollow() validity
**And** the modal closes and the textarea is cleared

**Given** the user clicks Cancel
**Then** the modal closes without inserting anything

Keyword matching is case-insensitive. Colons after keywords are optional
(e.g. "Given: text" and "Given text" are both accepted).
```

### Step 2 — Parser: add `parseGherkin()` to `src/lib/gherkin.ts`

Add at the bottom of the file (after `exportToMarkdown`):

```typescript
export function parseGherkin(text: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const kwRe = /^(Feature|Rule|Background|Scenario|Given|When|Then|And|But):?\s+(.*)/i;
  const tableRe = /^\|(.+)\|$/;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const tableMatch = line.match(tableRe);
    if (tableMatch) {
      const cells = tableMatch[1].split("|").map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last?.type === "data_table") {
        (last as DataTableBlock).rows.push(cells);
      } else {
        blocks.push({ type: "data_table", rows: [cells] });
      }
      continue;
    }

    const kwMatch = line.match(kwRe);
    if (kwMatch) {
      blocks.push({
        type: kwMatch[1].toLowerCase() as GherkinBlockType,
        text: kwMatch[2].trim(),
      });
    }
  }

  return blocks;
}
```

### Step 3 — Editor: add import button and modal to `src/components/GherkinEditor.tsx`

**3a. State** (add alongside existing state near top of GherkinEditor):
```typescript
const [importOpen, setImportOpen] = useState(false);
const [importText, setImportText] = useState("");
```

**3b. Content builder** (add as a module-level helper, near `getAllBlocks`):
```typescript
function blocksToContent(blocks: DocumentBlock[]) {
  return blocks.map((b) => {
    if (b.type === "data_table")
      return { type: "gherkin_data_table", attrs: { rows: JSON.stringify(b.rows) } };
    if (b.type === "image")
      return { type: "gherkin_image", attrs: { src: b.src, alt: b.alt } };
    return {
      type: "paragraph",
      attrs: { "data-gherkin-type": b.type },
      content: b.text ? [{ type: "text", text: b.text }] : [],
    };
  });
}
```

**3c. Handler** (add inside the component, near `handleExport`):
```typescript
function handleImportConfirm() {
  if (!editor) return;
  const blocks = parseGherkin(importText);
  if (blocks.length > 0) {
    editor.commands.insertContent(blocksToContent(blocks));
  }
  setImportOpen(false);
  setImportText("");
}
```

**3d. Import button** (add in `.gherkin-toolbar`, after the Export MD button):
```tsx
<button
  className="gherkin-import-btn"
  onMouseDown={(e) => { e.preventDefault(); setImportOpen(true); }}
>
  Import
</button>
```

**3e. Modal** (add inside the outer wrapper `<div>`, after the `EditorContent`):
```tsx
{importOpen && (
  <div className="gherkin-import-modal">
    <div className="gherkin-import-modal-inner">
      <textarea
        className="gherkin-import-textarea"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={"Feature: My feature\nScenario: My scenario\nGiven some context\nWhen I do something\nThen I see the result"}
        rows={12}
      />
      <div className="gherkin-import-actions">
        <button className="gherkin-import-confirm" onClick={handleImportConfirm}>
          Insert
        </button>
        <button className="gherkin-import-cancel" onClick={() => { setImportOpen(false); setImportText(""); }}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

**3f. Import `parseGherkin`** at the top of the file alongside the existing `gherkin.ts` imports.

### Step 4 — Styling: add to `src/app/globals.css`

```css
.gherkin-import-btn {
  /* mirror export button style */
}

.gherkin-import-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.gherkin-import-modal-inner {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  width: min(560px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gherkin-import-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 0.875rem;
  background: var(--surface-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.75rem;
  resize: vertical;
}

.gherkin-import-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
```

### Step 5 — E2E tests: `e2e/import.spec.ts`

New test file covering:
1. Import button is always visible (empty editor)
2. Clicking Import opens the modal
3. Cancel closes modal without inserting blocks
4. Inserting a Feature+Scenario+Given+When+Then block sequence creates the right `[data-gherkin-type]` nodes
5. Lenient: inserting an out-of-order sequence (e.g. `Scenario:` without prior `Feature:`) still inserts the block

---

## Files to create or modify

| File | Change |
|------|--------|
| `spec/07-import.md` | New file — §7.1 Gherkin text import (write spec first) |
| `src/lib/gherkin.ts` | Add `parseGherkin()` export |
| `src/components/GherkinEditor.tsx` | Add state, handler, button, modal, import of `parseGherkin` |
| `src/app/globals.css` | Add modal + import button styles |
| `e2e/import.spec.ts` | New e2e test file |

---

## Verification

1. Run `npm run dev` + `npm run dev:ws`
2. Open a session, click **Import**
3. Paste: `Feature: Test\nScenario: First\nGiven something\nWhen action\nThen result`
4. Click **Insert** — verify 5 blocks appear with correct `data-gherkin-type` attributes
5. Test Cancel: open modal, click Cancel — verify no blocks added
6. Run `npm run test` — all Vitest tests pass
7. Run `npx playwright test` — all e2e tests pass including new `import.spec.ts`
