import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

// spec §3.3

test.describe("block picker", () => {
  test("typing / opens the picker with valid options when editor is empty", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-editor").click();
    await page.keyboard.type("/");
    // Empty doc: only Feature is valid
    await expect(page.locator("text=Feature").first()).toBeVisible();
  });

  test("picker shows only valid next blocks for the current block", async ({ page }) => {
    await openSession(page);
    // Insert a Feature block via toolbar, then type / inside it
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    // After Feature, valid next are: Rule, Background, Scenario
    await expect(picker.locator("text=Rule")).toBeVisible();
    await expect(picker.locator("text=Background")).toBeVisible();
    await expect(picker.locator("text=Scenario")).toBeVisible();
    // Feature itself is not valid after Feature
    const texts = await picker.locator("button").allTextContents();
    expect(texts).not.toContain("Feature");
  });

  test("down arrow moves selection", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    // First item is highlighted (index 0)
    const firstBtn = picker.locator("button").first();
    await expect(firstBtn).toHaveCSS("background", /rgb\(243, 244, 246\)/);
    await page.keyboard.press("ArrowDown");
    // Second item is now highlighted
    const secondBtn = picker.locator("button").nth(1);
    await expect(secondBtn).toHaveCSS("background", /rgb\(243, 244, 246\)/);
  });

  test("up arrow wraps selection to last item", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const buttons = picker.locator("button");
    const count = await buttons.count();
    await page.keyboard.press("ArrowUp");
    // Wraps to last item
    await expect(buttons.nth(count - 1)).toHaveCSS("background", /rgb\(243, 244, 246\)/);
  });

  test("Enter on focused item inserts block and closes picker", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    // The first option after Feature is Rule; press Enter to select it
    await page.keyboard.press("Enter");
    await expect(picker).not.toBeVisible();
    // A new block should be present (rule, background, or scenario — whatever is first)
    const editorBlocks = page.locator(".gherkin-editor [data-gherkin-type]");
    await expect(editorBlocks).toHaveCount(2);
  });

  test("clicking an item inserts block and closes picker", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const firstOption = picker.locator("button").first();
    await firstOption.click();
    await expect(picker).not.toBeVisible();
    const editorBlocks = page.locator(".gherkin-editor [data-gherkin-type]");
    await expect(editorBlocks).toHaveCount(2);
  });

  test("Escape closes picker without inserting", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    const blocksBefore = await page.locator(".gherkin-editor [data-gherkin-type]").count();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).not.toBeVisible();
    await expect(page.locator(".gherkin-editor [data-gherkin-type]")).toHaveCount(blocksBefore);
  });

  test("clicking outside picker closes it without inserting", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    const blocksBefore = await page.locator(".gherkin-editor [data-gherkin-type]").count();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(picker).not.toBeVisible();
    await expect(page.locator(".gherkin-editor [data-gherkin-type]")).toHaveCount(blocksBefore);
  });
});
