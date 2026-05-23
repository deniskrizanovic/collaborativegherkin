# Authentication model: magic link, JWT sessions, Resend delivery

**Status:** Accepted  
**Date:** 2026-05-23

## Context

The app had no working auth. NextAuth v5 was installed at `beta.25` but unwired. All routes were unauthenticated; `Session.userId` was hardcoded to a seed placeholder in `HomeClient.tsx`. The schema had a `User` model with a required unique `email` field but no sign-in flow.

Three decisions had to be made together because they are tightly coupled:

1. **Who can access the app** — anonymous vs. authenticated
2. **How sessions relate to identity** — ownership model
3. **How users authenticate** — sign-in mechanism and token storage

## Decision

**Access:** Full gate. Every route requires authentication. There are no public routes — collaborators following a shared session URL must sign in before viewing.

**Ownership:** Any authenticated user may view and edit any session. Ownership (the `userId` foreign key on `Session`) is used only for: (a) the home page showing a user's own sessions, and (b) restricting delete to the session owner. It does not gate read or write access.

**Sign-in:** Magic link via email. Resend is the delivery provider. Users enter their email, receive a one-time link, and are authenticated on click. No passwords stored.

**Session storage:** JWT strategy (signed cookie). NextAuth's `Session` table is not used, avoiding a naming conflict with the existing `Session` Prisma model (Gherkin workspace). Only a `VerificationToken` model is added to the schema.

**NextAuth version:** Upgrade from `beta.25` to the latest stable v5 release as part of this work.

## Reasons

**Full gate over public session URLs:**  
The tool is designed for teams who share session URLs in Slack or Jira. Collaborators are expected to have (or create) an account. The magic link friction is a one-time cost per device; subsequent visits use the JWT cookie. Gating everything simplifies the middleware — no route allowlist to maintain.

**Any authenticated user can edit:**  
Sessions are collaborative workspaces, not private documents. Restricting edit to the owner would break the core use case. Invite-based access control (Google Docs model) is a future feature, not a v1 concern.

**Owner-only delete:**  
Delete is the one irreversible action. Restricting it to the owner prevents a collaborator from wiping a session accidentally. Consistent with the principle that ownership matters for housekeeping, not access.

**Magic link over OAuth or credentials:**  
Magic link captures a verified email (the primary identity goal) with no password storage. It composes cleanly with OAuth — adding Google as a second provider later requires no User model changes. Credentials were rejected due to password hashing/reset scope; OAuth alone was rejected because it requires users to have Google/GitHub accounts.

**JWT over database sessions:**  
NextAuth's database session model requires a `Session` table, which conflicts by name with the existing Gherkin `Session` model. Renaming `Session` → something else is a large, disruptive migration. JWT avoids that entirely. For a single-server app with no session revocation requirement, JWT is appropriate.

**Resend over SendGrid/Nodemailer:**  
NextAuth v5 has a first-class `@auth/resend-adapter`. Resend's free tier (3,000 emails/month) is sufficient for this use case. SendGrid requires Nodemailer configuration; self-hosted SMTP requires infrastructure.

## Consequences

- `VerificationToken` model added to `prisma/schema.prisma`.
- `Session.userId` remains non-nullable — anonymous sessions are not supported.
- `GET /api/sessions` filters by `userId = currentUser.id`.
- `DELETE /api/sessions/[id]` returns 403 if `session.userId !== currentUser.id`.
- All route handlers call `auth()` from NextAuth and return 401 if no session.
- The hardcoded placeholder `userId` in `HomeClient.tsx` is removed.
- Adding OAuth providers later requires only a new NextAuth provider entry — no User model change.
