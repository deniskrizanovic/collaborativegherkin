import { test, expect } from "@playwright/test";
import { createSession, openSession } from "./helpers";

test.describe("home page", () => {
  test("SC-1.1.2: No sessions shows empty state", async ({ page }) => {
    // Delete all sessions via the API so the home page is genuinely empty
    const listRes = await page.request.get("/api/sessions");
    const sessions = await listRes.json() as { id: string }[];
    for (const s of sessions) {
      await page.request.delete(`/api/sessions/${s.id}`);
    }
    await page.goto("/");
    await expect(page.locator(".sessions-list")).not.toBeVisible();
    await expect(page.locator(".create-form")).toBeVisible();
  });

  test("SC-1.1.1: Sessions listed newest first — list visible after creating", async ({ page }) => {
    const id = await createSession(page, "List test session");
    await page.goto("/");
    const link = page.locator(".session-link").first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/sessions/${id}`);
  });

  test("SC-1.1.1: Sessions listed newest first — order", async ({ page }) => {
    await createSession(page, "Session Alpha");
    await createSession(page, "Session Beta");
    await page.goto("/");
    const names = page.locator(".session-name");
    await expect(names.first()).toHaveText("Session Beta");
  });

  test("SC-1.2.2: Empty title disables Create button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("SC-1.2.3: Title over 200 chars shows validation error", async ({ page }) => {
    await page.goto("/");
    const longTitle = "a".repeat(201);
    // Bypass maxLength and trigger React's synthetic onChange via nativeInputValueSetter
    await page.locator(".nsw-form__input").evaluate(
      (el, value) => {
        const input = el as HTMLInputElement;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      longTitle
    );
    await page.locator('button[type="submit"]').click();
    await expect(page.locator(".form-error")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("SC-1.2.4: Server error shows error message", async ({ page }) => {
    await page.route("**/api/sessions", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Server error" }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto("/");
    await page.locator(".nsw-form__input").fill("My session");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator(".form-error")).toBeVisible();
  });

  test("SC-1.2.1: Valid title creates session and redirects", async ({ page }) => {
    await page.goto("/");
    await page.locator(".nsw-form__input").fill("Redirect test session");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/sessions\//);
  });

  test("SC-1.3.1: Valid session ID loads editor with title", async ({ page }) => {
    const title = "Header title session";
    const id = await createSession(page, title);
    await page.goto(`/sessions/${id}`);
    await expect(page.locator(".session-title")).toHaveText(title);
  });

  test("SC-1.4.1: Copy invite link copies URL and shows Copied!", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openSession(page, "Copy link session");
    const btn = page.locator(".copy-link-btn");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText("Copy invite link");
    await btn.click();
    await expect(btn).toHaveText("Copied!");
  });
});
