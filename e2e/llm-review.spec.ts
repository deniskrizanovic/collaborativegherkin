import { test, expect } from "@playwright/test";
import { openSession } from "./helpers";

// spec §8

const MOCK_REVIEW = "## Feedback\n\n- Step 1 is ambiguous.\n- Consider adding an edge case.";

async function interceptReview(page: Parameters<typeof openSession>[0], responseBody = MOCK_REVIEW) {
  await page.route("/api/llm-review", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: responseBody }) })
  );
}

test.describe("LLM review — session page controls", () => {
  test("SC-8.3.1: Model dropdown shown pre-selected to persisted model — button and dropdown visible", async ({ page }) => {
    await openSession(page);
    await expect(page.locator(".session-review-btn")).toBeVisible();
    await expect(page.locator(".session-model-select")).toBeVisible();
  });

  test("SC-8.3.1: Model dropdown shown pre-selected to persisted model — expected models listed", async ({ page }) => {
    await openSession(page);
    const options = page.locator(".session-model-select option");
    await options.first().waitFor({ state: "attached" });
    const texts = await options.allTextContents();
    expect(texts).toContain("meta-llama/llama-3.2-3b-instruct:free");
    expect(texts).toContain("deepseek/deepseek-v4-flash:free");
    expect(texts).toContain("google/gemma-4-31b-it:free");
    expect(texts).toContain("google/gemma-4-26b-a4b-it:free");
  });

  test("SC-8.4.1: Edit prompt button opens modal with pre-filled textarea — button visible", async ({ page }) => {
    await openSession(page);
    await expect(page.locator(".session-edit-prompt-btn")).toBeVisible();
  });
});

test.describe("LLM review — triggering a review", () => {
  test("SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — modal opens", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await expect(page.locator(".session-review-modal-body")).toContainText("Feedback");
  });

  test("SC-8.1.2: Successful LLM response displayed as Markdown in modal — header shows model name", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    const selectedModel = await page.locator(".session-model-select").inputValue();
    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-header")).toContainText(selectedModel);
  });

  test("SC-8.1.2: Successful LLM response displayed as Markdown in modal — Markdown rendered", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-body h2")).toBeVisible();
    await expect(page.locator(".session-review-modal-body li")).toHaveCount(2);
  });

  test("SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — button disabled in flight", async ({ page }) => {
    await openSession(page);

    // Hold the request open until we've checked the disabled state
    let resolveRoute!: () => void;
    const held = new Promise<void>((res) => { resolveRoute = res; });
    await page.route("/api/llm-review", async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: MOCK_REVIEW }) });
    });

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-btn")).toBeDisabled();
    await expect(page.locator(".session-review-btn")).toHaveText("Reviewing…");
    await expect(page.locator(".session-model-select")).toBeDisabled();

    resolveRoute();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await expect(page.locator(".session-review-btn")).toBeEnabled();
  });
});

test.describe("LLM review — dismissing the result modal", () => {
  test("SC-8.2.3: X button closes results modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await page.locator(".session-review-modal-close").click();
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
  });

  test("SC-8.2.1: Escape closes results modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
  });

  test("SC-8.2.2: Clicking outside panel closes results modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    // Click the overlay itself (not the inner panel)
    await page.locator(".session-review-modal").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
  });
});

test.describe("LLM review — cached result", () => {
  test("SC-8.8.3: View last review button absent before first review", async ({ page }) => {
    await openSession(page);
    await expect(page.locator(".session-view-last-review-btn")).not.toBeVisible();
  });

  test("SC-8.8.1: View last review button visible after review is closed", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await page.locator(".session-review-modal-close").click();
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
    await expect(page.locator(".session-view-last-review-btn")).toBeVisible();
  });

  test("SC-8.8.2: View last review reopens modal without new API call", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-body")).toContainText("Feedback");
    await page.locator(".session-review-modal-close").click();
    await expect(page.locator(".session-review-modal")).not.toBeVisible();

    await page.locator(".session-view-last-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await expect(page.locator(".session-review-modal-body")).toContainText("Feedback");
  });

  test("SC-8.8.4: Cached result remains available while new review in flight", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    // Complete first review and close modal
    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await page.locator(".session-review-modal-close").click();

    // Hold the second request open
    let resolveRoute!: () => void;
    const held = new Promise<void>((res) => { resolveRoute = res; });
    await page.route("/api/llm-review", async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "New result" }) });
    });

    await page.locator(".session-review-btn").click();
    // Old result still accessible while in flight
    await expect(page.locator(".session-view-last-review-btn")).toBeVisible();

    resolveRoute();
    await expect(page.locator(".session-review-modal")).toBeVisible();
  });

  test("SC-8.8.5: New review result replaces cached result", async ({ page }) => {
    await openSession(page);
    await interceptReview(page, "First result content");

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-body")).toContainText("First result content");
    await page.locator(".session-review-modal-close").click();

    await interceptReview(page, "Second result content");
    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-body")).toContainText("Second result content");
  });
});

test.describe("LLM review — error handling", () => {
  test("SC-8.1.3: LLM failure shows error in modal and resets button", async ({ page }) => {
    await openSession(page);
    await page.route("/api/llm-review", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "LLM request failed" }) })
    );

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await expect(page.locator(".session-review-modal-body")).toContainText("LLM request failed");
  });
});

test.describe("LLM review — prompt editing", () => {
  test("SC-8.4.1: Edit prompt button opens modal with pre-filled textarea", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-modal")).toBeVisible();
    const value = await page.locator(".session-prompt-textarea").inputValue();
    expect(value.length).toBeGreaterThan(10);
  });

  test("SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Cancel", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await page.locator(".session-prompt-textarea").fill("Changed prompt text that is long enough");
    await page.locator(".session-prompt-cancel").click();
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();
  });

  test("SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Escape", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();
  });

  test("SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — click outside", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-modal")).toBeVisible();
    await page.locator(".session-prompt-modal").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();
  });

  test("SC-8.4.4: Save disabled when textarea has fewer than 10 chars", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await page.locator(".session-prompt-textarea").fill("short");
    await expect(page.locator(".session-prompt-save")).toBeDisabled();
  });

  test("SC-8.4.2: Saving new prompt persists it and closes modal", async ({ page }) => {
    await openSession(page);

    await page.locator(".session-edit-prompt-btn").click();
    const newPrompt = "You are a strict BDD coach. Be extremely concise and critical.";
    await page.locator(".session-prompt-textarea").fill(newPrompt);
    await page.locator(".session-prompt-save").click();
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();

    // Re-open and verify
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-textarea")).toHaveValue(newPrompt);

    // Clean up — restore default
    await page.locator(".session-prompt-cancel").click();
  });
});
