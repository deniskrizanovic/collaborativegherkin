import { test, expect } from "@playwright/test";
import { documentNodes, openSession } from "./helpers";
import path from "path";
import fs from "fs";
import os from "os";

// spec §3.4, §3.12

const PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
  "2e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082",
  "hex"
);

test.describe("toolbar", () => {
  test("SC-3.4.1: Toolbar shows valid next blocks and Image — no Feature shown on Feature block", async ({ page }) => {
    await openSession(page);
    // Seed places cursor on Feature; toolbar should show valid next blocks, not Feature itself
    const buttons = page.locator(".gherkin-toolbar-btn");
    const texts = await buttons.allTextContents();
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });

  test("SC-3.4.1: Toolbar shows valid next blocks and Image — Rule, Background, Scenario after Feature", async ({ page }) => {
    await openSession(page);
    const buttons = page.locator(".gherkin-toolbar-btn");
    const texts = await buttons.allTextContents();
    expect(texts).toContain("Rule");
    expect(texts).toContain("Background");
    expect(texts).toContain("Scenario");
    expect(texts).not.toContain("Feature");
  });

  test("SC-3.4.2: Clicking toolbar button inserts block and moves cursor", async ({ page }) => {
    await openSession(page);
    await page.locator(".gherkin-toolbar-btn", { hasText: "Rule" }).click();
    await expect(page.locator('[data-gherkin-type="rule"]')).toBeVisible();
  });

  test("SC-3.4.2: Clicking toolbar button inserts block and moves cursor — Scenario after Feature", async ({ page }) => {
    await openSession(page);
    const countBefore = await page.locator('[data-gherkin-type="scenario"]').count();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
    await expect(page.locator('[data-gherkin-type="scenario"]')).toHaveCount(countBefore + 1);
  });

  test("SC-3.4.1: Toolbar shows valid next blocks and Image — Image present on non-Feature block", async ({ page }) => {
    await openSession(page);
    await page.locator('[data-gherkin-type="then"]').click();
    const texts = await page.locator(".gherkin-toolbar-btn").allTextContents();
    expect(texts).toContain("Image");
  });

  test("SC-3.12.5: Toolbar insert with an image selected places the block after the image", async ({ page }) => {
    await openSession(page);
    const tmpImg = path.join(os.tmpdir(), `test-img-${Date.now()}.png`);
    fs.writeFileSync(tmpImg, PNG_1x1);
    await page.locator('[data-gherkin-type="then"]').click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "Image" }).click();
    await page.locator('input[type="file"]').setInputFiles(tmpImg);
    fs.unlinkSync(tmpImg);
    await expect(page.locator(".gherkin-image-block")).toBeVisible();

    await page.locator(".gherkin-image-block").click();
    await page.locator(".gherkin-toolbar-btn", { hasText: "And" }).click();
    await expect(page.locator('[data-gherkin-type="and"]')).toHaveCount(1);
    expect(await documentNodes(page)).toEqual(["feature", "scenario", "given", "when", "then", "image", "and"]);

    await page.keyboard.type("After image");
    await expect(page.locator('[data-gherkin-type="and"]')).toHaveText("After image");
  });
});
