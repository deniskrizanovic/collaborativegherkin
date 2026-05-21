import { test, expect } from "@playwright/test";
import { openSession, clickEditor } from "./helpers";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// spec §3.11

test.describe("data table insertion", () => {
  test("Table button appears in toolbar after inserting a Given block", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="given"]').first().click();

    await expect(page.locator(".gherkin-toolbar-btn", { hasText: "Table" })).toBeVisible();
  });

  test("Table button is absent when cursor is on a Feature block", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="feature"]').click();

    await expect(page.locator(".gherkin-toolbar-btn", { hasText: "Table" })).not.toBeVisible();
  });

  test("clicking Table button inserts a data_table node", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="given"]').first().click();

    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();

    await expect(page.locator("[data-gherkin-table]")).toBeVisible();
  });

  test("inserted table has management toolbar with row and column controls", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="given"]').first().click();

    await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();

    // Click into a cell to trigger focus-within, which shows the toolbar
    await page.locator("[data-gherkin-table] td").first().click();

    await expect(page.locator(".gherkin-table-toolbar")).toBeVisible();
    await expect(page.locator('.gherkin-table-toolbar-btn[data-action="insert-row-below"]')).toBeVisible();
    await expect(page.locator('.gherkin-table-toolbar-btn[data-action="insert-col-after"]')).toBeVisible();
  });
});

test.describe("data table export", () => {
  test("Export TXT includes pipe-delimited rows for a data table", async ({ page, context }) => {
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

  test("Export MD includes pipe table with separator for a data table", async ({ page }) => {
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
