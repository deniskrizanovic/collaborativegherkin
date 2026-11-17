## MODIFIED Requirements

### Requirement: Session record constraints

A `Session` SHALL have a CUID `id`, a `title` that is a non-empty string of at
most 200 characters, a `createdAt` set automatically at creation, an
`updatedAt` updated automatically on every save, and exactly one associated
`User` via `userId`.

#### Scenario: Session has CUID, title constraints, timestamps, and user
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — gets a generated CUID id and both timestamps; moves updatedAt on every update; rejects a session whose user does not exist
- **GIVEN** a session is created
- **THEN** its `id` is a CUID
- **AND** its `title` is a non-empty string of at most 200 characters
- **AND** its `createdAt` is set automatically at creation time
- **AND** its `updatedAt` is updated automatically on every save
- **AND** it is associated with exactly one `User` record via `userId`

### Requirement: User record constraints

A `User` SHALL have an `email` that is unique across all users and MAY own zero
or more sessions. A `User` SHALL also carry the optional profile attributes the
auth layer reads and writes: `name`, `emailVerified` and `image`, each
nullable. These attributes SHALL be present in every supported database engine
(SQLite and PostgreSQL).

#### Scenario: User email is unique and owns zero or more sessions
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — rejects a second user with the same email; may own zero or more sessions
- **GIVEN** a user record exists
- **THEN** its `email` is unique across all users
- **AND** a user may own zero or more sessions

#### Scenario: A second user with the same email is rejected
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — rejects a second user with the same email
- **GIVEN** a user record exists for `dev@example.com`
- **WHEN** a second user is inserted with the email `dev@example.com`
- **THEN** the insert fails and only one user record exists for `dev@example.com`

#### Scenario: A user signed in by magic link has no profile image
> **Tests:** [`src/lib/user.test.ts`](/src/lib/user.test.ts) — a first magic-link sign-in creates a verified user with no name or image
- **GIVEN** no user exists for `new@example.com`
- **WHEN** `new@example.com` completes a magic-link sign-in for the first time
- **THEN** a user record exists for `new@example.com` with `emailVerified` set
- **AND** its `name` and `image` attributes are null

## ADDED Requirements

### Requirement: Auth record constraints

An `Account` SHALL have a CUID `id` and SHALL be unique on the pair
(`provider`, `providerAccountId`). A `VerificationToken` SHALL be unique on the
pair (`identifier`, `token`). Deleting a `User` SHALL delete that user's
`Account` records, and SHALL be rejected while the user owns any `Session`.
These constraints SHALL hold identically in every supported database engine
(SQLite and PostgreSQL).

#### Scenario: A duplicate provider account is rejected
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — rejects a duplicate provider and providerAccountId
- **GIVEN** an `Account` exists with provider `resend` and providerAccountId `dev@example.com`
- **WHEN** a second `Account` is inserted with the same provider and providerAccountId
- **THEN** the insert fails

#### Scenario: A duplicate verification token is rejected
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — rejects a duplicate identifier and token
- **GIVEN** a `VerificationToken` exists for identifier `dev@example.com` with token `abc123`
- **WHEN** a second `VerificationToken` is inserted with the same identifier and token
- **THEN** the insert fails

#### Scenario: Deleting a user deletes their accounts
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — is deleted with its user
- **GIVEN** a user with one `Account` and no sessions
- **WHEN** the user is deleted
- **THEN** no `Account` record for that user remains

#### Scenario: A user who owns a session cannot be deleted
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — blocks deleting a user who owns a session
- **GIVEN** a user who owns one session
- **WHEN** the user is deleted
- **THEN** the delete fails and both the user and the session remain

#### Scenario: An account gets a generated id
> **Tests:** [`src/db/schema.test.ts`](/src/db/schema.test.ts) — gets a generated CUID id
- **GIVEN** a user exists
- **WHEN** an `Account` is inserted for the user with no `id`
- **THEN** the stored account has a CUID `id`
