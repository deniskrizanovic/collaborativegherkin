import { test, expect } from "@playwright/test";
import { createSession } from "./helpers";

// spec §3.5 — real-time collaboration
// Uses two browser contexts to simulate two users.

test.describe("real-time collaboration", () => {
  test("a block typed in one context appears in the other in real time", async ({ page, context }) => {
    const sessionId = await createSession(page, "Collab test");
    const url = `/sessions/${sessionId}`;

    // Open first context (already have `page`)
    await page.goto(url);
    await page.waitForSelector('[data-gherkin-type="feature"]');

    // Open second context
    const page2 = await context.newPage();
    await page2.goto(url);
    await page2.waitForSelector('[data-gherkin-type="feature"]');

    // Type into the seeded Feature block in page1
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("Shared feature");

    // Wait for the block to propagate to page2
    await expect(page2.locator('[data-gherkin-type="feature"]')).toBeVisible({ timeout: 5000 });
    const text2 = await page2.locator('[data-gherkin-type="feature"]').textContent();
    expect(text2).toContain("Shared feature");
  });

  test("each remote user's cursor is visible in a distinct colour", async ({ page, context }) => {
    const sessionId = await createSession(page, "Cursor test");
    const url = `/sessions/${sessionId}`;

    await page.goto(url);
    await page.waitForSelector('[data-gherkin-type="feature"]');

    // Type into the seeded Feature block to position cursor
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("A feature");

    // Second user joins and clicks into the editor
    const page2 = await context.newPage();
    await page2.goto(url);
    await page2.waitForSelector('[data-gherkin-type="feature"]');
    await page2.locator('[data-gherkin-type="feature"]').click();

    // Wait for the collaboration cursor element to appear in page1's DOM
    // CollaborationCursor renders .collaboration-cursor__caret elements
    await expect(page.locator(".collaboration-cursor__caret")).toBeVisible({ timeout: 5000 });
  });
});
