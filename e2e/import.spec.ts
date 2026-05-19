import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

// spec §7.1

test.describe("Gherkin text import", () => {
  test("Import button is always visible in empty editor", async ({ page }) => {
    await openSession(page);
    await expect(page.locator(".gherkin-import-btn")).toBeVisible();
  });

  test("clicking Import opens the modal", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    await expect(page.locator(".gherkin-import-modal")).toBeVisible();
    await expect(page.locator(".gherkin-import-textarea")).toBeVisible();
    await expect(page.locator(".gherkin-import-confirm")).toBeVisible();
    await expect(page.locator(".gherkin-import-cancel")).toBeVisible();
  });

  test("Cancel closes modal without inserting blocks", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    await page.locator(".gherkin-import-textarea").fill("Feature: Should not appear");
    await page.locator(".gherkin-import-cancel").click();
    await expect(page.locator(".gherkin-import-modal")).not.toBeVisible();
    await expect(page.locator('[data-gherkin-type="feature"]')).toHaveCount(0);
  });

  test("inserting a valid Gherkin sequence creates the right blocks", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    const gherkin = [
      "Feature: My feature",
      "Scenario: My scenario",
      "Given some context",
      "When I do something",
      "Then I see the result",
    ].join("\n");
    await page.locator(".gherkin-import-textarea").fill(gherkin);
    await page.locator(".gherkin-import-confirm").click();
    await expect(page.locator(".gherkin-import-modal")).not.toBeVisible();
    await expect(page.locator('[data-gherkin-type="feature"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="scenario"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="given"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="when"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="then"]')).toHaveCount(1);
  });

  test("out-of-order sequence is inserted leniently (Scenario without Feature)", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    await page.locator(".gherkin-import-textarea").fill("Scenario: Orphan\nGiven context");
    await page.locator(".gherkin-import-confirm").click();
    await expect(page.locator('[data-gherkin-type="scenario"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="given"]')).toHaveCount(1);
  });

  test("modal textarea is cleared after Insert", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    await page.locator(".gherkin-import-textarea").fill("Feature: Test");
    await page.locator(".gherkin-import-confirm").click();
    // Reopen modal and verify textarea is empty
    await page.locator(".gherkin-import-btn").click();
    await expect(page.locator(".gherkin-import-textarea")).toHaveValue("");
  });

  test("markdown-prefixed Gherkin (headings and list items) is parsed correctly", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    const gherkin = [
      "# Feature: Markdown feature",
      "## Scenario: Markdown scenario",
      "- Given: some context",
      "- When: I do something",
      "- Then: I see the result",
    ].join("\n");
    await page.locator(".gherkin-import-textarea").fill(gherkin);
    await page.locator(".gherkin-import-confirm").click();
    await expect(page.locator(".gherkin-import-modal")).not.toBeVisible();
    await expect(page.locator('[data-gherkin-type="feature"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="scenario"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="given"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="when"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="then"]')).toHaveCount(1);
  });

  test("pipe-delimited rows in import text produce a data table block", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-import-btn").click();
    const gherkin = [
      "Scenario: Table import",
      "Given the following users:",
      "| name  | role  |",
      "| --- | --- |",
      "| Alice | admin |",
      "| Bob   | user  |",
    ].join("\n");
    await page.locator(".gherkin-import-textarea").fill(gherkin);
    await page.locator(".gherkin-import-confirm").click();
    await expect(page.locator(".gherkin-import-modal")).not.toBeVisible();
    await expect(page.locator('[data-gherkin-type="scenario"]')).toHaveCount(1);
    await expect(page.locator('[data-gherkin-type="given"]')).toHaveCount(1);
    await expect(page.locator("[data-gherkin-table]")).toHaveCount(1);
  });
});
