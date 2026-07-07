# sessions-api Specification

## Purpose

The REST API for the session collection endpoint (`/api/sessions`): listing a
user's sessions and creating a new one. All endpoints require a valid
authenticated session (JWT cookie); unauthenticated requests return 401.
(Per-session endpoints `/api/sessions/[id]` are governed by
`session-access-control`.)

## Requirements

### Requirement: GET /api/sessions

`GET /api/sessions` SHALL require authentication and return the sessions owned
by the authenticated user. An authenticated request MUST return 200 with an
array of sessions (each including `id`, `title`, `createdAt`, `userId`); an
unauthenticated request MUST return 401; a server error MUST return 500 with
the message `"Failed to list sessions"`.

#### Scenario: Authenticated GET returns 200 with sessions
> **Tests:** none
- **WHEN** a GET request with a valid authenticated session is made to `/api/sessions`
- **THEN** a 200 response is returned containing an array of sessions owned by the authenticated user
- **AND** each session includes `id`, `title`, `createdAt`, `userId`

#### Scenario: Unauthenticated GET returns 401
> **Tests:** none
- **WHEN** an unauthenticated GET request is made to `/api/sessions`
- **THEN** a 401 response is returned

#### Scenario: Server error returns 500
> **Tests:** none
- **WHEN** a server error occurs during a GET request to `/api/sessions`
- **THEN** a 500 response is returned with the message `"Failed to list sessions"`

### Requirement: POST /api/sessions

`POST /api/sessions` SHALL require authentication and create a session from a
valid `{ title }` body. A valid authenticated request MUST return 201 with the
full created session (its `userId` set to the authenticated user); an
unauthenticated request MUST return 401; a missing/empty title or a title over
200 characters MUST return 400 with field-level validation errors; a server
error MUST return 500 with the message `"Failed to create session"`.

#### Scenario: Authenticated POST with valid title returns 201
> **Tests:** none
- **WHEN** a POST request with a valid authenticated session and a valid body `{ title }` is made to `/api/sessions`
- **THEN** a 201 response is returned containing the full created session object
- **AND** the session's `userId` is set to the authenticated user's id

#### Scenario: Unauthenticated POST returns 401
> **Tests:** none
- **WHEN** an unauthenticated POST request is made to `/api/sessions`
- **THEN** a 401 response is returned

#### Scenario: POST with empty title returns 400
> **Tests:** none
- **WHEN** a POST request with a missing or empty title is made to `/api/sessions`
- **THEN** a 400 response is returned with field-level validation errors

#### Scenario: POST with title over 200 chars returns 400
> **Tests:** none
- **WHEN** a POST request with a title longer than 200 characters is made to `/api/sessions`
- **THEN** a 400 response is returned with field-level validation errors

#### Scenario: Server error during creation returns 500
> **Tests:** none
- **WHEN** a server error occurs during a POST request to `/api/sessions`
- **THEN** a 500 response is returned with the message `"Failed to create session"`
