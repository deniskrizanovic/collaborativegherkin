import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { encode } from "@auth/core/jwt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local before importing db so DATABASE_URL is set when the
// Prisma adapter is chosen (global-setup runs outside Next.js).
dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });

const TEST_EMAIL = process.env.TEST_AUTH_EMAIL ?? "e2e-test@example.com";
// A second, distinct identity so tests can exercise the owner-vs-collaborator
// axis (session access control). Without this the whole suite ran as one user
// and could never trip a non-owner code path.
const TEST_EMAIL_2 = process.env.TEST_AUTH_EMAIL_2 ?? "e2e-test-2@example.com";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "dev-secret";

type Db = Awaited<typeof import("../src/lib/db")>["db"];

// Upsert a user and write a Playwright storage-state file with a NextAuth JWT
// cookie for that user, so a context loaded with it starts authenticated as them.
async function writeAuthState(db: Db, authDir: string, email: string, fileName: string) {
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { id: true, email: true },
  });

  // Encode a NextAuth JWT directly — no browser, no CSRF.
  const token = await encode({
    token: { sub: user.id, email: user.email },
    secret: AUTH_SECRET,
    salt: "authjs.session-token",
  });

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

  fs.writeFileSync(path.join(authDir, fileName), JSON.stringify(storageState, null, 2));
}

export default async function globalSetup() {
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  // Dynamic import so db picks up DATABASE_URL after dotenv runs above.
  const { db } = await import("../src/lib/db");

  // Default identity for the whole suite (user.json), plus a second distinct
  // identity (user2.json) for access-control tests.
  await writeAuthState(db, authDir, TEST_EMAIL, "user.json");
  await writeAuthState(db, authDir, TEST_EMAIL_2, "user2.json");

  await db.$disconnect();
}
