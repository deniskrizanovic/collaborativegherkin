import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// spec §3.6

test.describe("export", () => {
  test("SC-3.6.1: Export downloads plain-text file in document order — correct content", async ({ page }) => {
    await openSession(page);

    // Type into each scaffold block directly
    await page.locator('[data-gherkin-type="feature"]').first().click();
    await page.keyboard.type("User login");

    await page.locator('[data-gherkin-type="scenario"]').first().click();
    await page.keyboard.type("Successful login");

    await page.locator('[data-gherkin-type="given"]').first().click();
    await page.keyboard.type("the user is on the login page");

    await page.locator('[data-gherkin-type="when"]').first().click();
    await page.keyboard.type("the user enters valid credentials");

    await page.locator('[data-gherkin-type="then"]').first().click();
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

  test("SC-3.6.1: Export downloads plain-text file in document order — block order", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="feature"]').first().click();
    await page.keyboard.type("Ordering");

    await page.locator('[data-gherkin-type="scenario"]').first().click();
    await page.keyboard.type("First scenario");

    await page.locator('[data-gherkin-type="given"]').first().click();
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

  test("SC-3.6.1: Export downloads plain-text file in document order — image data-URI included", async ({ page }) => {
    await openSession(page);

    const PNG_1x1 = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
      "2e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082",
      "hex"
    );
    const tmpImg = path.join(os.tmpdir(), `test-img-export-${Date.now()}.png`);
    fs.writeFileSync(tmpImg, PNG_1x1);

    await page.locator('[data-gherkin-type="then"]').last().click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Image" }).click();
    await page.locator('input[type="file"]').setInputFiles(tmpImg);
    await page.waitForSelector(".gherkin-image-block");

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".gherkin-export-btn").click();
    const download = await downloadPromise;

    const tmpTxt = path.join(os.tmpdir(), `gherkin-img-export-${Date.now()}.txt`);
    await download.saveAs(tmpTxt);
    const content = fs.readFileSync(tmpTxt, "utf-8");
    fs.unlinkSync(tmpTxt);
    fs.unlinkSync(tmpImg);

    expect(content).toContain("data:image");
  });
});

// spec §3.9
test.describe("markdown export", () => {
  test("SC-3.9.1: Export MD downloads markdown file in document order", async ({ page }) => {
    await openSession(page);

    await page.locator('[data-gherkin-type="feature"]').first().click();
    await page.keyboard.type("User login");

    await page.locator('[data-gherkin-type="scenario"]').first().click();
    await page.keyboard.type("Successful login");

    await page.locator('[data-gherkin-type="given"]').first().click();
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
