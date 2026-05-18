# Fix: RangeError "no position after top-level node" on Enter after image

## Context

When a `gherkin_image` node is inserted it becomes an atom block (`atom: true`).
Selecting it gives a ProseMirror **NodeSelection** where `$from.depth === 0`
(the node sits directly under the document root). The `handleKeyDown` Enter
handler unconditionally calls `$from.after()`, which internally calls
`this.after(this.depth)` → `this.after(0)` — ProseMirror throws
`"There is no position after the top-level node"` whenever depth is 0.

The fix is narrow: replace the single `$from.after()` call in the Enter
handler with a depth-aware helper, and add a spec entry + e2e test for the new
behaviour.

---

## Behaviour to add

When the cursor/selection is on an image block and the user presses Enter,
insert a new block after the image using the **previous Gherkin block type's
auto-progression** (same context the current code already derives via
`prevType`). This mirrors what would happen if the image were invisible —
Enter continues the Gherkin sequence from wherever the image was inserted.

Example: `then` → image → Enter → `and`

---

## Files to change

| File | Change |
|------|--------|
| `spec/03-editor.md` | Add §3.2 row + §3.8 Enter entry |
| `e2e/enter-progression.spec.ts` | Add test: Enter on image inserts next block |
| `src/components/GherkinEditor.tsx` | Fix `$from.after()` at line 302 |

**Do NOT touch** `src/lib/gherkin.ts` (on the Do Not Touch list).

---

## Implementation steps

### 1. Update spec/03-editor.md

In §3.2 add a note below the table:

> **Given** the cursor is on an image block  
> **When** the user presses Enter  
> **Then** a new block is inserted after the image using the auto-progression
> type of the most recent Gherkin block that precedes the image

### 2. Add e2e test in e2e/enter-progression.spec.ts

Following the existing pattern (`pressEnterAndWait`, `.gherkin-editor` focus):

```
test("Enter on image block inserts next block by prevType context", async ({ page }) => {
  // insert a Then block, then an image (via drag or toolbar/slash),
  // click the image to select it, press Enter,
  // assert a new 'and' block appears after the image
});
```

### 3. Fix src/components/GherkinEditor.tsx line 302

Replace:
```typescript
const insertPos = $from.after();
```

With:
```typescript
const insertPos =
  $from.depth > 0
    ? $from.after()
    : $from.pos + ($from.nodeAfter?.nodeSize ?? 1);
```

`$from.nodeAfter` on a NodeSelection at depth 0 is the selected node (the
image), so `$from.pos + nodeSize` is the position immediately after it —
exactly where the new paragraph should go.

---

## Verification

1. `npm run test` — existing unit tests must still pass
2. Start `npm run dev` + `npm run dev:ws`, open a session
3. Add a Feature → Scenario → Then block
4. Insert an image via toolbar or slash command
5. Click the image to select it, press Enter
6. Confirm a new `and` block appears after the image with no console errors
7. Run `npm run test` (Vitest + e2e) after adding the new test
