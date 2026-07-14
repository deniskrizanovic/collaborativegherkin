## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/29

## Why

The test-only NextAuth `CredentialsProvider` (`test-bypass`) is gated only by the
presence of `TEST_AUTH_SECRET`, so a credential-based auth bypass is compiled into
**every** build — including production — and is "off" only because the env var
happens to be unset (ENG-003). Worse, the sign-in page reads the raw
`TEST_AUTH_SECRET` and passes it as a prop into the client `SignInForm`, so if the
var is ever set in production the secret ships in client HTML and the dev-login
button renders (ENG-004). Both are High / Block findings in the compliance
remediation roadmap (Phase 1, step 5).

## What Changes

- **Compile the bypass out of production builds.** Gate the `test-bypass` provider
  on `process.env.NODE_ENV !== "production"` (in addition to the existing secret
  check) using a static literal, so the bundler dead-code-eliminates the entire
  block from a production build rather than leaving it inert.
- **Stop the secret ever reaching the client.** The server component no longer
  passes `TEST_AUTH_SECRET` to the client. Instead it passes a boolean
  `devLoginEnabled` flag (computed server-side from the prod guard + secret
  presence). The client renders the dev-login button on that boolean and submits a
  fixed **non-secret sentinel**; the `authorize` callback verifies the real secret
  server-side.
- **Add a guard test** asserting the `test-bypass` provider is **absent** when
  `NODE_ENV=production` — the failure path that was never tested, which is why this
  slipped through (mirrors the ENG-006 post-mortem).
- **Document the dev-only nature** in `.env.example` and the relevant doc note.
- **Out of scope (deliberately):** the vestigial CI `TEST_AUTH_SECRET` env var is
  left untouched — its removal is a separate GIT-005 tidy and outside this
  security fix's blast radius. The e2e suite authenticates via directly-minted
  JWTs (`e2e/global-setup.ts`), not this provider, so it is unaffected.

## Capabilities

### New Capabilities
- `test-auth-bypass`: The development/test authentication bypass provider — when it
  is available, how it is gated, its exclusion from production builds, and the
  requirement that its secret never crosses the server/client boundary.

### Modified Capabilities
<!-- None. No existing spec defines the auth-provider layer; session-access-control
     covers REST endpoint authorization only. -->

## Impact

- **Code:** `src/auth.ts` (provider gate), `src/app/auth/signin/page.tsx` (pass
  boolean, not secret), `src/app/auth/signin/SignInForm.tsx` (render on boolean,
  submit sentinel).
- **Tests:** new unit test asserting the provider is absent under
  `NODE_ENV=production`.
- **Docs/config:** `.env.example` note on the dev-only bypass; roadmap step 5
  reference in `docs/architecture-review/mcp-compliance-server-results.md`.
- **Behavior change:** the credentials contract changes — the client no longer
  holds the bypass secret. No production behavior changes (the provider is not
  present in production today and remains absent). Local one-click dev login is
  preserved.
- **Not affected:** e2e auth (uses minted JWTs), the Resend magic-link provider,
  session REST authorization.
