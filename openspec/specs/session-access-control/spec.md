# Session Access Control

## Purpose

Defines the authorization model for session operations (GET, PATCH, DELETE) on the `/api/sessions/[id]` endpoint, balancing the collaboration feature (capability-URL invite links) with destructive-operation protection.

## Requirements

### Requirement: Session read is open to any authenticated holder of the id

`GET /api/sessions/[id]` SHALL return the session to **any authenticated caller** that
supplies a valid session id. The session id is an unguessable `cuid` shared as an
invite link ("capability URL"), so holding the id is the authorization to read the
session — this is the collaboration feature, not an IDOR. The handler MUST authenticate
the caller but MUST NOT gate on ownership.

The status-code ordering MUST be: unauthenticated → 401; session not found → 404;
authenticated caller with a valid id → 200.

#### Scenario: Unauthenticated request is rejected
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — GET returns 401 when unauthenticated
- **GIVEN** an unauthenticated caller
- **WHEN** the caller requests `GET /api/sessions/{id}`
- **THEN** the API responds with 401 and no session data

#### Scenario: Any authenticated holder of the id reads the session
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — GET returns 200 with session including prompt and model
- **GIVEN** an authenticated caller and an existing session
- **WHEN** the caller requests `GET /api/sessions/{id}`
- **THEN** the API responds with 200 and the session body (including `prompt` and `model`), regardless of whether the caller is the session's creator

#### Scenario: A non-owner collaborator reads a shared session
> **Tests:** [`e2e/session-access-control.spec.ts`](../../../../../e2e/session-access-control.spec.ts) — non-owner can GET a session they hold the id for (200); a second user opens the shared link: no error banner, settings load
- **GIVEN** an authenticated user who is **not** the session's creator and a session created by a different user
- **WHEN** the user requests `GET /api/sessions/{id}`
- **THEN** the API responds with 200 and the session body, and the session page shows no error banner (the invite-link collaboration path)

#### Scenario: Missing session returns not found
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — GET returns 404 when session is not found
- **GIVEN** an authenticated caller and a session id that does not exist
- **WHEN** the caller requests `GET /api/sessions/{id}`
- **THEN** the API responds with 404

### Requirement: Session modification is open to any authenticated holder of the id

`PATCH /api/sessions/[id]` SHALL apply updates for **any authenticated caller** that
supplies a valid session id. Editing shared session settings (model, prompt) is part of
the collaboration feature; the handler MUST authenticate the caller but MUST NOT gate on
ownership.

The status-code ordering MUST be: unauthenticated → 401; invalid body → 400; session
not found → 404; authenticated caller with a valid body and existing id → 200.

#### Scenario: Unauthenticated request is rejected
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 401 when unauthenticated
- **GIVEN** an unauthenticated caller
- **WHEN** the caller sends `PATCH /api/sessions/{id}`
- **THEN** the API responds with 401 and makes no change

#### Scenario: Any authenticated holder of the id updates the session
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 200 when model/prompt is updated
- **GIVEN** an authenticated caller, an existing session, and a valid request body
- **WHEN** the caller sends `PATCH /api/sessions/{id}`
- **THEN** the API responds with 200 and the update is applied, regardless of whether the caller is the session's creator

#### Scenario: A non-owner collaborator edits a shared session's settings
> **Tests:** [`e2e/session-access-control.spec.ts`](../../../../../e2e/session-access-control.spec.ts) — non-owner can PATCH a session's settings (200); a second user can change the model and it persists; a second user can save a new prompt
- **GIVEN** an authenticated user who is **not** the session's creator and a session created by a different user
- **WHEN** the user changes the model or saves a prompt
- **THEN** the API responds with 200, the change persists across a reload, and the UI shows no error banner (no false-success, no silently-swallowed 403)

#### Scenario: Invalid body is rejected
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 400 when prompt too short / model invalid
- **GIVEN** an authenticated caller and a request body that fails validation
- **WHEN** the caller sends `PATCH /api/sessions/{id}`
- **THEN** the API responds with 400

#### Scenario: Missing session returns not found
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 404 when session is not found
- **GIVEN** an authenticated caller, a valid request body, and a session id that does not exist
- **WHEN** the caller sends `PATCH /api/sessions/{id}`
- **THEN** the API responds with 404 and makes no change

### Requirement: Session deletion is restricted to the owner

`DELETE /api/sessions/[id]` SHALL delete the session only when the authenticated caller
is its owner. Deletion is destructive and removes the shared workspace for every
collaborator, so it is the one per-session verb that MUST gate on ownership
(`session.userId` equals the authenticated user's id).

The status-code ordering MUST be: unauthenticated → 401; session not found → 404;
authenticated non-owner → 403; owner → 204.

#### Scenario: Unauthenticated request is rejected
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — DELETE returns 401 when unauthenticated
- **GIVEN** an unauthenticated caller
- **WHEN** the caller sends `DELETE /api/sessions/{id}`
- **THEN** the API responds with 401 and makes no change

#### Scenario: Non-owner is forbidden
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — DELETE returns 403 when authenticated user does not own the session; [`e2e/session-access-control.spec.ts`](../../../../../e2e/session-access-control.spec.ts) — non-owner cannot DELETE a session (403), deletion stays owner-only
- **GIVEN** an authenticated user and a session whose `userId` is a different user
- **WHEN** the user sends `DELETE /api/sessions/{id}`
- **THEN** the API responds with 403 and the session is not deleted (the owner can still read it afterwards)

#### Scenario: Owner deletes their session
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — DELETE returns 204 with no body when session is deleted by owner
- **GIVEN** an authenticated user who owns the session
- **WHEN** the owner sends `DELETE /api/sessions/{id}`
- **THEN** the API responds with 204 and the session is deleted

#### Scenario: Missing session returns not found
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — DELETE returns 404 when session is not found on get before delete
- **GIVEN** an authenticated caller and a session id that does not exist
- **WHEN** the caller sends `DELETE /api/sessions/{id}`
- **THEN** the API responds with 404
