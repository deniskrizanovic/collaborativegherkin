import { expect, Page } from "@playwright/test";

export async function pressEnterAndWait(page: Page, expectedType: string): Promise<void> {
  const before = await page.locator(`[data-gherkin-type="${expectedType}"]`).count();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ({ selector, before }: { selector: string; before: number }) =>
      document.querySelectorAll(selector).length > before,
    { selector: `[data-gherkin-type="${expectedType}"]`, before }
  );
  await page.locator(`[data-gherkin-type="${expectedType}"]`).last().click();
}

export async function createSession(page: Page, title: string): Promise<string> {
  const res = await page.request.post("/api/sessions", {
    data: { title },
  });
  const body = await res.json();
  return body.id as string;
}

export async function openSession(page: Page, title = "Test session"): Promise<string> {
  const id = await createSession(page, title);
  await page.goto(`/sessions/${id}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');
  await waitForSync(page);
  await page.locator('[data-gherkin-type="feature"]').click();
  return id;
}

/**
 * Wait until the sync banner is gone. The banner sits above the toolbar, so
 * it vanishing on connect shifts every block and button — a click aimed
 * before that can land on the wrong element.
 */
export async function waitForSync(page: Page): Promise<void> {
  await expect(page.locator(".gherkin-conn-banner")).toHaveCount(0);
}

/**
 * Top-level document nodes in order: the block's data-gherkin-type, or
 * "image" / "table" for atom nodes. Mirrors Robot's `Document Nodes In Editor`.
 */
export async function documentNodes(page: Page): Promise<string[]> {
  return page.locator(".gherkin-editor").evaluate((el) =>
    [...el.children].map((child) => {
      const type = child.getAttribute("data-gherkin-type");
      if (type) return type;
      if (child.classList.contains("gherkin-image-block")) return "image";
      if (child.hasAttribute("data-gherkin-table")) return "table";
      return child.tagName.toLowerCase();
    })
  );
}

/**
 * Where the editor's selection starts: `index` of its top-level node among
 * `documentNodes`, `offset` in that block's text, `empty` for a bare cursor.
 * Reads editor state through the handle Tiptap puts on the editor's DOM node.
 * Mirrors Robot's `Cursor Position`. ProseMirror picks up caret moves made by
 * keys such as End a few ms after the key, so poll it before the next key.
 */
export async function cursorPosition(page: Page): Promise<{ index: number; offset: number; empty: boolean }> {
  return page.locator(".gherkin-editor").evaluate((el) => {
    const { $from, empty } = (el as unknown as { editor: import("@tiptap/core").Editor }).editor.state.selection;
    return { index: $from.index(0), offset: $from.parentOffset, empty };
  });
}

/**
 * Close the current undo step. The Y.js undo manager merges every change made
 * within its capture window (500 ms) into one step, so a fast test's next
 * change would otherwise be undone together with everything typed before it.
 * Mirrors Robot's `End Undo Step`.
 */
export async function endUndoStep(page: Page): Promise<void> {
  await page.locator(".gherkin-editor").evaluate((el) => {
    const { state } = (el as unknown as { editor: import("@tiptap/core").Editor }).editor;
    const plugin = state.plugins.find((p) => (p as unknown as { key: string }).key.startsWith("y-undo$"));
    const undoManager = (plugin?.getState(state) as { undoManager?: { stopCapturing(): void } } | undefined)?.undoManager;
    if (!undoManager) throw new Error("endUndoStep: no y-undo plugin with an undoManager on the editor");
    undoManager.stopCapturing();
  });
}

export function editorLocator(page: Page) {
  return page.locator(".gherkin-editor");
}

export async function clickEditor(page: Page) {
  await editorLocator(page).click();
}
