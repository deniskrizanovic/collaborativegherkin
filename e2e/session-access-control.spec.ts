import { test, expect, request } from "@playwright/test";
import { createSession } from "./helpers";

// Characterisation tests for the session access-control contract (ADR-0005).
//
// WHY THIS FILE EXISTS: a session id is an unguessable cuid shared as an invite
// link (a capability URL), so any authenticated holder of the id may READ (GET)
// and EDIT settings (PATCH) — that is the collaboration feature. Only the
// irreversible DELETE is owner-only. A previous change added owner-only guards
// to GET/PATCH and broke link-sharing (403 on load and on every settings change
// for invited collaborators). The whole e2e suite ran as ONE user, so no test
// could ever trip a non-owner path. These tests introduce a second, distinct
// identity (user2.json, minted in global-setup) to pin the contract so the
// regression cannot silently return.
//
// Layers:
//  - API level: asserts the exact status contract (200 / 403) for a non-owner.
//  - E2E level: asserts the user-visible outcome (no error banner, controls work).

// The `page` fixture is authenticated as the OWNER via the suite default
// storageState (e2e/.auth/user.json in playwright.config.ts). OTHER_STATE is a
// second, distinct user used to drive the non-owner / collaborator paths.
const OTHER_STATE = "e2e/.auth/user2.json";
const BASE_URL = "http://localhost:3000";

test.describe("session access control — API contract (ADR-0005)", () => {
  test("non-owner can GET a session they hold the id for (200)", async ({ page }) => {
    // page fixture is the OWNER — create the session as user1.
    const sessionId = await createSession(page, "Collaborator-readable session");

    // user2 is not the owner but holds the id (was given the link).
    const other = await request.newContext({ storageState: OTHER_STATE, baseURL: BASE_URL });
    try {
      const res = await other.get(`/api/sessions/${sessionId}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: sessionId });
    } finally {
      await other.dispose();
    }
  });

  test("non-owner can PATCH a session's settings (200)", async ({ page }) => {
    const sessionId = await createSession(page, "Collaborator-editable session");

    const other = await request.newContext({ storageState: OTHER_STATE, baseURL: BASE_URL });
    try {
      const res = await other.patch(`/api/sessions/${sessionId}`, {
        data: { prompt: "A collaborator-supplied prompt that is long enough." },
      });
      expect(res.status()).toBe(200);
    } finally {
      await other.dispose();
    }
  });

  test("non-owner cannot DELETE a session (403) — deletion stays owner-only", async ({ page }) => {
    const sessionId = await createSession(page, "Owner-only-delete session");

    const other = await request.newContext({ storageState: OTHER_STATE, baseURL: BASE_URL });
    try {
      const res = await other.delete(`/api/sessions/${sessionId}`);
      expect(res.status()).toBe(403);
    } finally {
      await other.dispose();
    }

    // And the owner can still read it — the failed delete changed nothing.
    const stillThere = await page.request.get(`/api/sessions/${sessionId}`);
    expect(stillThere.status()).toBe(200);
  });
});

test.describe("session access control — collaborator UX (ADR-0005)", () => {
  test("a second user opens the shared link: no error banner, settings load", async ({ page, browser }) => {
    const sessionId = await createSession(page, "Shared with a collaborator");
    const url = `${BASE_URL}/sessions/${sessionId}`;

    const context2 = await browser.newContext({ storageState: OTHER_STATE });
    const page2 = await context2.newPage();
    try {
      // The settings GET on load must succeed for a non-owner (200), not 403.
      const [getRes] = await Promise.all([
        page2.waitForResponse(
          (r) => r.url().includes(`/api/sessions/${sessionId}`) && r.request().method() === "GET"
        ),
        page2.goto(url),
      ]);
      expect(getRes.status()).toBe(200);

      await page2.waitForSelector('[data-gherkin-type="feature"]');

      // The "silently swallowed 403" regression surfaced as this banner. It must
      // NOT be present for a legitimate collaborator.
      await expect(page2.locator(".form-error")).toHaveCount(0);
      await expect(page2.locator(".session-model-select")).toBeVisible();
    } finally {
      await context2.close();
    }
  });

  test("a second user can change the model and it persists (PATCH 200, no banner)", async ({ page, browser }) => {
    const sessionId = await createSession(page, "Collaborator changes model");
    const url = `${BASE_URL}/sessions/${sessionId}`;

    const context2 = await browser.newContext({ storageState: OTHER_STATE });
    const page2 = await context2.newPage();
    try {
      await page2.goto(url);
      await page2.waitForSelector('[data-gherkin-type="feature"]');

      const select = page2.locator(".session-model-select");
      const current = await select.inputValue();
      const options = await select.locator("option").evaluateAll((els) =>
        (els as HTMLOptionElement[]).map((e) => e.value)
      );
      const target = options.find((v) => v !== current);
      expect(target, "need a second model option to select").toBeTruthy();

      // Selecting a new model fires a PATCH — it must succeed for a non-owner.
      const [patchRes] = await Promise.all([
        page2.waitForResponse(
          (r) => r.url().includes(`/api/sessions/${sessionId}`) && r.request().method() === "PATCH"
        ),
        select.selectOption(target!),
      ]);
      expect(patchRes.status()).toBe(200);
      await expect(page2.locator(".form-error")).toHaveCount(0);

      // Reload: the change persisted (proves the write really landed, not just
      // an optimistic UI update that got rolled back).
      await page2.reload();
      await page2.waitForSelector('[data-gherkin-type="feature"]');
      await expect(page2.locator(".session-model-select")).toHaveValue(target!);
    } finally {
      await context2.close();
    }
  });

  test("a second user can save a new prompt (modal closes, no banner)", async ({ page, browser }) => {
    const sessionId = await createSession(page, "Collaborator edits prompt");
    const url = `${BASE_URL}/sessions/${sessionId}`;

    const context2 = await browser.newContext({ storageState: OTHER_STATE });
    const page2 = await context2.newPage();
    try {
      await page2.goto(url);
      await page2.waitForSelector('[data-gherkin-type="feature"]');

      await page2.locator(".session-edit-prompt-btn").click();
      await expect(page2.locator(".session-prompt-modal")).toBeVisible();
      await page2
        .locator(".session-prompt-textarea")
        .fill("A collaborator-supplied review prompt that is comfortably long enough.");

      const [patchRes] = await Promise.all([
        page2.waitForResponse(
          (r) => r.url().includes(`/api/sessions/${sessionId}`) && r.request().method() === "PATCH"
        ),
        page2.locator(".session-prompt-save").click(),
      ]);
      expect(patchRes.status()).toBe(200);

      // Success path: modal closes, no error banner. The old bug reported success
      // (modal closed) even on a 403 — here the 200 is asserted independently.
      await expect(page2.locator(".session-prompt-modal")).not.toBeVisible();
      await expect(page2.locator(".form-error")).toHaveCount(0);
    } finally {
      await context2.close();
    }
  });
});
