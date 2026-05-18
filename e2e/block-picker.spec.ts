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
    // Insert a Feature block, then press Enter to get an untyped line and type / there.
    // In insert mode the options are based on "after Feature": Rule, Background, Scenario.
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter"); // new untyped paragraph
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
    // Use an untyped line after Feature (insert mode) so there are multiple options
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const firstBtn = picker.locator("button").first();
    await expect(firstBtn).toHaveCSS("background", /rgb\(243, 244, 246\)/);
    await page.keyboard.press("ArrowDown");
    const secondBtn = picker.locator("button").nth(1);
    await expect(secondBtn).toHaveCSS("background", /rgb\(243, 244, 246\)/);
  });

  test("up arrow wraps selection to last item", async ({ page }) => {
    await openSession(page);
    // Use an untyped line after Feature (insert mode) so there are multiple options
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const buttons = picker.locator("button");
    const count = await buttons.count();
    await page.keyboard.press("ArrowUp");
    await expect(buttons.nth(count - 1)).toHaveCSS("background", /rgb\(243, 244, 246\)/);
  });

  test("Enter on focused item replaces block type and closes picker", async ({ page }) => {
    await openSession(page);
    // Insert a Scenario block, then type / on it — replace mode should change its type
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(picker).not.toBeVisible();
    // Block count stays the same — type was replaced, not a new block added
    const editorBlocks = page.locator(".gherkin-editor [data-gherkin-type]");
    await expect(editorBlocks).toHaveCount(2);
    // The scenario block type has changed
    const types = await editorBlocks.evaluateAll((els) => els.map((el) => el.getAttribute("data-gherkin-type")));
    expect(types[1]).not.toBe("scenario");
  });

  test("clicking an item replaces block type and closes picker", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await picker.locator("button").first().click();
    await expect(picker).not.toBeVisible();
    const editorBlocks = page.locator(".gherkin-editor [data-gherkin-type]");
    await expect(editorBlocks).toHaveCount(2);
    const types = await editorBlocks.evaluateAll((els) => els.map((el) => el.getAttribute("data-gherkin-type")));
    expect(types[1]).not.toBe("scenario");
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
