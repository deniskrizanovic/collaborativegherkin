## MODIFIED Requirements

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
> **Tests:** [`src/lib/user.test.ts`](../../../../../src/lib/user.test.ts) — a first magic-link sign-in creates a verified user with no name or image
- **GIVEN** no user exists for `new@example.com`
- **WHEN** `new@example.com` completes a magic-link sign-in for the first time
- **THEN** a user record exists for `new@example.com` with `emailVerified` set
- **AND** its `name` and `image` attributes are null

### Requirement: Cross-engine schema parity

The SQLite and PostgreSQL Drizzle schema modules SHALL define the same set of
tables and, for each table, the same set of columns with the same nullability.
The only sanctioned differences between the two modules are the dialect-specific
column types (for example, a SQLite integer timestamp versus a PostgreSQL
`timestamp`) and how a default value is expressed. No table SHALL exist in one
module without existing in the other. A parity check SHALL enforce this and
MUST fail the build when the table, column or nullability sets diverge.

#### Scenario: Field added to one engine only is rejected
> **Tests:** [`scripts/lint-schema-parity.test.ts`](../../../../../scripts/lint-schema-parity.test.ts) — fails and names the column when a column exists on one table only
- **GIVEN** a column exists on a table in one Drizzle schema module but not on the same table in the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the diverging table and column

#### Scenario: Model present in one engine only is rejected
> **Tests:** [`scripts/lint-schema-parity.test.ts`](../../../../../scripts/lint-schema-parity.test.ts) — fails and names the table when a table exists in one schema only
- **GIVEN** a table is defined in one Drizzle schema module but absent from the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the table that exists in only one module

#### Scenario: Nullability mismatch is rejected
> **Tests:** [`scripts/lint-schema-parity.test.ts`](../../../../../scripts/lint-schema-parity.test.ts) — fails when a shared column is nullable in one schema only
- **GIVEN** a column is nullable in one Drizzle schema module and required in the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the table and column whose nullability differs

#### Scenario: Matching schemas pass the parity check
> **Tests:** [`scripts/lint-schema-parity.test.ts`](../../../../../scripts/lint-schema-parity.test.ts) — passes when both schemas define the same tables and columns; the real SQLite and Postgres schemas are at parity
- **GIVEN** both Drizzle schema modules define the same tables, columns and nullability, differing only in dialect column types and default expressions
- **WHEN** the schema-parity check runs
- **THEN** the check passes
