import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

// spec §3.3

test.describe("block picker", () => {
  test("typing / opens the picker with valid options on the Feature block", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    // After Feature: Rule, Background, Scenario are valid
    await expect(page.locator("text=Scenario").first()).toBeVisible();
  });

  test("picker shows only valid next blocks for the current block", async ({ page }) => {
    await openSession(page);
    // Feature block is already seeded; press Enter to get an untyped line and type / there.
    // In insert mode the options are based on "after Feature": Rule, Background, Scenario.
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
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const firstBtn = picker.locator("button").first();
    await expect(firstBtn).toHaveCSS("background", /rgba\(0, 38, 100, 0\.06\)/);
    await page.keyboard.press("ArrowDown");
    const secondBtn = picker.locator("button").nth(1);
    await expect(secondBtn).toHaveCSS("background", /rgba\(0, 38, 100, 0\.06\)/);
  });

  test("up arrow wraps selection to last item", async ({ page }) => {
    await openSession(page);
    // Use an untyped line after Feature (insert mode) so there are multiple options
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const buttons = picker.locator("button");
    const count = await buttons.count();
    await page.keyboard.press("ArrowUp");
    await expect(buttons.nth(count - 1)).toHaveCSS("background", /rgba\(0, 38, 100, 0\.06\)/);
  });

  test("Enter on focused item replaces block type and closes picker", async ({ page }) => {
    await openSession(page);
    // Type / on the seeded Scenario block — replace mode should change its type
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(picker).not.toBeVisible();
    // Block count stays the same — type was replaced, not a new block added
    const editorBlocks = page.locator(".gherkin-editor [data-gherkin-type]");
    await expect(editorBlocks).toHaveCount(5);
    // The scenario block type has changed
    const types = await editorBlocks.evaluateAll((els) => els.map((el) => el.getAttribute("data-gherkin-type")));
    expect(types[1]).not.toBe("scenario");
  });

  test("clicking an item replaces block type and closes picker", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await picker.locator("button").first().click();
    await expect(picker).not.toBeVisible();
    const editorBlocks = page.locator(".gherkin-editor [data-gherkin-type]");
    await expect(editorBlocks).toHaveCount(5);
    const types = await editorBlocks.evaluateAll((els) => els.map((el) => el.getAttribute("data-gherkin-type")));
    expect(types[1]).not.toBe("scenario");
  });

  test("Escape closes picker without inserting", async ({ page }) => {
    await openSession(page);
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
    const blocksBefore = await page.locator(".gherkin-editor [data-gherkin-type]").count();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(picker).not.toBeVisible();
    await expect(page.locator(".gherkin-editor [data-gherkin-type]")).toHaveCount(blocksBefore);
  });

  test("Image is always the last option in the picker, regardless of active block type", async ({ page }) => {
    await openSession(page);
    // Use Enter from a typed block to create a new untyped line; the slash picker
    // will use prevType of that new line. This is the reliable cursor-placement pattern.

    // Context 1: after Feature — openSession leaves cursor on feature; press End+Enter
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    // new untyped line after scenario: prevType=scenario
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    const buttons = picker.locator("button");
    const count = await buttons.count();
    const lastText = await buttons.nth(count - 1).textContent();
    expect(lastText?.trim()).toBe("Image");
    await page.keyboard.press("Escape");

    // Context 2: after Then — press Enter from the seeded then block
    await page.locator('[data-gherkin-type="then"]').last().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    // new untyped line after then: prevType=then
    await page.keyboard.type("/");
    await expect(picker).toBeVisible();
    const count2 = await picker.locator("button").count();
    const lastText2 = await picker.locator("button").nth(count2 - 1).textContent();
    expect(lastText2?.trim()).toBe("Image");
    await page.keyboard.press("Escape");
  });
});
