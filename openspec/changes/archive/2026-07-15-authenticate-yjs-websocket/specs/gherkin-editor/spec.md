## MODIFIED Requirements

### Requirement: Loading

When a user opens a session the editor SHALL establish an authenticated WebSocket
connection to a **same-origin** URL (derived from the current page origin, e.g.
`wss://{host}` in production or `ws://{host}` in development) in room
`session-{sessionId}`, synchronise the Y.js document, and become interactive. The
connection is authenticated by the same-origin session cookie (see
`realtime-collaboration`); the editor only becomes interactive once an authenticated
connection is established. A newly empty document MUST be seeded exactly once per
document lifetime with five empty scaffold blocks — Feature, Scenario, Given, When,
Then — with the cursor at the start of the Feature block. Subsequent users receive
the document via Y.js sync and MUST NOT trigger re-seeding.

#### Scenario: Editor establishes WebSocket and becomes interactive
> **Tests:** [`e2e/websocket-auth.spec.ts`](../../../e2e/websocket-auth.spec.ts) — authenticated upgrade to a valid room succeeds and receives sync state; [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts) — editor becomes interactive and syncs over the authenticated socket
- **GIVEN** a signed-in user opens a session
- **WHEN** the editor mounts
- **THEN** an authenticated WebSocket connection is established to the same-origin sync URL in the room `session-{sessionId}`
- **AND** the Y.js document state is synchronised with the server and any other connected peers
- **AND** the editor becomes interactive once the connection is established

#### Scenario: New document seeded with 5 scaffold blocks once
> **Tests:** [`e2e/initial-content.spec.ts`](../../../e2e/initial-content.spec.ts) — order · empty text · cursor on Feature; [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts) — second joiner does not re-seed
- **GIVEN** the Y.js document is empty after synchronisation
- **WHEN** the first user's editor finishes syncing
- **THEN** the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then
- **AND** each scaffold block contains no text — only the keyword label is displayed
- **AND** the cursor is placed at the start of the Feature block
- **AND** the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding
