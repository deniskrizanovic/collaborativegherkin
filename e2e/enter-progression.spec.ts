import { test, expect } from "@playwright/test";
import { openSession, pressEnterAndWait } from "./helpers";
import path from "path";
import fs from "fs";
import os from "os";

// spec §3.2 — all 9 rows of the enter-progression table + image Enter

test.describe("enter-key auto-progression", () => {
  // Insert a sequence of blocks by using the toolbar/picker for the first one,
  // then pressing Enter to create the rest and checking data-gherkin-type values.

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — feature → scenario", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(types[1]).toBe("scenario");
  });

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — scenario → given", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // feature → scenario (new one inserted after seed's scenario)
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const lastScenarioIdx = types.lastIndexOf("scenario");
    expect(types[lastScenarioIdx + 1]).toBe("given");
  });

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — given → when", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // feature → scenario
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.press("Enter"); // scenario → given
    await page.locator('[data-gherkin-type="given"]').last().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const givenIdx = types.lastIndexOf("given");
    expect(types[givenIdx + 1]).toBe("when");
  });

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — when → then", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.press("Enter"); // → scenario
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.press("Enter"); // → given
    await page.locator('[data-gherkin-type="given"]').last().click();
    await page.keyboard.press("Enter"); // → when
    await page.locator('[data-gherkin-type="when"]').last().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    const whenIdx = types.lastIndexOf("when");
    expect(types[whenIdx + 1]).toBe("then");
  });

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — then → and", async ({ page }) => {
    await openSession(page);
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");
    await pressEnterAndWait(page, "and");
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    // Find a "then" immediately followed by "and"
    const thenFollowedByAnd = types.some((t, i) => t === "then" && types[i + 1] === "and");
    expect(thenFollowedByAnd).toBe(true);
  });

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — and → and", async ({ page }) => {
    await openSession(page);
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

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — but → and", async ({ page }) => {
    await openSession(page);
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

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — background → given", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
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

  test("SC-3.2.1: Enter at end of block inserts auto-progression type — rule → scenario", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="feature"]').click();
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
  test("SC-3.2.2: Enter on image block uses prevType context", async ({ page }) => {
    await openSession(page);

    // Build: feature → scenario → given → when → then
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
