import { test, expect } from "@playwright/test";
import { openSession, pressEnterAndWait } from "./helpers";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// spec §3.11

test.describe("data table insertion", () => {
  test("SC-3.11.1: Table button shown when cursor is on step or data table — visible on Given", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="given"]').first().click();

    await expect(page.locator(".gherkin-toolbar-btn", { hasText: "Table" })).toBeVisible();
  });

  test("SC-3.11.1: Table button shown when cursor is on step or data table — absent on Feature", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="feature"]').click();

    await expect(page.locator(".gherkin-toolbar-btn", { hasText: "Table" })).not.toBeVisible();
  });

  test("SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell — node inserted", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="given"]').first().click();

    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();

    await expect(page.locator("[data-gherkin-table]")).toBeVisible();
  });

  test("SC-3.11.6: Add row and Add column controls available", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="given"]').first().click();

    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();

    // Click into a cell to trigger focus-within, which shows the toolbar
    await page.locator("[data-gherkin-table] td").first().click();

    await expect(page.locator(".gherkin-table-toolbar")).toBeVisible();
    await expect(page.locator('.gherkin-table-toolbar-btn[data-action="insert-row-below"]')).toBeVisible();
    await expect(page.locator('.gherkin-table-toolbar-btn[data-action="insert-col-after"]')).toBeVisible();
  });

  test("SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell — first cell interactive", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="given"]').first().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();
    const firstCell = page.locator("[data-gherkin-table] [data-cell='0-0']");
    await firstCell.click();
    await expect(firstCell).toBeFocused();
    await firstCell.fill("header");
    await expect(firstCell).toHaveText("header");
  });

  test("SC-3.11.4: Tab moves focus to next cell", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="given"]').first().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();
    const firstCell = page.locator("[data-gherkin-table] [data-cell='0-0']");
    await firstCell.click();
    await page.keyboard.press("Tab");
    const secondCell = page.locator("[data-gherkin-table] [data-cell='0-1']");
    await expect(secondCell).toBeFocused();
  });

  test("SC-3.11.5: Shift+Tab moves focus to previous cell", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="given"]').first().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();
    const secondCell = page.locator("[data-gherkin-table] [data-cell='0-1']");
    await secondCell.click();
    await page.keyboard.press("Shift+Tab");
    const firstCell = page.locator("[data-gherkin-table] [data-cell='0-0']");
    await expect(firstCell).toBeFocused();
  });

  test("SC-3.11.3: Slash-command picker includes Table when on step block", async ({ page }) => {
    await openSession(page);
    // Use pressEnterAndWait to reliably navigate to a step block and beyond.
    // After given, pressing Enter creates a when block (NEXT_BLOCK_ON_ENTER["given"]="when").
    // On that new when block: prevType=given (a STEP_TYPE) → Table appears in picker.
    await pressEnterAndWait(page, "scenario");
    await pressEnterAndWait(page, "given");
    await pressEnterAndWait(page, "when");
    // cursor is on new 'when' block; prevType=given → getValidNextTypes("given") includes "data_table"
    await page.keyboard.type("/");
    const picker = page.locator('[style*="position: fixed"]');
    await expect(picker).toBeVisible();
    await expect(picker.locator("button", { hasText: "Table" })).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("data table export", () => {
  test("SC-3.11.7: TXT export uses pipe-delimited rows padded to column width", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="feature"]').first().click();
    await page.keyboard.type("Login");

    await page.locator('[data-gherkin-type="scenario"]').first().click();
    await page.keyboard.type("Table test");

    await page.locator('[data-gherkin-type="given"]').first().click();
    await page.keyboard.type("a step with data");

    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();

    // Type into the first cell of the table (row 0 renders as <th>)
    const firstCell = page.locator("[data-gherkin-table] [data-cell='0-0']");
    await firstCell.click();
    await firstCell.fill("name");

    const secondCell = page.locator("[data-gherkin-table] [data-cell='0-1']");
    await secondCell.click();
    await secondCell.fill("age");

    // Trigger blur to commit
    await page.locator(".gherkin-editor").click();

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-btn").click();
    const download = await downloadPromise;

    const tmpPath = path.join(os.tmpdir(), `gherkin-table-${Date.now()}.txt`);
    await download.saveAs(tmpPath);
    const content = fs.readFileSync(tmpPath, "utf-8");
    fs.unlinkSync(tmpPath);

    expect(content).toContain("| name");
    expect(content).toContain("| age");
  });

  test("SC-3.11.8: MD export uses header row with separator", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="feature"]').first().click();
    await page.keyboard.type("MD Table");

    await page.locator('[data-gherkin-type="scenario"]').first().click();
    await page.keyboard.type("export scenario");

    await page.locator('[data-gherkin-type="given"]').first().click();
    await page.keyboard.type("a step");

    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();

    const firstCell = page.locator("[data-gherkin-table] [data-cell='0-0']");
    await firstCell.click();
    await firstCell.fill("col");

    await page.locator(".gherkin-editor").click();

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-md-btn").click();
    const download = await downloadPromise;

    const tmpPath = path.join(os.tmpdir(), `gherkin-table-md-${Date.now()}.md`);
    await download.saveAs(tmpPath);
    const content = fs.readFileSync(tmpPath, "utf-8");
    fs.unlinkSync(tmpPath);

    expect(content).toContain("| col");
    expect(content).toMatch(/\| -+/);
  });
});
