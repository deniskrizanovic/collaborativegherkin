import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

// spec §3.1 — initial scaffold content

test.describe("initial scaffold content", () => {
  test("SC-3.1.2: New document seeded with 5 scaffold blocks once — order", async ({ page }) => {
    await openSession(page);
    const types = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    );
    expect(types).toEqual(["feature", "scenario", "given", "when", "then"]);
  });

  test("SC-3.1.2: New document seeded with 5 scaffold blocks once — empty text", async ({ page }) => {
    await openSession(page);
    const texts = await page.locator(".gherkin-editor [data-gherkin-type]").evaluateAll(
      (els) => els.map((el) => el.textContent ?? "")
    );
    expect(texts.every((t) => t === "")).toBe(true);
  });

  test("SC-3.1.2: New document seeded with 5 scaffold blocks once — cursor on Feature", async ({ page }) => {
    await openSession(page);
    const texts = await page.locator(".gherkin-toolbar-btn").allTextContents();
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });
});
