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
- **WHEN** a session is created
- **THEN** its `id` is a CUID
- **AND** its `title` is a non-empty string of at most 200 characters
- **AND** its `createdAt` is set automatically at creation time
- **AND** its `updatedAt` is updated automatically on every save
- **AND** it is associated with exactly one `User` record via `userId`

### Requirement: User record constraints

A `User` SHALL have an `email` that is unique across all users and MAY own zero
or more sessions.

#### Scenario: User email is unique and owns zero or more sessions
> **Tests:** none
- **WHEN** a user record exists
- **THEN** its `email` is unique across all users
- **AND** a user may own zero or more sessions
