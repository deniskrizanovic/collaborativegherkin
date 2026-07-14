## 1. Compile the bypass out of production (ENG-003)

- [x] 1.1 In `src/auth.ts`, change the provider guard from `if (process.env.TEST_AUTH_SECRET)` to `if (process.env.NODE_ENV !== "production" && process.env.TEST_AUTH_SECRET)` so the `test-bypass` block is dead-code-eliminated from production builds.
- [x] 1.2 Confirm `authorize` still verifies the caller against the server-side `TEST_AUTH_SECRET` (no client-supplied secret required to mint a session).

## 2. Stop the secret reaching the client (ENG-004)

- [x] 2.1 In `src/app/auth/signin/page.tsx`, compute `const devLoginEnabled = process.env.NODE_ENV !== "production" && !!process.env.TEST_AUTH_SECRET;` and pass `devLoginEnabled` (boolean) to `SignInForm` instead of `testAuthSecret`.
- [x] 2.2 In `src/app/auth/signin/SignInForm.tsx`, change the prop type from `testAuthSecret: string | null` to `devLoginEnabled: boolean`; render the dev-login button on that boolean.
- [x] 2.3 Update `handleDevLogin` to call `signIn("test-bypass", { email: "dev@example.com", callbackUrl: "/" })` — submit a fixed non-secret value, never the secret.

## 3. Guard test (the untested failure path)

- [x] 3.1 Add `src/auth.test.ts` that controls `NODE_ENV`/`TEST_AUTH_SECRET` via `vi.stubEnv` + `vi.resetModules()` and dynamic `import()` before resolving providers.
- [x] 3.2 Assert: no `test-bypass` provider when `NODE_ENV=production` and `TEST_AUTH_SECRET` is set.
- [x] 3.3 Assert: `test-bypass` provider present when `NODE_ENV` is not production and `TEST_AUTH_SECRET` is set; and absent when `TEST_AUTH_SECRET` is unset.
- [x] 3.4 Assert: `authorize` returns the user for the matching secret and returns null (no user upsert) for a non-matching secret.

## 4. Docs & config note

- [x] 4.1 Add `src/app/auth/signin/signin-page.test.tsx` — a server-render test using `react-dom/server` `renderToStaticMarkup` (no new deps; jsdom + React 19 already present). Mock `signIn` from `next-auth/react`.
- [x] 4.2 Assert: rendering `SignInPage` with `NODE_ENV`/`TEST_AUTH_SECRET` set so `devLoginEnabled` is true produces markup that shows the dev-login control **and** does not contain the secret string anywhere in the output.
- [x] 4.3 Assert: rendering with `devLoginEnabled` false (production) omits the dev-login control and still contains no secret string.

## 5. Docs & config note

- [x] 5.1 Update `.env.example` to note `TEST_AUTH_SECRET` is dev-only and MUST NOT be set in production.
- [x] 5.2 Mark Phase 1 step 5 (ENG-003/004) resolved in `docs/architecture-review/mcp-compliance-server-results.md`, referencing issue #29.

## 6. Verify

- [x] 6.1 Run `npm run test -- --run` (unit incl. the new provider guard test and the sign-in render test) and `npm run lint` / `npm run typecheck` — all green.
- [x] 6.2 Run `npm run build` and confirm the production bundle contains no `test-bypass` reference.
- [x] 6.3 Run `npm run dev` and confirm the dev-login button still signs in as `dev@example.com`.
- [x] 6.4 Run `npm run test:e2e` to confirm the minted-JWT auth path is unaffected.
