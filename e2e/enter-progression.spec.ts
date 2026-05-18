import { test, expect } from "@playwright/test";
import { openSession, pressEnterAndWait } from "./helpers";
import path from "path";
import fs from "fs";
import os from "os";

// spec §3.2 — all 9 rows of the enter-progression table + image Enter

test.describe("enter-key auto-progression", () => {
  // Insert a sequence of blocks by using the toolbar/picker for the first one,
  // then pressing Enter to create the rest and checking data-gherkin-type values.

  test("feature → scenario", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(types[1]).toBe("scenario");
  });

  test("scenario → given", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // feature → scenario
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(types[2]).toBe("given");
  });

  test("given → when", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // feature → scenario
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.press("Enter"); // scenario → given
    await page.locator('[data-gherkin-type="given"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const givenIdx = types.indexOf("given");
    expect(types[givenIdx + 1]).toBe("when");
  });

  test("when → then", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // → scenario
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.press("Enter"); // → given
    await page.locator('[data-gherkin-type="given"]').click();
    await page.keyboard.press("Enter"); // → when
    await page.locator('[data-gherkin-type="when"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const whenIdx = types.indexOf("when");
    expect(types[whenIdx + 1]).toBe("then");
  });

  test("then → and", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // → scenario
    await page.locator('[data-gherkin-type="scenario"]').click();
    await page.keyboard.press("Enter"); // → given
    await page.locator('[data-gherkin-type="given"]').click();
    await page.keyboard.press("Enter"); // → when
    await page.locator('[data-gherkin-type="when"]').click();
    await page.keyboard.press("Enter"); // → then
    await page.locator('[data-gherkin-type="then"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const thenIdx = types.indexOf("then");
    expect(types[thenIdx + 1]).toBe("and");
  });

  test("and → and", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    // Insert an 'and' block via toolbar
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    await page.locator('[data-gherkin-type="and"]').last().click();
    await page.keyboard.press("End");
    const typesBefore = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const lastAndBefore = typesBefore.lastIndexOf("and");
    await pressEnterAndWait(page, "and");
    const typesAfter = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(typesAfter[lastAndBefore + 1]).toBe("and");
  });

  test("but → and", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await page.locator(".gherkin-toolbar-btn", { hasText: "But" }).click();
    await page.locator('[data-gherkin-type="but"]').last().click();
    await page.keyboard.press("End");
    const typesBefore = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const lastButIdx = typesBefore.lastIndexOf("but");
    await pressEnterAndWait(page, "and");
    const typesAfter = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(typesAfter[lastButIdx + 1]).toBe("and");
  });

  test("background → given", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Background" }).click();
    await page.locator('[data-gherkin-type="background"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const bgIdx = types.indexOf("background");
    expect(types[bgIdx + 1]).toBe("given");
  });

  test("rule → scenario", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Rule" }).click();
    await page.locator('[data-gherkin-type="rule"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const ruleIdx = types.indexOf("rule");
    expect(types[ruleIdx + 1]).toBe("scenario");
  });

  // spec §3.2 — image block: Enter inserts next block using prevType context
  test("Enter on image block inserts next block by prevType context", async ({ page }) => {
    await openSession(page);

    // Build: feature → scenario → given → when → then
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");

    // Insert an image after the 'then' block via the toolbar Image button
    const tmpImg = path.join(os.tmpdir(), "test-gherkin.png");
    // minimal 1×1 red PNG
    const PNG_1x1 = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
      "2e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082",
      "hex"
    );
    fs.writeFileSync(tmpImg, PNG_1x1);

    await page.locator('[data-gherkin-type="then"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Image" }).click();
    await page.locator('input[type="file"]').setInputFiles(tmpImg);

    // Wait for image block to appear
    await page.waitForSelector(".gherkin-image-block");

    // Click the image block to select it, then press Enter
    await page.locator(".gherkin-image-block").click();
    const typesBefore = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const countBefore = typesBefore.length;

    await page.keyboard.press("Enter");

    // A new block should appear after the image — prevType is 'then', so next is 'and'
    await page.waitForFunction(
      (count: number) => document.querySelectorAll("[data-gherkin-type]").length > count,
      countBefore
    );
    const typesAfter = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(typesAfter[typesAfter.length - 1]).toBe("and");

    fs.unlinkSync(tmpImg);
  });
});
