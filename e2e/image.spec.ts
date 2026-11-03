import { test, expect, Page } from "@playwright/test";
import { cursorPosition, documentNodes, endUndoStep, openSession } from "./helpers";
import path from "path";
import fs from "fs";
import os from "os";

// spec §3.3, §3.4, §3.6, §3.8

const PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
  "2e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082",
  "hex"
);

// Then "Before image", an image, and (unless imageLast) And "After image".
async function buildThenImageAnd(page: Page, imageLast = false) {
  await openSession(page);
  await page.locator('[data-gherkin-type="then"]').click();
  await page.keyboard.type("Before image");
  if (!imageLast) {
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    await page.keyboard.type("After image");
  }
  const tmpImg = path.join(os.tmpdir(), `test-img-${Date.now()}.png`);
  fs.writeFileSync(tmpImg, PNG_1x1);
  await page.locator('[data-gherkin-type="then"]').click();
  // The image goes after the block holding the selection, so it must be Then.
  await expect.poll(async () => (await cursorPosition(page)).index).toBe(4);
  await page.locator(".gherkin-toolbar-btn", { hasText: "Image" }).click();
  await page.locator('input[type="file"]').setInputFiles(tmpImg);
  fs.unlinkSync(tmpImg);
  await expect(page.locator(".gherkin-image-block")).toBeVisible();
}

async function centreOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

// Drops the 1×1 PNG on the editor wrapper at the given viewport coordinates.
async function dropImageAt(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ base64, x, y }: { base64: string; x: number; y: number }) => {
      const el = document.querySelector(".gherkin-editor-wrapper");
      if (!el) throw new Error("no .gherkin-editor-wrapper");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "test.png", { type: "image/png" }));
      el.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })
      );
    },
    { base64: PNG_1x1.toString("base64"), x, y }
  );
}

test.describe("image blocks", () => {
  test("SC-3.8.1: Image toolbar button opens file picker and embeds image", async ({ page }) => {
    await openSession(page);
    const tmpImg = path.join(os.tmpdir(), `test-img-${Date.now()}.png`);
    fs.writeFileSync(tmpImg, PNG_1x1);

    await page.locator('[data-gherkin-type="then"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Image" }).click();
    await page.locator('input[type="file"]').setInputFiles(tmpImg);

    await expect(page.locator(".gherkin-image-block")).toBeVisible();
    const img = page.locator(".gherkin-image-block img");
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    fs.unlinkSync(tmpImg);
  });

  test("SC-3.8.2: Slash-command Image selection opens file picker and embeds image", async ({ page }) => {
    await openSession(page);
    const tmpImg = path.join(os.tmpdir(), `test-img-${Date.now()}.png`);
    fs.writeFileSync(tmpImg, PNG_1x1);

    await page.locator('[data-gherkin-type="then"]').last().click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();

    const buttons = picker.locator("button");
    const count = await buttons.count();
    await buttons.nth(count - 1).click();

    await page.locator('input[type="file"]').setInputFiles(tmpImg);
    await expect(page.locator(".gherkin-image-block")).toBeVisible();

    fs.unlinkSync(tmpImg);
  });

  test("SC-3.8.3: Drag and drop image embeds at drop position", async ({ page }) => {
    await openSession(page);
    const { x, y } = await centreOf(page, '[data-gherkin-type="then"]');
    await dropImageAt(page, x, y);
    await expect(page.locator(".gherkin-image-block")).toBeVisible();
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "image"]);
  });

  test("SC-3.8.3: Drag and drop image embeds at drop position — cancelled file picker", async ({ page }) => {
    await openSession(page);
    // Opens the file chooser, which is left unanswered.
    await page.locator(".gherkin-toolbar-btn", { hasText: "Image" }).click();
    const { x, y } = await centreOf(page, '[data-gherkin-type="given"]');
    await dropImageAt(page, x, y);
    await expect(page.locator(".gherkin-image-block")).toBeVisible();
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "image", "when", "then"]);
  });

  test("SC-3.8.5: Image dropped outside every block embeds after the nearest block — below the last block", async ({ page }) => {
    await openSession(page);
    const box = await page.locator('[data-gherkin-type="then"]').boundingBox();
    expect(box).not.toBeNull();
    await dropImageAt(page, box!.x + box!.width / 2, box!.y + box!.height + 40);
    await expect(page.locator(".gherkin-image-block")).toBeVisible();
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "image"]);
  });

  test("SC-3.8.5: Image dropped outside every block embeds after the nearest block — on the toolbar", async ({ page }) => {
    await openSession(page);
    // Cursor in Then, so a drop that used the cursor would land after Then, not Feature.
    await page.locator('[data-gherkin-type="then"]').click();
    await expect.poll(async () => (await cursorPosition(page)).index).toBe(4);
    const { x, y } = await centreOf(page, ".gherkin-toolbar");
    await dropImageAt(page, x, y);
    await expect(page.locator(".gherkin-image-block")).toBeVisible();
    expect(await documentNodes(page)).toEqual(["feature", "image", "scenario", "given", "when", "then"]);
  });

  // spec §3.12 — image block selection
  test("SC-3.12.1: Clicking an image selects it", async ({ page }) => {
    await buildThenImageAnd(page);
    const imageBlock = page.locator(".gherkin-image-block");
    await expect(imageBlock).not.toHaveClass(/ProseMirror-selectednode/);
    await imageBlock.click();
    await expect(imageBlock).toHaveClass(/ProseMirror-selectednode/);
  });

  test("SC-3.12.2: Arrow key moves the selection onto an image", async ({ page }) => {
    await buildThenImageAnd(page);
    const imageBlock = page.locator(".gherkin-image-block");
    await page.locator('[data-gherkin-type="then"]').click();
    await page.keyboard.press("End");
    // Wait until the editor has the caret at the end of Then (node 4).
    await expect.poll(() => cursorPosition(page)).toEqual({ index: 4, offset: "Before image".length, empty: true });
    await expect(imageBlock).not.toHaveClass(/ProseMirror-selectednode/);
    await page.keyboard.press("ArrowRight");
    await expect(imageBlock).toHaveClass(/ProseMirror-selectednode/);
  });

  for (const key of ["x", "/"]) {
    test(`SC-3.12.3: Typing does not replace a selected image — ${key === "/" ? "slash" : "letter"}`, async ({ page }) => {
      await buildThenImageAnd(page);
      const editor = page.locator(".gherkin-editor");
      const textBefore = await editor.textContent();
      await page.locator(".gherkin-image-block").click();
      await page.keyboard.type(key);
      await expect(page.locator(".gherkin-image-block")).toHaveCount(1);
      expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "image", "and"]);
      expect(await editor.textContent()).toBe(textBefore);
      await expect(page.locator(".block-picker")).not.toBeVisible();
    });
  }

  test("SC-3.12.4: Backspace removes a selected image", async ({ page }) => {
    await buildThenImageAnd(page);
    await page.locator(".gherkin-image-block").click();
    await page.keyboard.press("Backspace");
    await expect(page.locator(".gherkin-image-block")).toHaveCount(0);
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "and"]);
    await expect(page.locator('[data-gherkin-type="then"]')).toHaveText("Before image");
    await expect(page.locator('[data-gherkin-type="and"]')).toHaveText("After image");
  });

  test("SC-3.12.4: Backspace removes a selected image — undo restores it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await buildThenImageAnd(page);
    const imageBlock = page.locator(".gherkin-image-block");
    await imageBlock.click();
    await endUndoStep(page);
    await page.keyboard.press("Backspace");
    await expect(imageBlock).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+z");
    await expect(imageBlock).toHaveCount(1);
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "image", "and"]);
    // Undo selects the image again, so typing must not replace it.
    await expect(imageBlock).toHaveClass(/ProseMirror-selectednode/);
    await page.keyboard.type("x");
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "image", "and"]);
    await expect(page.locator('[data-gherkin-type="then"]')).toHaveText("Before image");
    await expect(page.locator('[data-gherkin-type="and"]')).toHaveText("After image");

    // Wait until the editor has the caret in And (node 6) before each key.
    await page.locator('[data-gherkin-type="and"]').click();
    await expect.poll(async () => (await cursorPosition(page)).index).toBe(6);
    await page.keyboard.press("End");
    await expect.poll(() => cursorPosition(page)).toEqual({ index: 6, offset: "After image".length, empty: true });
    await page.keyboard.type(" still typing");
    await expect(page.locator('[data-gherkin-type="and"]')).toHaveText("After image still typing");
    expect(errors).toEqual([]);
  });
});
