## MODIFIED Requirements

### Requirement: Session record constraints

A `Session` SHALL have a CUID `id`, a `title` that is a non-empty string of at
most 200 characters, a `createdAt` set automatically at creation, an
`updatedAt` updated automatically on every save, and exactly one associated
`User` via `userId`. A `Session` SHALL also persist two optional coaching
attributes — `prompt` and `model` — each a nullable string, which store the
per-session LLM-review configuration written by `PATCH /api/sessions/[id]`.
These attributes SHALL be present in every supported database engine (SQLite
and PostgreSQL) so the write path behaves identically in development and
production.

#### Scenario: Session has CUID, title constraints, timestamps, and user
> **Tests:** none
- **GIVEN** a session is created
- **THEN** its `id` is a CUID
- **AND** its `title` is a non-empty string of at most 200 characters
- **AND** its `createdAt` is set automatically at creation time
- **AND** its `updatedAt` is updated automatically on every save
- **AND** it is associated with exactly one `User` record via `userId`

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

## ADDED Requirements

### Requirement: Cross-engine schema parity

The SQLite and PostgreSQL Prisma schemas SHALL define the same set of models
and, for each model, the same set of fields. The only sanctioned differences
between the two schema files are the datasource `provider`, the generator
`output` path, and engine-specific native attributes; the model and field sets
MUST otherwise be identical. No model SHALL exist in one schema without existing
in the other. A parity check SHALL enforce this and MUST fail the build when the
model or field sets diverge.

#### Scenario: Field added to one engine only is rejected
> **Tests:** none
- **GIVEN** a field exists on a model in one Prisma schema but not on the same model in the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the diverging model and field

#### Scenario: Model present in one engine only is rejected
> **Tests:** none
- **GIVEN** a model is defined in one Prisma schema but absent from the other
- **WHEN** the schema-parity check runs
- **THEN** the check fails and names the model that exists in only one schema

#### Scenario: Matching schemas pass the parity check
> **Tests:** none
- **GIVEN** both Prisma schemas define the same models and fields, differing only in the sanctioned provider/output/native-attribute settings
- **WHEN** the schema-parity check runs
- **THEN** the check passes
