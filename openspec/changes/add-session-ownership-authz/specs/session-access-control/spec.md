## ADDED Requirements

### Requirement: Session read is restricted to the owner

`GET /api/sessions/[id]` SHALL return the session only to its owner. The handler
MUST authenticate the caller and MUST verify that the authenticated user's id equals
the session's `userId` before returning any session data. Non-owners MUST NOT be able
to read another user's session.

The status-code ordering MUST be: unauthenticated → 401; session not found → 404;
authenticated non-owner → 403; owner → 200.

#### Scenario: Unauthenticated request is rejected
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — GET returns 401 when unauthenticated
- **WHEN** an unauthenticated caller requests `GET /api/sessions/{id}`
- **THEN** the API responds with 401 and no session data

#### Scenario: Owner reads their session
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — GET returns 200 with session including prompt and model
- **WHEN** the authenticated owner requests `GET /api/sessions/{id}`
- **THEN** the API responds with 200 and the session body (including `prompt` and `model`)

#### Scenario: Non-owner is forbidden
> **Tests:** none
- **WHEN** an authenticated user requests `GET /api/sessions/{id}` for a session whose `userId` is a different user
- **THEN** the API responds with 403 and no session data

#### Scenario: Missing session returns not found
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — GET returns 404 when session is not found
- **WHEN** an authenticated caller requests `GET /api/sessions/{id}` for an id that does not exist
- **THEN** the API responds with 404

### Requirement: Session modification is restricted to the owner

`PATCH /api/sessions/[id]` SHALL apply updates only when the authenticated user owns
the target session. The handler MUST authenticate the caller and MUST verify ownership
(`session.userId` equals the authenticated user's id) before writing any change.
Non-owners MUST NOT be able to modify another user's session.

The status-code ordering MUST be: unauthenticated → 401; invalid body → 400; session
not found → 404; authenticated non-owner → 403; owner with valid body → 200.

#### Scenario: Unauthenticated request is rejected
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 401 when unauthenticated
- **WHEN** an unauthenticated caller sends `PATCH /api/sessions/{id}`
- **THEN** the API responds with 401 and makes no change

#### Scenario: Owner updates their session
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 200 when model/prompt is updated
- **WHEN** the authenticated owner sends a valid `PATCH /api/sessions/{id}` body
- **THEN** the API responds with 200 and the update is applied

#### Scenario: Non-owner is forbidden
> **Tests:** none
- **WHEN** an authenticated user sends `PATCH /api/sessions/{id}` for a session whose `userId` is a different user
- **THEN** the API responds with 403 and no change is made

#### Scenario: Invalid body is rejected before ownership disclosure
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 400 when prompt too short / model invalid
- **WHEN** an authenticated caller sends `PATCH /api/sessions/{id}` with a body that fails validation
- **THEN** the API responds with 400
