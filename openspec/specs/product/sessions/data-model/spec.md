# data-model Specification

## Purpose

Persistence constraints for the `Session` and `User` records.

## Requirements

### Requirement: Session record constraints

A `Session` SHALL have a CUID `id`, a `title` that is a non-empty string of at
most 200 characters, a `createdAt` set automatically at creation, an
`updatedAt` updated automatically on every save, and exactly one associated
`User` via `userId`.

#### Scenario: Session has CUID, title constraints, timestamps, and user
> **Tests:** none
- **GIVEN** a session is created
- **THEN** its `id` is a CUID
- **AND** its `title` is a non-empty string of at most 200 characters
- **AND** its `createdAt` is set automatically at creation time
- **AND** its `updatedAt` is updated automatically on every save
- **AND** it is associated with exactly one `User` record via `userId`

### Requirement: Session coaching attributes

A `Session` SHALL also persist two optional coaching attributes — `prompt` and
`model` — each a nullable string, which store the per-session LLM-review
configuration written by `PATCH /api/sessions/[id]`. These attributes SHALL be
present in every supported database engine (SQLite and PostgreSQL) so the write
path behaves identically in development and production.

#### Scenario: Session persists optional coaching prompt and model
> **Tests:** none
- **GIVEN** a session exists
- **WHEN** a caller sets its coaching `prompt` and `model` via `PATCH /api/sessions/[id]`
- **THEN** both values are persisted as nullable string attributes of the session
- **AND** the write succeeds identically whether the backing engine is SQLite or PostgreSQL

#### Scenario: Coaching attributes default to unset
> **Tests:** none
- **GIVEN** a session is created without any coaching configuration
- **THEN** its `prompt` attribute is null
- **AND** its `model` attribute is null

### Requirement: User record constraints

A `User` SHALL have an `email` that is unique across all users and MAY own zero
or more sessions. A `User` SHALL also carry the optional profile attributes the
auth layer reads and writes: `name`, `emailVerified` and `image`, each
nullable. These attributes SHALL be present in every supported database engine
(SQLite and PostgreSQL).

#### Scenario: User email is unique and owns zero or more sessions
> **Tests:** none
- **GIVEN** a user record exists
- **THEN** its `email` is unique across all users
- **AND** a user may own zero or more sessions

#### Scenario: A user signed in by magic link has no profile image
> **Tests:** [`src/lib/user.test.ts`](/src/lib/user.test.ts) — a first magic-link sign-in creates a verified user with no name or image
- **GIVEN** no user exists for `new@example.com`
- **WHEN** `new@example.com` completes a magic-link sign-in for the first time
- **THEN** a user record exists for `new@example.com` with `emailVerified` set
- **AND** its `name` and `image` attributes are null

### Requirement: Cross-engine schema parity

The SQLite and PostgreSQL Drizzle schema modules SHALL define the same tables
and, for each table, the same columns with the same nullability. The only
sanctioned differences are dialect-specific column types (for example, a SQLite
integer timestamp versus a PostgreSQL `timestamp`) and how a default value is
expressed. No table SHALL exist in one
module without existing in the other. A parity check SHALL enforce this and
MUST fail the build when the table, column or nullability sets diverge.

#### Scenario: Field added to one engine only is rejected
> **Tests:** [`scripts/lint-schema-parity.test.ts`](/scripts/lint-schema-parity.test.ts) — fails and names the column when a column exists on one table only
- **GIVEN** a column exists on a table in one Drizzle schema module but not on the same table in the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the diverging table and column

#### Scenario: Model present in one engine only is rejected
> **Tests:** [`scripts/lint-schema-parity.test.ts`](/scripts/lint-schema-parity.test.ts) — fails and names the table when a table exists in one schema only
- **GIVEN** a table is defined in one Drizzle schema module but absent from the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the table that exists in only one module

#### Scenario: Nullability mismatch is rejected
> **Tests:** [`scripts/lint-schema-parity.test.ts`](/scripts/lint-schema-parity.test.ts) — fails when a shared column is nullable in one schema only
- **GIVEN** a column is nullable in one Drizzle schema module and required in the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the table and column whose nullability differs

#### Scenario: Matching schemas pass the parity check
> **Tests:** [`scripts/lint-schema-parity.test.ts`](/scripts/lint-schema-parity.test.ts) — passes when both schemas define the same tables and columns; the real SQLite and Postgres schemas are at parity
- **GIVEN** both Drizzle schema modules define the same tables, columns and nullability, differing only in dialect column types and default expressions
- **WHEN** the schema-parity check runs
- **THEN** the check passes
