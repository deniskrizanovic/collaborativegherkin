import { test, expect } from "@playwright/test";
import { openSession, clickEditor } from "./helpers";

// spec §3.4

test.describe("toolbar", () => {
  test("shows Feature as the only option when editor is empty", async ({ page }) => {
    await openSession(page);
    const buttons = page.locator(".gherkin-toolbar-btn");
    await expect(buttons).toHaveCount(1);
    await expect(buttons.first()).toHaveText("Feature");
  });

  test("clicking a toolbar button inserts a block", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await expect(page.locator('[data-gherkin-type="feature"]')).toBeVisible();
  });

  test("toolbar updates to show valid next blocks after inserting a feature block", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    // After inserting Feature, cursor moves to it; valid next: Rule, Background, Scenario
    const buttons = page.locator(".gherkin-toolbar-btn");
    const texts = await buttons.allTextContents();
    expect(texts).toContain("Rule");
    expect(texts).toContain("Background");
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });

  test("clicking Scenario toolbar button inserts a scenario block after feature", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
    await expect(page.locator('[data-gherkin-type="scenario"]')).toBeVisible();
  });
});
