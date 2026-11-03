import { test, expect, Browser, Page } from "@playwright/test";
import { createSession, cursorPosition, documentNodes, waitForSync } from "./helpers";
import path from "path";
import fs from "fs";
import os from "os";

const PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
  "2e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082",
  "hex"
);

// SC-3.12.6 — the first user selects an image, the second user deletes it.
// y-prosemirror restores the first user's NodeSelection after the remote
// change; with the image last there is no node left at the saved position.
async function removeSelectedImageRemotely(page: Page, browser: Browser, imageLast: boolean) {
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  const sessionId = await createSession(page, "Remote image delete");
  const url = `http://localhost:3000/sessions/${sessionId}`;
  await page.goto(url);
  await page.waitForSelector('[data-gherkin-type="then"]');
  await waitForSync(page);

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
  expect(await documentNodes(page)).toEqual(
    imageLast
      ? ["feature", "scenario", "given", "when", "then", "image"]
      : ["feature", "scenario", "given", "when", "then", "image", "and"]
  );

  const context2 = await browser.newContext({ storageState: "e2e/.auth/user.json" });
  const page2 = await context2.newPage();
  try {
    await page2.goto(url);
    await expect(page2.locator(".gherkin-image-block")).toBeVisible({ timeout: 5000 });

    await page.locator(".gherkin-image-block").click();
    await expect(page.locator(".gherkin-image-block")).toHaveClass(/ProseMirror-selectednode/);

    await page2.locator(".gherkin-image-block").click();
    await page2.keyboard.press("Backspace");

    await expect(page.locator(".gherkin-image-block")).toHaveCount(0, { timeout: 5000 });

    await page.keyboard.type("Still typing");
    const typed = '.gherkin-editor [data-gherkin-type]';
    await expect(page.locator(typed, { hasText: "Still typing" })).toHaveCount(1);
    await expect(page2.locator(typed, { hasText: "Still typing" })).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('[data-gherkin-type="then"]')).toContainText("Before image");
    if (!imageLast) {
      await expect(page.locator('[data-gherkin-type="and"]')).toContainText("After image");
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await context2.close();
  }
}

// spec §3.5 — real-time collaboration
// Uses two separate browser contexts so BroadcastChannel cannot bridge them.
// All Y.js sync must flow through the WebSocket server — the test will catch
// a dead or broken ws server that same-context tests would miss.

test.describe("real-time collaboration", () => {
  test("SC-3.5.1: Change by one user is visible to all in real time", async ({ page, browser }) => {
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

  test("SC-3.1.2: New document seeded with 5 scaffold blocks once — second joiner does not re-seed", async ({ page, browser }) => {
    const sessionId = await createSession(page, "Seed race test");
    const url = `/sessions/${sessionId}`;

    await page.goto(`http://localhost:3000${url}`);
    await page.waitForSelector('[data-gherkin-type="feature"]');
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("Do not wipe me");

    const context2 = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page2 = await context2.newPage();
    try {
      await page2.goto(`http://localhost:3000${url}`);
      await page2.waitForSelector('[data-gherkin-type="feature"]');

      await expect(page2.locator('[data-gherkin-type="feature"]')).toContainText("Do not wipe me", { timeout: 5000 });
      await expect(page.locator('[data-gherkin-type="feature"]')).toContainText("Do not wipe me", { timeout: 5000 });
    } finally {
      await context2.close();
    }
  });

  test("SC-3.12.6: Collaborator removes an image another user has selected — image in the middle", async ({ page, browser }) => {
    await removeSelectedImageRemotely(page, browser, false);
  });

  test("SC-3.12.6: Collaborator removes an image another user has selected — image last", async ({ page, browser }) => {
    await removeSelectedImageRemotely(page, browser, true);
  });

  test("SC-3.11.10: Inserting a table does not move a collaborator's cursor", async ({ page, browser }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const sessionId = await createSession(page, "Table focus collab");
    const url = `http://localhost:3000/sessions/${sessionId}`;
    await page.goto(url);
    await page.waitForSelector('[data-gherkin-type="given"]');

    const context2 = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page2 = await context2.newPage();
    page2.on("pageerror", (err) => pageErrors.push(err));
    try {
      await page2.goto(url);
      await page2.waitForSelector('[data-gherkin-type="then"]');
      await page2.locator('[data-gherkin-type="then"]').click();

      await page.locator('[data-gherkin-type="given"]').click();
      await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();
      await expect(page.locator("[data-gherkin-table] [data-cell='0-0']")).toBeFocused();

      await expect(page2.locator("[data-gherkin-table]")).toBeVisible({ timeout: 5000 });
      expect(await page2.evaluate(() => !!document.activeElement?.closest("[data-cell]"))).toBe(false);

      await page2.keyboard.type("Collaborator marker");
      for (const p of [page, page2]) {
        await expect(p.locator('[data-gherkin-type="then"]')).toContainText("Collaborator marker", { timeout: 5000 });
        await expect(p.locator("[data-gherkin-table]")).not.toContainText("Collaborator marker");
      }
      expect(pageErrors).toEqual([]);
    } finally {
      await context2.close();
    }
  });

  // @tiptap/extension-collaboration-cursor has no Tiptap 3 stable release yet; skipped until available
  test.skip("SC-3.5.2: Remote user cursors visible in distinct colour", async ({ page, browser }) => {
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
