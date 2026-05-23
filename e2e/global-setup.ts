import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_AUTH_EMAIL ?? "e2e-test@example.com";

export default async function globalSetup() {
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();

  // 1. Get NextAuth CSRF token
  const csrfRes = await context.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();

  // 2. Sign in via test-bypass credentials provider
  await context.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: TEST_EMAIL,
      secret: process.env.TEST_AUTH_SECRET ?? "",
      callbackUrl: BASE_URL,
      json: "true",
    },
  });

  // 3. Save cookies (includes next-auth.session-token JWT)
  await context.storageState({ path: path.join(authDir, "user.json") });
  await browser.close();
}
