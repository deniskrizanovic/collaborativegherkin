import { test, expect } from "@playwright/test";
import { openSession, pressEnterAndWait } from "./helpers";

// spec §3.2 — all 9 rows of the enter-progression table

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

  test("then → scenario", async ({ page }) => {
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
    expect(types[thenIdx + 1]).toBe("scenario");
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

  test("but → but", async ({ page }) => {
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
    await pressEnterAndWait(page, "but");
    const typesAfter = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(typesAfter[lastButIdx + 1]).toBe("but");
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
});
