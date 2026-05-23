import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encode } from "@auth/core/jwt";
import { db } from "../src/lib/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_EMAIL = process.env.TEST_AUTH_EMAIL ?? "e2e-test@example.com";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "dev-secret";

export default async function globalSetup() {
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  // Upsert the test user so the JWT sub resolves to a real DB row.
  const user = await db.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: { email: TEST_EMAIL },
    select: { id: true, email: true },
  });

  // Encode a NextAuth JWT directly — no browser, no CSRF.
  const token = await encode({
    token: { sub: user.id, email: user.email },
    secret: AUTH_SECRET,
    salt: "authjs.session-token",
  });

  // Write storage state with the session cookie so every Playwright context
  // starts authenticated.
  const storageState = {
    cookies: [
      {
        name: "authjs.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  fs.writeFileSync(
    path.join(authDir, "user.json"),
    JSON.stringify(storageState, null, 2)
  );

  await db.$disconnect();
}
