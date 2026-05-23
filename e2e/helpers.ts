import { Page } from "@playwright/test";

export async function pressEnterAndWait(page: Page, expectedType: string): Promise<void> {
  const before = await page.locator(`[data-gherkin-type="${expectedType}"]`).count();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ({ selector, before }: { selector: string; before: number }) =>
      document.querySelectorAll(selector).length > before,
    { selector: `[data-gherkin-type="${expectedType}"]`, before }
  );
  await page.locator(`[data-gherkin-type="${expectedType}"]`).last().click();
}

export async function createSession(page: Page, title: string): Promise<string> {
  const res = await page.request.post("/api/sessions", {
    data: { title },
  });
  const body = await res.json();
  return body.id as string;
}

export async function openSession(page: Page, title = "Test session"): Promise<string> {
  const id = await createSession(page, title);
  await page.goto(`/sessions/${id}`);
  await page.waitForSelector('[data-gherkin-type="feature"]');
  await page.locator('[data-gherkin-type="feature"]').click();
  return id;
}

export function editorLocator(page: Page) {
  return page.locator(".gherkin-editor");
}

export async function clickEditor(page: Page) {
  await editorLocator(page).click();
}
