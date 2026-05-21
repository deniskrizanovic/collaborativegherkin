# Plan: Pre-populated scaffold canvas for new sessions

**Created:** 2026-05-21

## Context

New sessions open to a completely blank canvas, which is confronting for first-time users. The change seeds every new session with 5 empty keyword-only blocks — Feature, Scenario, Given, When, Then — so users see the shape of a Gherkin document immediately and just need to fill in text. This replaces the blank white box with a recognisable scaffold.

The seed fires on the client after Y.js synchronisation, not on the server, to avoid touching the DB schema or Y.js persistence layer.

---

## Step 0 — Update `spec/03-editor.md`

**Section 3.1 Loading** — append the following after the existing Given/When/Then block:

```
**Given** the Y.js document is empty after synchronisation
**When** the first user's editor finishes syncing
**Then** the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then
**And** each scaffold block contains no text — only the keyword label is displayed
**And** the cursor is placed at the start of the Feature block
**And** the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding
```

---

## Step 1 — Seed logic in `src/components/GherkinEditor.tsx`

**What:** Add a `useEffect` that listens for the WebsocketProvider `synced` event, checks whether the Y.js doc has zero typed blocks, and if so inserts the 5 scaffold blocks and places the cursor on Feature.

**Where to insert:** After the existing cleanup `useEffect` (line ~535), before the `fileInputRef` declaration.

```typescript
const seededRef = useRef(false);

useEffect(() => {
  if (!editor) return;
  const provider = providerRef.current;
  if (!provider) return;

  const handleSynced = () => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (getAllBlocks(editor.state).length === 0) {
      editor.commands.setContent({
        type: "doc",
        content: [
          { type: "paragraph", attrs: { "data-gherkin-type": "feature" }, content: [] },
          { type: "paragraph", attrs: { "data-gherkin-type": "scenario" }, content: [] },
          { type: "paragraph", attrs: { "data-gherkin-type": "given" }, content: [] },
          { type: "paragraph", attrs: { "data-gherkin-type": "when" }, content: [] },
          { type: "paragraph", attrs: { "data-gherkin-type": "then" }, content: [] },
        ],
      });
      editor.commands.setTextSelection(1);
    }
  };

  // Guard against synced having already fired before this effect ran
  if ((provider as unknown as { synced?: boolean }).synced) {
    handleSynced();
  } else {
    provider.on("synced", handleSynced);
  }

  return () => { provider.off("synced", handleSynced); };
}, [editor]);
```

**Reuses:** `getAllBlocks` (line 375), existing `providerRef`/`ydocRef` pattern.

---

## Step 2 — Update `e2e/helpers.ts`

`openSession` currently waits for `.gherkin-editor` and clicks it. Update to wait for the seed's Feature block and click it specifically.

```typescript
export async function openSession(page: Page, title = "Test session"): Promise<string> {
  const id = await createSession(page, title);
  await page.goto(`/sessions/${id}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');
  await page.locator('[data-gherkin-type="feature"]').click();
  return id;
}
```

---

## Step 3 — New spec `e2e/initial-content.spec.ts`

New file verifying the scaffold:

```typescript
import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

test.describe("initial scaffold content", () => {
  test("opening a new session shows exactly 5 scaffold blocks in order", async ({ page }) => {
    await openSession(page);
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(types).toEqual(["feature", "scenario", "given", "when", "then"]);
  });

  test("all scaffold blocks have empty text content", async ({ page }) => {
    await openSession(page);
    const texts = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.textContent ?? "")
    );
    expect(texts.every((t) => t === "")).toBe(true);
  });

  test("toolbar on open shows Scenario confirming cursor is on Feature block", async ({ page }) => {
    await openSession(page);
    const texts = await page.locator(".gherkin-toolbar-btn").allTextContents();
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });
});
```

---

## Step 4 — Update `e2e/enter-progression.spec.ts`

All 10 tests open with a Feature toolbar click that is now redundant. Remove each one. The seed already provides the Feature block.

- Tests "feature → scenario" through "then → and": remove the `page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click()` line at the start of each test body.
- Tests "background → given" and "rule → scenario": remove the Feature toolbar click; keep the Background/Rule toolbar click. Add `await page.locator('[data-gherkin-type="feature"]').click();` before the Background/Rule toolbar click to ensure context is correct.
- Test "Enter on image block inserts next block by prevType context": remove the Feature toolbar click at line 168.

---

## Step 5 — Update `e2e/block-picker.spec.ts`

All 6 tests start with a Feature toolbar click. Remove each.

Tests with hard-coded `toHaveCount(2)` assertions (lines 81, 98):
- After the seed, the picker *replaces* the current block type (doesn't insert a new one), so block count stays at 5. Change `toHaveCount(2)` → `toHaveCount(5)`.

Tests with `blocksBefore` dynamic capture (lines 113, 126):
- `blocksBefore` is captured dynamically — no change needed.

---

## Step 6 — Update `e2e/toolbar.spec.ts`

Test "shows Feature as the only option when editor is empty": rewrite to test the new initial state — after `openSession`, toolbar should *not* show Feature and *should* show Scenario, Rule, Background.

Other tests: remove the Feature toolbar click at the start of each.

---

## Step 7 — Update `e2e/import.spec.ts`

**"Cancel closes modal without inserting blocks":**  
`toHaveCount(0)` on feature → change to `toHaveCount(1)`.

**"inserting a valid Gherkin sequence":**  
Import inserts after the cursor (Feature block). Seed + imported = 2 of each. Change all `toHaveCount(1)` → `toHaveCount(2)`.

**"out-of-order sequence":**  
Counts: scenario → 2, given → 2.

**"markdown-prefixed Gherkin":**  
All counts: 1 → 2.

**"pipe-delimited rows / data table import":**  
scenario → 2, given → 2.

---

## Step 8 — Update `e2e/export.spec.ts`

Replace Enter-key progression (which interleaves with seed blocks) with direct clicks on seed blocks and typing into them.

**Pattern for all 3 export tests:**
```typescript
// cursor already on Feature from openSession
await page.keyboard.type("...");
await page.locator('[data-gherkin-type="scenario"]').first().click();
await page.keyboard.type("...");
await page.locator('[data-gherkin-type="given"]').first().click();
await page.keyboard.type("...");
// etc.
```
Remove Feature toolbar click. Export assertions on `lines[0]`–`lines[4]` remain identical.

---

## Step 9 — Update `e2e/data-table.spec.ts`

Remove Feature toolbar click from each test. Enter-key progressions still work (seed Feature → press Enter → new Scenario, etc.).

---

## Step 10 — Update `e2e/visual-separation.spec.ts`

Remove Feature toolbar click from each of the 8 tests. `pressEnterAndWait` is count-based and works correctly against seed's pre-existing blocks.

---

## Step 11 — Update `e2e/collaboration.spec.ts`

Both tests use `createSession` directly and don't call `openSession`. Add `waitForSelector('[data-gherkin-type="feature"]')` for both page1 and page2 after the existing `.gherkin-editor` wait. Remove Feature toolbar clicks (lines 22, 40).

---

## Step 12 — Capture new screenshots

Inspect `scripts/capture-screenshots.ts` and update it to:
- Wait for `[data-gherkin-type="feature"]` instead of `.gherkin-editor`
- Remove Feature toolbar clicks
- Save as `session-populated.png` and `toolbar-populated.png`

Run it once to generate the screenshots.

---

## Step 13 — Update `README.md`

- Line 40: caption "Empty session editor" → "Session editor with initial scaffold", filename `session-empty.png` → `session-populated.png`
- Line 44: caption "Toolbar on empty editor — only Feature is offered" → "Toolbar after opening a session — cursor on Feature block", filename `toolbar-empty.png` → `toolbar-populated.png`

---

## Verification

1. `npm run dev` + `npm run dev:ws` both running.
2. Open a new session in the browser — confirm 5 keyword blocks appear, cursor on Feature.
3. Refresh the page — confirm the seed does NOT re-apply (blocks retained from Y.js, not duplicated).
4. Open the same session in a second tab — confirm second tab sees seeded content without re-seeding.
5. `npx playwright test` — all tests green.
6. Confirm `docs/screenshots/session-populated.png` and `docs/screenshots/toolbar-populated.png` exist.
7. Confirm README references the new filenames.
