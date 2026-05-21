/**
 * Captures screenshots of every major feature for docs/overview.md.
 * Run with: npx tsx scripts/capture-screenshots.ts
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const OUT = path.resolve("docs/screenshots");
const PLACEHOLDER_USER_ID = "cm000000000000000000000000";

fs.mkdirSync(OUT, { recursive: true });

async function createSession(baseURL: string, title: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, userId: PLACEHOLDER_USER_ID }),
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // ── 1. Home page ──────────────────────────────────────────────────────────
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, "home.png"), fullPage: false });
  console.log("✓ home");

  // ── 2. Create a session ───────────────────────────────────────────────────
  // Fill the form but don't submit — show it filled
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const titleInput = page.locator('input[name="title"], input[placeholder*="session"], input[type="text"]').first();
  await titleInput.fill("User Authentication Flow");
  await page.screenshot({ path: path.join(OUT, "create-session.png"), fullPage: false });
  console.log("✓ create-session");

  // ── 3. Session with initial scaffold ─────────────────────────────────────
  const id1 = await createSession(BASE, "Screenshot Session A");
  await page.goto(`${BASE}/sessions/${id1}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');
  await page.screenshot({ path: path.join(OUT, "session-populated.png"), fullPage: false });
  console.log("✓ session-populated");

  // ── 4. Toolbar — cursor on Feature (scaffold state) ───────────────────────
  await page.locator('[data-gherkin-type="feature"]').click();
  // Toolbar shows valid next blocks for Feature; screenshot
  await page.screenshot({ path: path.join(OUT, "toolbar-populated.png"), fullPage: false });
  console.log("✓ toolbar-populated");

  // ── 5. Fill scaffold blocks with content ─────────────────────────────────
  const id2 = await createSession(BASE, "Screenshot Session B");
  await page.goto(`${BASE}/sessions/${id2}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');

  await page.locator('[data-gherkin-type="feature"]').first().click();
  await page.keyboard.type("User Authentication");

  await page.locator('[data-gherkin-type="scenario"]').first().click();
  await page.keyboard.type("Successful login");

  await page.locator('[data-gherkin-type="given"]').first().click();
  await page.keyboard.type("the user is on the login page");

  await page.locator('[data-gherkin-type="when"]').first().click();
  await page.keyboard.type("the user enters valid credentials");

  await page.locator('[data-gherkin-type="then"]').first().click();
  await page.keyboard.type("the user is redirected to the dashboard");

  await page.screenshot({ path: path.join(OUT, "editor-full.png"), fullPage: false });
  console.log("✓ editor-full");

  // ── 6. Toolbar after typing (shows valid next blocks) ────────────────────
  // Cursor is on 'then' — toolbar should show Rule, Background, Scenario, Given, When, And, But...
  await page.screenshot({ path: path.join(OUT, "toolbar-after-then.png"), fullPage: false });
  console.log("✓ toolbar-after-then");

  // ── 7. Block picker (/ key) ───────────────────────────────────────────────
  await page.locator('[data-gherkin-type="then"]').last().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter"); // new untyped line
  await page.keyboard.type("/");
  await page.waitForSelector('[style*="position: fixed"]');
  await page.screenshot({ path: path.join(OUT, "block-picker.png"), fullPage: false });
  console.log("✓ block-picker");
  await page.keyboard.press("Escape");

  // ── 8. Smart Enter progression (show a sequence of blocks) ───────────────
  // Already shown in editor-full — take a close-up of the editor content
  await page.screenshot({ path: path.join(OUT, "smart-enter.png"), fullPage: false });
  console.log("✓ smart-enter (reuses editor-full view)");

  // ── 9. Multiple scenarios / visual separation ────────────────────────────
  const id3 = await createSession(BASE, "Screenshot Session C");
  await page.goto(`${BASE}/sessions/${id3}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');

  await page.locator('[data-gherkin-type="feature"]').first().click();
  await page.keyboard.type("Shopping Cart");

  await page.locator('[data-gherkin-type="scenario"]').first().click();
  await page.keyboard.type("Add item to cart");

  await page.locator('[data-gherkin-type="given"]').first().click();
  await page.keyboard.type("the catalogue page is open");

  await page.locator('[data-gherkin-type="when"]').first().click();
  await page.keyboard.type("the user clicks Add to Cart");

  await page.locator('[data-gherkin-type="then"]').first().click();
  await page.keyboard.type("the cart badge shows 1");

  // Add second scenario via toolbar
  await page.locator(".gherkin-toolbar-btn", { hasText: "Scenario" }).click();
  await page.locator('[data-gherkin-type="scenario"]').last().click();
  await page.keyboard.type("Remove item from cart");

  await page.keyboard.press("Enter"); // → given
  await page.locator('[data-gherkin-type="given"]').last().click();
  await page.keyboard.type("the cart has one item");

  await page.keyboard.press("Enter"); // → when
  await page.locator('[data-gherkin-type="when"]').last().click();
  await page.keyboard.type("the user clicks Remove");

  await page.keyboard.press("Enter"); // → then
  await page.locator('[data-gherkin-type="then"]').last().click();
  await page.keyboard.type("the cart is empty");

  await page.screenshot({ path: path.join(OUT, "visual-separation.png"), fullPage: false });
  console.log("✓ visual-separation");

  // ── 10. Data table ────────────────────────────────────────────────────────
  const id4 = await createSession(BASE, "Screenshot Session D");
  await page.goto(`${BASE}/sessions/${id4}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');

  await page.locator('[data-gherkin-type="feature"]').first().click();
  await page.keyboard.type("Data-driven tests");

  await page.locator('[data-gherkin-type="scenario"]').first().click();
  await page.keyboard.type("Multiple users");

  await page.locator('[data-gherkin-type="given"]').first().click();
  await page.keyboard.type("the following registered users:");

  await page.locator(".gherkin-toolbar-btn", { hasText: "Table" }).click();
  await page.waitForSelector("[data-gherkin-table]");

  // Fill in table cells
  const cell00 = page.locator("[data-gherkin-table] [data-cell='0-0']");
  await cell00.click();
  await cell00.fill("name");

  const cell01 = page.locator("[data-gherkin-table] [data-cell='0-1']");
  await cell01.click();
  await cell01.fill("role");

  const cell10 = page.locator("[data-gherkin-table] [data-cell='1-0']");
  await cell10.click();
  await cell10.fill("Alice");

  const cell11 = page.locator("[data-gherkin-table] [data-cell='1-1']");
  await cell11.click();
  await cell11.fill("admin");

  // Click a cell to show the table toolbar
  await page.locator("[data-gherkin-table] td").first().click();
  await page.screenshot({ path: path.join(OUT, "data-table.png"), fullPage: false });
  console.log("✓ data-table");

  // ── 11. Import modal ──────────────────────────────────────────────────────
  const id5 = await createSession(BASE, "Screenshot Session E");
  await page.goto(`${BASE}/sessions/${id5}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');

  await page.locator(".gherkin-import-btn").click();
  await page.waitForSelector(".gherkin-import-modal");
  await page.locator(".gherkin-import-textarea").fill(
    "Feature: Payment processing\nScenario: Successful charge\nGiven a valid card on file\nWhen the checkout button is clicked\nThen a receipt is emailed to the user"
  );
  await page.screenshot({ path: path.join(OUT, "import-modal.png"), fullPage: false });
  console.log("✓ import-modal");
  await page.locator(".gherkin-import-cancel").click();

  // ── 12. Export buttons ────────────────────────────────────────────────────
  // Re-use session E with some content
  await page.locator(".gherkin-import-btn").click();
  await page.waitForSelector(".gherkin-import-modal");
  await page.locator(".gherkin-import-textarea").fill(
    "Feature: Payment processing\nScenario: Successful charge\nGiven a valid card on file\nWhen the checkout button is clicked\nThen a receipt is emailed"
  );
  await page.locator(".gherkin-import-confirm").click();
  await page.waitForSelector('[data-gherkin-type="feature"]');
  // Screenshot with export buttons visible
  await page.screenshot({ path: path.join(OUT, "export-buttons.png"), fullPage: false });
  console.log("✓ export-buttons");

  // ── 13. AI Coaching (LLM review) ─────────────────────────────────────────
  // Intercept the API to show the modal with content without hitting real LLM
  await ctx.route("/api/llm-review", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result:
          "## Feedback\n\n**Overall:** Good structure!\n\n### Suggestions\n\n- The Given step could be more specific about the card type.\n- Consider adding a scenario for a declined card.\n- The Then step should specify the receipt contents.",
      }),
    })
  );
  await page.locator(".session-review-btn").click();
  await page.waitForSelector(".session-review-modal");
  await page.screenshot({ path: path.join(OUT, "ai-coaching-modal.png"), fullPage: false });
  console.log("✓ ai-coaching-modal");
  await page.locator(".session-review-modal-close").click();

  // ── 14. Edit AI Prompt modal ──────────────────────────────────────────────
  await page.locator(".session-edit-prompt-btn").click();
  await page.waitForSelector(".session-prompt-modal");
  await page.screenshot({ path: path.join(OUT, "edit-prompt-modal.png"), fullPage: false });
  console.log("✓ edit-prompt-modal");
  await page.locator(".session-prompt-cancel").click();

  // ── 15. Copy invite link (just the button state) ─────────────────────────
  // Already visible in the session page; screenshot to highlight it
  await page.screenshot({ path: path.join(OUT, "invite-link.png"), fullPage: false });
  console.log("✓ invite-link");

  // ── 16. Home page with existing sessions ─────────────────────────────────
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, "home-with-sessions.png"), fullPage: false });
  console.log("✓ home-with-sessions");

  await browser.close();
  console.log(`\nAll screenshots saved to ${OUT}`);
})();
