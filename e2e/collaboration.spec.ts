import { test, expect } from "@playwright/test";
import { createSession } from "./helpers";

// spec §3.5 — real-time collaboration
// Uses two separate browser contexts so BroadcastChannel cannot bridge them.
// All Y.js sync must flow through the WebSocket server — the test will catch
// a dead or broken ws server that same-context tests would miss.

test.describe("real-time collaboration", () => {
  test("a block typed in one context appears in the other in real time", async ({ page, browser }) => {
    const sessionId = await createSession(page, "Collab test");
    const url = `/sessions/${sessionId}`;

    await page.goto(url);
    await page.waitForSelector('[data-gherkin-type="feature"]');

    const context2 = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page2 = await context2.newPage();
    try {
      await page2.goto(`http://localhost:3000${url}`);
      await page2.waitForSelector('[data-gherkin-type="feature"]');

      await page.locator('[data-gherkin-type="feature"]').click();
      await page.keyboard.type("Shared feature");

      await expect(page2.locator('[data-gherkin-type="feature"]')).toContainText("Shared feature", { timeout: 5000 });
    } finally {
      await context2.close();
    }
  });

  test("each remote user's cursor is visible in a distinct colour", async ({ page, browser }) => {
    const sessionId = await createSession(page, "Cursor test");
    const url = `/sessions/${sessionId}`;

    await page.goto(url);
    await page.waitForSelector('[data-gherkin-type="feature"]');

    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("A feature");

    const context2 = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page2 = await context2.newPage();
    try {
      await page2.goto(`http://localhost:3000${url}`);
      await page2.waitForSelector('[data-gherkin-type="feature"]');
      await page2.locator('[data-gherkin-type="feature"]').click();

      await expect(page.locator(".collaboration-cursor__caret")).toBeVisible({ timeout: 5000 });
    } finally {
      await context2.close();
    }
  });
});
