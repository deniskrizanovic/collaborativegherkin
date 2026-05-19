import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// spec §3.6

test.describe("export", () => {
  test("Export button downloads a plain-text file with correct content", async ({ page, context }) => {
    await openSession(page);

    // Build a small document: Feature → Scenario → Given → When → Then
    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("User login");

    await page.keyboard.press("Enter"); // → scenario
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.type("Successful login");

    await page.keyboard.press("Enter"); // → given
    await page.locator('[data-gherkin-type="given"]').last().click();
    await page.keyboard.type("the user is on the login page");

    await page.keyboard.press("Enter"); // → when
    await page.locator('[data-gherkin-type="when"]').last().click();
    await page.keyboard.type("the user enters valid credentials");

    await page.keyboard.press("Enter"); // → then
    await page.locator('[data-gherkin-type="then"]').last().click();
    await page.keyboard.type("the user is redirected to the dashboard");

    // Set up download listener before clicking Export
    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-btn").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("gherkin.txt");

    // Save to a temp file and read contents
    const tmpPath = path.join(os.tmpdir(), `gherkin-test-${Date.now()}.txt`);
    await download.saveAs(tmpPath);
    const content = fs.readFileSync(tmpPath, "utf-8");
    fs.unlinkSync(tmpPath);

    const lines = content.split("\n");
    expect(lines[0]).toBe("Feature: User login");
    expect(lines[1]).toBe("Scenario: Successful login");
    expect(lines[2]).toBe("Given: the user is on the login page");
    expect(lines[3]).toBe("When: the user enters valid credentials");
    expect(lines[4]).toBe("Then: the user is redirected to the dashboard");
  });

  test("exported file contains blocks in document order", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("Ordering");

    await page.keyboard.press("Enter");
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.type("First scenario");

    await page.keyboard.press("Enter");
    await page.locator('[data-gherkin-type="given"]').last().click();
    await page.keyboard.type("a starting state");

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-btn").click();
    const download = await downloadPromise;

    const tmpPath = path.join(os.tmpdir(), `gherkin-order-${Date.now()}.txt`);
    await download.saveAs(tmpPath);
    const lines = fs.readFileSync(tmpPath, "utf-8").split("\n");
    fs.unlinkSync(tmpPath);

    expect(lines[0]).toMatch(/^Feature:/);
    expect(lines[1]).toMatch(/^Scenario:/);
    expect(lines[2]).toMatch(/^Given:/);
  });
});

// spec §3.9
test.describe("markdown export", () => {
  test("Export MD button downloads a markdown file with correct content", async ({ page }) => {
    await openSession(page);

    await page.locator(".gherkin-toolbar-btn", { hasText: "Feature" }).click();
    await page.locator('[data-gherkin-type="feature"]').click();
    await page.keyboard.type("User login");

    await page.keyboard.press("Enter");
    await page.locator('[data-gherkin-type="scenario"]').last().click();
    await page.keyboard.type("Successful login");

    await page.keyboard.press("Enter");
    await page.locator('[data-gherkin-type="given"]').last().click();
    await page.keyboard.type("the user is on the login page");

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-md-btn").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("gherkin.md");

    const tmpPath = path.join(os.tmpdir(), `gherkin-md-test-${Date.now()}.md`);
    await download.saveAs(tmpPath);
    const content = fs.readFileSync(tmpPath, "utf-8");
    fs.unlinkSync(tmpPath);

    const lines = content.split("\n");
    expect(lines[0]).toBe("# Feature: User login");
    expect(lines[1]).toBe("## Scenario: Successful login");
    expect(lines[2]).toBe("- Given: the user is on the login page");
  });
});
