import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

// spec §3.1 — initial scaffold content

test.describe("initial scaffold content", () => {
  test("opening a new session shows exactly 5 scaffold blocks in order", async ({ page }) => {
    await openSession(page);
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(types).toEqual(["feature", "scenario", "given", "when", "then"]);
  });

  test("all scaffold blocks have empty text content", async ({ page }) => {
    await openSession(page);
    const texts = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.textContent ?? "")
    );
    expect(texts.every((t) => t === "")).toBe(true);
  });

  test("toolbar on open shows Scenario confirming cursor is on Feature block", async ({ page }) => {
    await openSession(page);
    const texts = await page.locator(".gherkin-toolbar-btn").allTextContents();
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });
});
