# realtime-collaboration Specification

## Purpose

Live, multi-user editing of a shared session document via Tiptap's Y.js
integration — propagating each user's changes to all connected peers and
showing remote cursors.

## Requirements

### Requirement: Authenticated WebSocket sync connection

The real-time sync WebSocket SHALL accept a connection only from a caller with a
valid authenticated session. The server MUST verify the NextAuth session JWT
presented via the same-origin `authjs.session-token` cookie on the upgrade request,
using the shared `AUTH_SECRET`. A connection with a missing or invalid token MUST be
rejected before the sync handshake begins and MUST NOT join any room, read any
document state, or receive any awareness data. The rejection MUST emit a
content-free security log event via the Pino logger.

Authorization follows the capability model of ADR-0005: an authenticated caller is
authorized for room `session-{sessionId}` by holding the room name; no per-session
ownership or membership lookup is performed. The room name MUST match the
`session-{sessionId}` form; a malformed or unstructured room name MUST be rejected
even for an authenticated caller.

#### Scenario: Authenticated user connects and syncs
> **Tests:** [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts)
- **GIVEN** a signed-in user with a valid session cookie opens a session URL
- **WHEN** the editor opens the sync WebSocket to `session-{sessionId}`
- **THEN** the upgrade is accepted, the Y.js document synchronises, and the editor becomes interactive

#### Scenario: Unauthenticated connection is rejected
> **Tests:** [`e2e/websocket-auth.spec.ts`](../../../e2e/websocket-auth.spec.ts) — unauthenticated upgrade refused with 401, no data sent; [`src/lib/wsAuth.test.ts`](../../../src/lib/wsAuth.test.ts) — missing/invalid/bad-secret token → `unauthenticated`
- **GIVEN** a client with no valid `authjs.session-token` cookie
- **WHEN** it attempts to open the sync WebSocket to any `session-{sessionId}` room
- **THEN** the upgrade is refused before the sync handshake, no room is joined, and no document or awareness state is sent
- **AND** a content-free security log event is emitted via the Pino logger

#### Scenario: Authenticated holder of the session id is authorized
> **Tests:** [`e2e/websocket-auth.spec.ts`](../../../e2e/websocket-auth.spec.ts) — authenticated upgrade to a valid room succeeds; [`src/lib/wsAuth.test.ts`](../../../src/lib/wsAuth.test.ts) — valid JWT accepted for a well-formed room
- **GIVEN** a signed-in user who holds a session id (the capability URL) but does not own the session
- **WHEN** the editor opens the sync WebSocket to that `session-{sessionId}` room
- **THEN** the connection is authorized and syncs, with no ownership lookup performed

#### Scenario: Malformed room name is rejected
> **Tests:** [`e2e/websocket-auth.spec.ts`](../../../e2e/websocket-auth.spec.ts) — authenticated upgrade to a malformed room is refused; [`src/lib/wsAuth.test.ts`](../../../src/lib/wsAuth.test.ts) — valid session on malformed room → `malformed-room`
- **GIVEN** a signed-in user with a valid session cookie
- **WHEN** it attempts to open the sync WebSocket to a room name that is not of the form `session-{sessionId}`
- **THEN** the connection is rejected and no room is created or joined

### Requirement: Live change propagation and remote cursors

A change made by one user SHALL be reflected in every other connected user's
editor in real time when two or more users have the same session URL open.
Each remote user's cursor position MUST be visible, displayed in a distinct
colour.

#### Scenario: Change by one user is visible to all in real time
> **Tests:** [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts)
- **GIVEN** two or more users have the same session URL open
- **WHEN** one user types or inserts a block
- **THEN** all other connected users see the change reflected in their editors in real time

#### Scenario: Remote user cursors visible in distinct colour
> **Tests:** [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts)
- **GIVEN** two or more users are in the same session
- **WHEN** the editor renders
- **THEN** each remote user's cursor position is visible, displayed in a distinct colour
