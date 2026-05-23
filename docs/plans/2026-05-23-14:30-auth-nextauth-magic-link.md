# Auth upgrade: NextAuth v5 magic link + Resend + JWT

## Context

NextAuth v5 is installed at `beta.25` but completely unwired. Every route is unauthenticated. `HomeClient.tsx:32` hardcodes `userId: "cm000000000000000000000000"`. The POST /api/sessions trusts userId from the request body; GET /api/sessions returns all sessions; DELETE /api/sessions/[id] has no ownership check.

Decisions (ADR 0003): full auth gate (every route), magic link via Resend, JWT sessions (avoids naming conflict with Gherkin `Session` model), any authenticated user can view/edit any session, only owner can delete, home page lists only the signed-in user's sessions.

---

## Step 1 — Package upgrade

Upgrade `next-auth` from `^5.0.0-beta.25` to `^5.0.0` (stable) in `package.json`. Run `npm install`.  
No new packages needed — Resend provider ships inside `next-auth`.

---

## Step 2 — Prisma schema

**Files:** `prisma/schema.prisma`, `prisma/postgres/schema.prisma`

Add to both schemas:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
```

Update `User` model to add `emailVerified` and `accounts` relation:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  createdAt     DateTime  @default(now())
  accounts      Account[]
  sessions      Session[]
}
```

Then:
```bash
npx prisma migrate dev --name add_nextauth_tables
npx prisma generate
```

---

## Step 3 — `src/auth.ts` (new file)

```ts
import NextAuth from "next-auth";
import ResendProvider from "next-auth/providers/resend";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null };
  }
}

const providers = [
  ResendProvider({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.AUTH_EMAIL_FROM ?? "noreply@yourdomain.com",
  }),
];

// Test-only bypass — never set TEST_AUTH_SECRET in production.
if (process.env.TEST_AUTH_SECRET) {
  providers.push(
    CredentialsProvider({
      id: "test-bypass",
      credentials: { email: {}, secret: {} },
      async authorize(credentials) {
        if (credentials.secret !== process.env.TEST_AUTH_SECRET) return null;
        return db.user.upsert({
          where: { email: credentials.email as string },
          update: {},
          create: { email: credentials.email as string },
          select: { id: true, email: true, name: true },
        });
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as any),
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
```

---

## Step 4 — `src/app/api/auth/[...nextauth]/route.ts` (new file)

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

---

## Step 5 — `src/middleware.ts` (new file)

```ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Step 6 — `src/lib/session.ts`

Change `list()` signature to accept and filter by `userId`:

```ts
async list(userId: string): Promise<SessionRecord[]> {
  return this.deps.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true, userId: true },
  });
}
```

`get(id)` already exists at line 30 — no change needed there.

---

## Step 7 — `src/app/api/sessions/route.ts`

- Import `auth` from `"@/auth"`.
- `GET`: call `const authSession = await auth()`. Return 401 if null. Call `sessionLib.list(authSession.user.id)`.
- `POST`: call `auth()`. Return 401 if null. Remove `userId` from `CreateSessionSchema` (title only). Take userId from `authSession.user.id`.

---

## Step 8 — `src/app/api/sessions/[id]/route.ts`

- Import `auth` from `"@/auth"`.
- `GET`: call `auth()`, return 401 if null.
- `DELETE`: call `auth()`, return 401 if null. Call `session.get(id)` first (already exists at `session.ts:30`), check `row.userId !== authSession.user.id` → return 403. Then call `session.delete(id)`.

---

## Step 9 — `src/app/page.tsx`

- Import `auth` from `"@/auth"`.
- Call `const authSession = await auth()` (server component).
- Instantiate `new Session({ session: db.session })` and call `.list(authSession.user.id)`.
- Pass `currentUser: { id: authSession.user.id, email: authSession.user.email }` as prop to `HomeClient`.

---

## Step 10 — `src/app/HomeClient.tsx`

- Add `currentUser: { id: string; email: string }` to `Props`.
- Remove `userId` from POST body — body is now just `{ title }`.
- Add sign-out: `import { signOut } from "next-auth/react"`. Add button calling `signOut({ callbackUrl: "/" })`.
- Display `currentUser.email` in the header.

---

## Step 11 — Unit test updates

**`src/lib/session.test.ts`:**
- Update all `list()` calls to `list(userId)` and assert `findMany` called with `where: { userId }`.

**`src/app/api/sessions/route.test.ts`:**
- Add `vi.mock("@/auth", () => ({ auth: vi.fn() }))`.
- Happy path: `vi.mocked(auth).mockResolvedValue({ user: { id: VALID_USER_ID } })`.
- Add 401 test: `auth.mockResolvedValue(null)` → expect 401.
- Remove `userId` from POST body in tests.
- GET test: assert `findMany` called with `where: { userId: VALID_USER_ID }`.

**`src/app/api/sessions/[id]/route.test.ts`:**
- Add same `vi.mock("@/auth")` pattern.
- Add DELETE 401 test (no session → 401).
- Add DELETE 403 test: `session.get` returns row owned by different userId → expect 403.

---

## Step 12 — E2E: global setup + storageState

**`e2e/global-setup.ts` (new):**

```ts
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
      secret: process.env.TEST_AUTH_SECRET,
      callbackUrl: BASE_URL,
      json: "true",
    },
  });

  // 3. Save cookies (includes next-auth.session-token JWT)
  await context.storageState({ path: path.join(authDir, "user.json") });
  await browser.close();
}
```

**`playwright.config.ts` changes:**
- Add `globalSetup: "./e2e/global-setup.ts"`.
- Add `storageState: "e2e/.auth/user.json"` to `use`.

**`e2e/helpers.ts` changes:**
- Remove `PLACEHOLDER_USER_ID` and the import.
- `createSession`: change body from `{ title, userId: PLACEHOLDER_USER_ID }` to `{ title }`.

**`.gitignore`:** add `e2e/.auth/`.

---

## Step 13 — `.env.example` additions

```bash
RESEND_API_KEY=""
AUTH_EMAIL_FROM="noreply@yourdomain.com"
# TEST_AUTH_SECRET — set in .env.local for E2E tests only; NEVER set in production
TEST_AUTH_SECRET=""
TEST_AUTH_EMAIL="e2e-test@example.com"
```

---

## Step 14 — Documentation updates

**`docs/technical.md`:**
- Replace the stale `### Auth` section (currently says "not yet hooked up to the UI") with a summary of the live auth model: NextAuth v5, magic link via Resend, JWT sessions, full route gate, middleware matcher, `src/auth.ts` as the central config.
- Update the project structure listing to include `src/auth.ts`, `src/middleware.ts`, and `src/app/api/auth/[...nextauth]/route.ts`.
- Update the `Three models` sentence to `Five models: User, Account, Session, VerificationToken, AppSetting`.
- Remove "Auth is schema-only" from the Known gaps section; replace with a note that Y.js state persistence and session deletion UI remain open.

**`docs/spec/01-session-management.md`:**
- Section 1.1 (listing): add auth precondition — `Given` a signed-in user. Clarify the list shows only sessions the user created (owner filter).
- Section 1.5 (deleting): add auth preconditions — 401 if unauthenticated, 403 if authenticated but not the owner.

**`docs/spec/04-api.md`:**
- All endpoints: add `Given` the request includes a valid authenticated session (JWT cookie) / `Then` 401 if not.
- Section 4.1 GET /api/sessions: change "array of all sessions" → "array of sessions owned by the authenticated user".
- Section 4.2 POST /api/sessions: remove `userId` from the valid request body — body is `{ title }` only. Remove the `userId` validation error scenario. Add 401 scenario.
- Section 4.4 DELETE /api/sessions/[id]: add 401 (unauthenticated) and 403 (authenticated but not the owner) scenarios.

**`CLAUDE.md`:**
- Update the project structure comment for `api/sessions/` to note auth is now required.
- Remove the reference to the seed placeholder user from any inline notes (the seed user remains but is no longer the hardcoded identity).

---

## Verification

1. `npm install` — clean.
2. `npx prisma migrate dev` — migration runs, new tables created.
3. `npm run build` — TypeScript compilation passes.
4. `npm run lint` — no errors.
5. Manual smoke: `npm run dev`, visit `/` → redirected to NextAuth sign-in page. Enter `dev@example.com` → magic link sent (requires `RESEND_API_KEY`). Click link → home page with signed-in email visible.
6. `npm run test` — all unit tests pass with updated mocks.
7. E2E: set `TEST_AUTH_SECRET` in `.env.local`, run `npm run test:e2e` — all 13 spec files pass.
8. Delete ownership: sign in as user A, create session; sign in as user B (different browser/incognito), attempt DELETE → 403.
9. Security check: unset `TEST_AUTH_SECRET` → `/api/auth/callback/test-bypass` returns 404.

---

## Implementation order (strict)

1. Package upgrade (`package.json`)
2. Prisma schema + migration
3. `src/auth.ts`
4. `src/app/api/auth/[...nextauth]/route.ts`
5. `src/middleware.ts`
6. `src/lib/session.ts` (update `list`)
7. `src/app/api/sessions/route.ts`
8. `src/app/api/sessions/[id]/route.ts`
9. `src/app/page.tsx`
10. `src/app/HomeClient.tsx`
11. Unit test updates (`session.test.ts`, `route.test.ts`, `[id]/route.test.ts`)
12. E2E global-setup + helpers + playwright.config + .gitignore
13. `.env.example`
14. Documentation (`docs/technical.md`, `docs/spec/01-session-management.md`, `docs/spec/04-api.md`, `CLAUDE.md`)
