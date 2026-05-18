import { test, expect } from "@playwright/test";
import { openSession, pressEnterAndWait } from "./helpers";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// spec §3.7
// Visual separation is implemented via CSS: a given block that follows then/and/but
// gets border-top + padding-top. We verify the computed style rather than an <hr> element,
// since globals.css uses a CSS sibling selector to draw the visual border.

test.describe("visual separation", () => {
  test("given after then has a top border (start of new step group)", async ({ page }) => {
    await openSession(page);

    // Build: Feature → Scenario → Given → When → Then → (then→scenario via Enter,
    // then insert a second Given after the then manually via toolbar)
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");

    // Insert And after then, then insert Given after And
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    await page.locator('[data-gherkin-type="and"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Given" }).click();

    const givenBlocks = page.locator('[data-gherkin-type="given"]');
    // The second given block follows then, so it should have a top border
    const secondGiven = givenBlocks.last();
    const borderTop = await secondGiven.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    expect(borderTop).toBe("1px");
  });

  test("given after and has a top border", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");
    // Insert an And after then
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    // Insert a Given after the and
    await page.locator('[data-gherkin-type="and"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Given" }).click();

    const givenBlocks = page.locator('[data-gherkin-type="given"]');
    const lastGiven = givenBlocks.last();
    const borderTop = await lastGiven.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    expect(borderTop).toBe("1px");
  });

  test("given after but has a top border", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");
    await page.locator(".gherkin-toolbar-btn", { hasText: "But" }).click();
    await page.locator('[data-gherkin-type="but"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Given" }).click();

    const givenBlocks = page.locator('[data-gherkin-type="given"]');
    const lastGiven = givenBlocks.last();
    const borderTop = await lastGiven.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    expect(borderTop).toBe("1px");
  });

  test("scenario after then has a top border (start of new step group)", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");
    // Enter after "then" now produces "and"; use the toolbar to insert the next scenario
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-gherkin-type="scenario"]').length >= 2
    );

    const scenarioBlocks = page.locator('[data-gherkin-type="scenario"]');
    const secondScenario = scenarioBlocks.last();
    const borderTop = await secondScenario.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    expect(borderTop).toBe("1px");
  });

  test("scenario after and has a top border", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    await page.locator('[data-gherkin-type="and"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();

    const scenarioBlocks = page.locator('[data-gherkin-type="scenario"]');
    const lastScenario = scenarioBlocks.last();
    const borderTop = await lastScenario.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    expect(borderTop).toBe("1px");
  });

  test("scenario after but has a top border", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    await pressEnterAndWait(page, "then");
    await page.locator(".gherkin-toolbar-btn", { hasText: "But" }).click();
    await page.locator('[data-gherkin-type="but"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();

    const scenarioBlocks = page.locator('[data-gherkin-type="scenario"]');
    const lastScenario = scenarioBlocks.last();
    const borderTop = await lastScenario.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    expect(borderTop).toBe("1px");
  });

  test("first given after scenario does not have a separator border", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");

    const givenBlock = page.locator('[data-gherkin-type="given"]').first();
    const borderTop = await givenBlock.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth
    );
    // No CSS sibling rule should apply here
    expect(borderTop).toBe("0px");
  });

  test("separator does not appear in the exported file", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.keyboard.type("F");
    await pressEnterAndWait(page, "scenario");
    await page.keyboard.type("S");
    await pressEnterAndWait(page, "given");
    await page.keyboard.type("G1");
    await pressEnterAndWait(page, "when");
    await page.keyboard.type("W");
    await pressEnterAndWait(page, "then");
    await page.keyboard.type("T");

    // Insert And after then, then Given after And
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    await page.locator('[data-gherkin-type="and"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Given" }).click();
    await page.locator('[data-gherkin-type="given"]').last().click();
    await page.keyboard.type("G2");

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-btn").click();
    const download = await downloadPromise;

    const tmpPath = path.join(os.tmpdir(), `gherkin-sep-${Date.now()}.txt`);
    await download.saveAs(tmpPath);
    const content = fs.readFileSync(tmpPath, "utf-8");
    fs.unlinkSync(tmpPath);

    // No hr or separator marker in the export
    expect(content).not.toContain("---");
    expect(content).not.toContain("<hr");
    // All lines should match Keyword: text format
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      expect(line).toMatch(/^\w+: /);
    }
  });
});
