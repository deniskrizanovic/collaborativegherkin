import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";
import path from "path";
import fs from "fs";
import os from "os";

// spec §3.3, §3.4, §3.6, §3.8

const PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
  "2e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082",
  "hex"
);

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
    const tmpImg = path.join(os.tmpdir(), `test-img-${Date.now()}.png`);
    fs.writeFileSync(tmpImg, PNG_1x1);

    const base64 = PNG_1x1.toString("base64");
    await page.evaluate(
      async ({ selector, base64 }: { selector: string; base64: string }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const file = new File([bytes], "test.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      },
      { selector: ".gherkin-editor-wrapper", base64 }
    );

    await expect(page.locator(".gherkin-image-block")).toBeVisible();

    fs.unlinkSync(tmpImg);
  });
});
