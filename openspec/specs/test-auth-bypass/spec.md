# test-auth-bypass Specification

## Purpose

A development-only authentication bypass mechanism that allows developers to sign
in instantly during local development and testing without email delivery latency.
The bypass is strictly excluded from production builds through static
environment checks that enable dead-code elimination.

## Requirements

### Requirement: The test-auth bypass provider is excluded from production builds

The `test-bypass` `CredentialsProvider` SHALL NOT be registered when
`process.env.NODE_ENV` is `"production"`. The guard MUST be expressed as a static
`process.env.NODE_ENV !== "production"` check (combined with the existing
`TEST_AUTH_SECRET` presence check) so that a production bundler dead-code-eliminates
the provider block rather than leaving it inert. In production the provider MUST NOT
be present in the configured NextAuth providers regardless of whether
`TEST_AUTH_SECRET` is set.

#### Scenario: Production build omits the bypass provider even when the secret is set
> **Tests:** [`src/auth.test.ts`](../../../src/auth.test.ts) — no test-bypass provider when NODE_ENV=production and TEST_AUTH_SECRET is set
- **GIVEN** the app is built with `NODE_ENV=production` and `TEST_AUTH_SECRET` set to a value
- **WHEN** the NextAuth providers are resolved
- **THEN** no provider with id `test-bypass` is present

#### Scenario: Non-production build registers the bypass provider when the secret is set
> **Tests:** [`src/auth.test.ts`](../../../src/auth.test.ts) — test-bypass provider present when NODE_ENV is not production and TEST_AUTH_SECRET is set
- **GIVEN** the app is running with `NODE_ENV` other than `"production"` and `TEST_AUTH_SECRET` set to a value
- **WHEN** the NextAuth providers are resolved
- **THEN** a provider with id `test-bypass` is present

#### Scenario: Absent secret leaves the bypass provider unregistered
> **Tests:** [`src/auth.test.ts`](../../../src/auth.test.ts) — no test-bypass provider when TEST_AUTH_SECRET is unset
- **GIVEN** the app is running with `TEST_AUTH_SECRET` unset
- **WHEN** the NextAuth providers are resolved
- **THEN** no provider with id `test-bypass` is present

### Requirement: The bypass secret never crosses the server/client boundary

The sign-in page SHALL NOT pass the value of `TEST_AUTH_SECRET` to any client
component. The server MUST compute a boolean `devLoginEnabled` flag
(`NODE_ENV !== "production"` AND `TEST_AUTH_SECRET` present) and pass only that
boolean to the client sign-in form. The client MUST render the dev-login control on
that boolean and MUST submit a fixed, non-secret sentinel rather than the secret
value; the `authorize` callback MUST verify the caller against the server-side
`TEST_AUTH_SECRET`.

#### Scenario: The rendered sign-in page contains no bypass secret
> **Tests:** [`src/app/auth/signin/signin-page.test.tsx`](../../../src/app/auth/signin/signin-page.test.tsx) — rendered markup with TEST_AUTH_SECRET set contains no secret value and shows the dev-login control
- **GIVEN** a dev environment with `TEST_AUTH_SECRET` set and `devLoginEnabled` true
- **WHEN** the sign-in page is rendered and delivered to the browser
- **THEN** the value of `TEST_AUTH_SECRET` appears nowhere in the client payload, and the dev-login control is shown

#### Scenario: Production sign-in page hides the dev-login control
> **Tests:** [`src/app/auth/signin/signin-page.test.tsx`](../../../src/app/auth/signin/signin-page.test.tsx) — rendered markup with devLoginEnabled false omits the dev-login control and contains no secret value
- **GIVEN** a production environment where `devLoginEnabled` is false
- **WHEN** the sign-in page is rendered
- **THEN** the dev-login control is not shown and no bypass secret is present in the client payload

### Requirement: The bypass authenticates without a client-supplied secret and rejects a mismatched one

Because the provider is registered only in non-production (its mere presence is the
authorization), the client MUST NOT need to supply the secret. The `authorize`
callback of the `test-bypass` provider SHALL treat an absent submitted secret as the
server-side `TEST_AUTH_SECRET` and sign the caller in. When a secret IS explicitly
submitted, it MUST match the server-side `TEST_AUTH_SECRET`; a submission whose secret
does not match MUST NOT create a session, and MUST NOT create or upsert a user.

#### Scenario: No client-supplied secret signs the dev user in
> **Tests:** [`src/auth.test.ts`](../../../src/auth.test.ts) — authorize signs the dev user in when no secret is submitted (the client flow)
- **GIVEN** a non-production environment with `TEST_AUTH_SECRET` set and a caller submitting an email with no secret (the flow the client sign-in form uses)
- **WHEN** the `test-bypass` `authorize` callback runs
- **THEN** it returns the user record for that email

#### Scenario: Correct secret signs the dev user in
> **Tests:** [`src/auth.test.ts`](../../../src/auth.test.ts) — authorize returns a user when the submitted secret matches TEST_AUTH_SECRET
- **GIVEN** a non-production environment with `TEST_AUTH_SECRET` set and a caller submitting the matching secret with an email
- **WHEN** the `test-bypass` `authorize` callback runs
- **THEN** it returns the user record for that email

#### Scenario: Wrong secret is rejected
> **Tests:** [`src/auth.test.ts`](../../../src/auth.test.ts) — authorize returns null when the submitted secret does not match
- **GIVEN** a non-production environment with `TEST_AUTH_SECRET` set and a caller submitting a secret that does not match
- **WHEN** the `test-bypass` `authorize` callback runs
- **THEN** it returns null and no user is created or upserted
