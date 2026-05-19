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
  test("Review with AI button and model dropdown are visible on session page", async ({ page }) => {
    await openSession(page);
    await expect(page.locator(".session-review-btn")).toBeVisible();
    await expect(page.locator(".session-model-select")).toBeVisible();
  });

  test("model dropdown lists the expected free models", async ({ page }) => {
    await openSession(page);
    const options = page.locator(".session-model-select option");
    const texts = await options.allTextContents();
    expect(texts).toContain("meta-llama/llama-3.2-3b-instruct:free");
    expect(texts).toContain("deepseek/deepseek-v4-flash:free");
    expect(texts).toContain("google/gemma-4-31b-it:free");
    expect(texts).toContain("google/gemma-4-26b-a4b-it:free");
  });

  test("Edit prompt button is visible on session page", async ({ page }) => {
    await openSession(page);
    await expect(page.locator(".session-edit-prompt-btn")).toBeVisible();
  });
});

test.describe("LLM review — triggering a review", () => {
  test("clicking Review with AI sends content and opens result modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await expect(page.locator(".session-review-modal-body")).toContainText("Feedback");
  });

  test("result modal header shows the selected model name", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-header")).toContainText(
      "meta-llama/llama-3.2-3b-instruct:free"
    );
  });

  test("result is rendered as Markdown — heading and list items", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal-body h2")).toBeVisible();
    await expect(page.locator(".session-review-modal-body li")).toHaveCount(2);
  });

  test("button is disabled and shows Reviewing… while request is in flight", async ({ page }) => {
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
  test("clicking the ✕ button closes the modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await page.locator(".session-review-modal-close").click();
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
  });

  test("pressing Escape closes the modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
  });

  test("clicking outside the modal panel closes the modal", async ({ page }) => {
    await openSession(page);
    await interceptReview(page);

    await page.locator(".session-review-btn").click();
    await expect(page.locator(".session-review-modal")).toBeVisible();
    // Click the overlay itself (not the inner panel)
    await page.locator(".session-review-modal").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".session-review-modal")).not.toBeVisible();
  });
});

test.describe("LLM review — error handling", () => {
  test("displays error message in modal when API returns 500", async ({ page }) => {
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
  test("clicking Edit prompt opens the prompt modal with a pre-filled textarea", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-modal")).toBeVisible();
    const value = await page.locator(".session-prompt-textarea").inputValue();
    expect(value.length).toBeGreaterThan(10);
  });

  test("Cancel closes the prompt modal without saving", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await page.locator(".session-prompt-textarea").fill("Changed prompt text that is long enough");
    await page.locator(".session-prompt-cancel").click();
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();
  });

  test("pressing Escape closes the prompt modal", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();
  });

  test("clicking outside the prompt modal panel closes it", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await expect(page.locator(".session-prompt-modal")).toBeVisible();
    await page.locator(".session-prompt-modal").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".session-prompt-modal")).not.toBeVisible();
  });

  test("Save button is disabled when textarea has fewer than 10 characters", async ({ page }) => {
    await openSession(page);
    await page.locator(".session-edit-prompt-btn").click();
    await page.locator(".session-prompt-textarea").fill("short");
    await expect(page.locator(".session-prompt-save")).toBeDisabled();
  });

  test("saving a new prompt persists it — re-opening shows updated text", async ({ page }) => {
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
