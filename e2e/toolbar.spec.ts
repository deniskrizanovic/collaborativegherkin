import { test, expect } from "@playwright/test";
import { openSession, clickEditor } from "./helpers";

// spec §3.4

test.describe("toolbar", () => {
  test("shows valid next blocks after opening a session (cursor on Feature block)", async ({ page }) => {
    await openSession(page);
    // Seed places cursor on Feature; toolbar should show valid next blocks, not Feature itself
    const buttons = page.locator(".gherkin-toolbar-btn");
    const texts = await buttons.allTextContents();
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });

  test("toolbar shows Rule, Background, Scenario when cursor is on Feature", async ({ page }) => {
    await openSession(page);
    const buttons = page.locator(".gherkin-toolbar-btn");
    const texts = await buttons.allTextContents();
    expect(texts).toContain("Rule");
    expect(texts).toContain("Background");
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });

  test("clicking a toolbar button inserts a block", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Rule" }).click();
    await expect(page.locator('[data-gherkin-type="rule"]')).toBeVisible();
  });

  test("clicking Scenario toolbar button inserts a scenario block after feature", async ({ page }) => {
    await openSession(page);
    const countBefore = await page.locator('[data-gherkin-type="scenario"]').count();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
    await expect(page.locator('[data-gherkin-type="scenario"]')).toHaveCount(countBefore + 1);
  });
});
