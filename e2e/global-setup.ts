import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_AUTH_EMAIL ?? "e2e-test@example.com";
const TEST_SECRET = process.env.TEST_AUTH_SECRET ?? "";

export default async function globalSetup() {
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the sign-in page so NextAuth sets its CSRF cookie in the browser.
  await page.goto(`${BASE_URL}/api/auth/signin`);

  // Submit the test-bypass credentials form via the browser (CSRF cookie is
  // carried automatically — no manual token extraction needed).
  await page.evaluate(
    async ({ email, secret, baseUrl }) => {
      const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
      const { csrfToken } = await csrfRes.json();

      const body = new URLSearchParams({
        csrfToken,
        email,
        secret,
        callbackUrl: baseUrl,
        json: "true",
      });

      await fetch(`${baseUrl}/api/auth/callback/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        credentials: "include",
      });
    },
    { email: TEST_EMAIL, secret: TEST_SECRET, baseUrl: BASE_URL }
  );

  // Save cookies (includes next-auth.session-token JWT)
  await context.storageState({ path: path.join(authDir, "user.json") });
  await browser.close();
}
