## Context

`src/auth.ts` registers a `test-bypass` `CredentialsProvider` whenever
`process.env.TEST_AUTH_SECRET` is set. Because the only gate is the presence of the
env var, the provider is compiled into every build (ENG-003) and is "off" in
production only by convention. `src/app/auth/signin/page.tsx` reads the raw
`TEST_AUTH_SECRET` and passes it as a prop (`testAuthSecret`) into the client
component `SignInForm`, which both (a) renders the "Sign in as dev@example.com"
button when the prop is truthy and (b) submits that exact secret value back through
`signIn("test-bypass", { secret })`. If the var were ever set in production, the
secret would ship in client HTML and the button would render (ENG-004).

Important current-state facts that shape this design:

- **The e2e suite does not use this provider.** `e2e/global-setup.ts` mints NextAuth
  JWTs directly with `AUTH_SECRET` and writes them into Playwright `storageState`
  files. Nothing in `e2e/` or `src/` drives `test-bypass` or the dev-login button.
- **CI runs no `next build`.** CI lints, typechecks, runs Vitest, and runs Playwright
  against `npm run dev` (`NODE_ENV=development`). So a production-only guard cannot
  break any CI step.
- **The dev-login button is a local human convenience** the user has chosen to keep
  (Option A), so the fix must preserve one-click local dev login.

## Goals / Non-Goals

**Goals:**
- The `test-bypass` provider is dead-code-eliminated from production builds (not
  merely inert), satisfying ENG-003.
- The raw `TEST_AUTH_SECRET` value never crosses the server→client boundary,
  satisfying ENG-004.
- Local one-click dev login continues to work under `NODE_ENV=development`.
- A guard test pins the production-absence behavior so this cannot silently
  regress (the untested failure path that caused ENG-006).

**Non-Goals:**
- Removing the bypass feature entirely (that was Option B; rejected).
- Removing or changing the vestigial CI `TEST_AUTH_SECRET` env var (separate
  GIT-005 tidy).
- Any change to the Resend magic-link provider, the JWT strategy, or session REST
  authorization (`session-access-control`).
- Changing how e2e authenticates (minted JWTs stay as-is).

## Decisions

### D1. Gate the provider on a static `NODE_ENV !== "production"` literal

```ts
if (process.env.NODE_ENV !== "production" && process.env.TEST_AUTH_SECRET) {
  providers.push(CredentialsProvider({ id: "test-bypass", ... }));
}
```

The `process.env.NODE_ENV` comparison against a string literal is statically
analyzable, so Next.js/webpack can eliminate the entire branch from a production
bundle. This is the difference the standard demands — "not compiled into production"
rather than "present but disabled at runtime."

*Alternative considered:* a runtime-only `if (TEST_AUTH_SECRET)` with a doc warning
(the ENG-004-only "Option C"). Rejected — it leaves ENG-003's "compiled into every
build" objection standing and would not close an H/Block.

### D2. Pass a boolean `devLoginEnabled`, never the secret

The server component computes the flag and passes only the boolean:

```ts
// page.tsx (server)
const devLoginEnabled =
  process.env.NODE_ENV !== "production" && !!process.env.TEST_AUTH_SECRET;
return <SignInForm devLoginEnabled={devLoginEnabled} />;
```

The `SignInForm` prop changes from `testAuthSecret: string | null` to
`devLoginEnabled: boolean`. The button renders on the boolean. This structurally
removes the secret from the client payload — there is no longer a code path that can
serialize it into HTML.

### D3. Client submits a fixed non-secret sentinel; server verifies the real secret

The dev-login button no longer holds the secret to submit. Instead the client
submits a fixed sentinel and the `authorize` callback validates against the
server-side `TEST_AUTH_SECRET`:

```ts
// SignInForm.tsx (client)
await signIn("test-bypass", { email: "dev@example.com", callbackUrl: "/" });
```

`authorize` runs server-side and already has access to `process.env.TEST_AUTH_SECRET`.
Because the provider only exists in non-production (D1), the trust model is: "this
provider being registered at all is the authorization; it is impossible in
production." The `authorize` callback keeps a secret comparison for defense in depth —
it compares the server-side secret to itself / a sentinel so a stray request without
the provider context still cannot mint a session, but the client no longer needs to
carry the secret value.

*Alternative considered:* keep submitting the secret but only in non-prod. Rejected —
it still ships the secret to the browser in dev, preserving the exact "secret in
client code" anti-pattern ENG-004 flags, just in a lower-stakes environment.

### D4. Guard test asserts provider absence under `NODE_ENV=production`

A Vitest unit test (`src/auth.test.ts`) resolves the provider list under
`NODE_ENV=production` + secret-set and asserts no `test-bypass` provider, plus the
positive dev case and the `authorize` accept/reject cases. This is the failure path
that was never tested — the root-cause pattern behind ENG-006.

### D5. Render test pins the "no secret in client payload" property

The two ENG-004 scenarios ("rendered sign-in page contains no bypass secret",
"production sign-in page hides the dev-login control") are properties of the
*rendered client payload*, which `auth.test.ts` cannot reach — it inspects the
provider list and `authorize` in isolation, never rendering `page.tsx` →
`SignInForm`. So a separate render test (`src/app/auth/signin/signin-page.test.tsx`)
uses `react-dom/server` `renderToStaticMarkup` to assert the secret string is absent
from the output and that the dev-login control's presence tracks `devLoginEnabled`.

`renderToStaticMarkup` (React 19, already a dep) is chosen over adding
`@testing-library/react` — no new dependency, and a string-absence assertion over
the markup is exactly the shape of the property under test. `signIn` from
`next-auth/react` is mocked (the test asserts rendered output, not the click flow).
The D2 type change makes the leak structurally impossible; this test makes that
guarantee *observable* rather than trusted, per the ENG-006 lesson.

## Risks / Trade-offs

- **`NODE_ENV` is read at module-load time, and `auth.ts` builds `providers` once at
  import.** → The guard test must control `NODE_ENV` before importing the module
  (e.g. `vi.stubEnv` + dynamic `import()` with `vi.resetModules()`), not after. The
  test will be written to re-import per env scenario.
- **Behavior change to the credentials contract** (client no longer sends the
  secret). → Contained to the dev-only path; the magic-link production flow is
  untouched, and e2e (minted JWTs) does not exercise this path, so blast radius is
  local dev only.
- **Someone could still set `TEST_AUTH_SECRET` in production.** → After D1 the
  provider is absent from the production bundle regardless, so setting the var has no
  effect; the risk is neutralized rather than merely documented.

## Migration Plan

No data migration. Deployment is a code change only:
1. Land the guard + prop change + test on a feature branch.
2. Verify locally: dev-login button still works under `npm run dev`; `npm run test`
   green; `npm run build` produces a bundle with no `test-bypass` reference.
3. Rollback is a straight revert — no state to unwind.

## Open Questions

- None blocking. (The CI `TEST_AUTH_SECRET` var is intentionally deferred to the
  GIT-005 tidy, not an open question for this change.)
