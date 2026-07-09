## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/22

## Why

A compliance review flagged `GET`/`PATCH` on `/api/sessions/[id]` as an IDOR
(**ENG-001**) because they authenticate the caller but do not check session
ownership. That framing is wrong for this product: Collaborative Gherkin is a
**link-sharing** editor. `SessionView` renders a "Copy invite link" button and the
copy "Share the link above so others can edit this session with you." The session
id is an unguessable `cuid`, so possession of the id **is** the invite — a
capability URL. Reading and editing a session you did not create is the core
feature, not an attack.

The real defect is the opposite of what the review assumed: a first attempt to
"fix the IDOR" added owner-only guards to `GET`/`PATCH`, which broke invited
collaborators (403 on load and on every model/prompt change). This change instead
enforces ownership **only where it belongs** — the destructive `DELETE` — and
documents the intended access-control contract so the "IDOR" is not re-reported.

`DELETE` already enforces ownership correctly. The genuine gaps are (a) the *access
model was never written down*, so the review misread capability-URL collaboration
as a bug, and (b) `SessionView` never checked `res.ok`, so a real failure (deleted
session → 404, server error → 500) was silently swallowed.

## What Changes

- `GET /api/sessions/[id]` remains readable by **any authenticated caller** that
  holds the id. Status contract: unauthenticated → 401; id not found → 404;
  otherwise → 200 with the session body. No ownership gate.
- `PATCH /api/sessions/[id]` remains modifiable by **any authenticated caller** that
  holds the id. Status contract: unauthenticated → 401; invalid body → 400; id not
  found → 404; otherwise → 200. No ownership gate.
- `DELETE /api/sessions/[id]` stays **owner-only**: unauthenticated → 401; id not
  found → 404; authenticated non-owner → 403; owner → 204. (Unchanged; documented
  here so the contract is explicit.)
- `SessionView` checks `res.ok` on all three `/api/sessions/[id]` fetches, rolls back
  the optimistic model selection on failure, and surfaces a `form-error` message —
  so a genuine 404/500 is shown to the user instead of being read as default
  settings or a false "saved" confirmation.
- Introduce a **second authenticated identity** into the Playwright harness
  (`e2e/global-setup.ts` mints `user2.json` alongside `user.json`) and add end-to-end
  characterisation tests (`e2e/session-access-control.spec.ts`) that assert the
  contract from a genuine non-owner: non-owner GET/PATCH succeed (200), non-owner
  DELETE is refused (403), and an invited collaborator sees no `form-error` banner and
  can change the model/prompt. Before this, the entire e2e suite ran as a single user,
  so no test could exercise the owner-vs-collaborator axis — the regression this change
  reverses would have passed CI. These tests were mutation-verified: re-applying the
  owner-only guard turns the non-owner GET/PATCH tests red.

Out of scope: the unauthenticated `llm-review` endpoint (ENG-002 / AI-006) is a
separate follow-up change. Page-level and Y.js websocket authorization (the document
body travels over an unauthenticated socket) is tracked separately; this change
covers the REST metadata endpoints only.

## Capabilities

### New Capabilities
- `session-access-control`: The access-control contract for the per-session REST
  API — GET/PATCH are capability-URL collaborative (any authenticated holder of the
  id), DELETE is owner-only, and the status-code contract (401/400/403/404) for each
  outcome.

### Modified Capabilities
<!-- None: no existing specs in openspec/specs/ yet. -->

## Impact

- **Code:** `src/app/api/sessions/[id]/route.ts` (GET/PATCH remain open, DELETE
  owner-only), `src/app/sessions/[id]/SessionView.tsx` (`res.ok` handling).
- **Tests:** `src/app/api/sessions/[id]/route.test.ts` (401/404/200 for GET,
  401/400/404/200 for PATCH, 401/403/404/204/500 for DELETE);
  `e2e/session-access-control.spec.ts` (non-owner GET/PATCH → 200, non-owner
  DELETE → 403, collaborator UX with no error banner); `e2e/global-setup.ts` (mints a
  second identity `user2.json`).
- **Behaviour:** Invited collaborators can read and edit shared sessions (the
  feature). Only the owner can delete. UI now surfaces real load/save failures.
- **Standards:** DELETE satisfies STD-ENTERPRISE-ACCESS-CONTROL 3.4 (deny by default
  for destructive actions). GET/PATCH are an accepted, documented capability-URL
  exception justified by the collaboration model.
- No new dependencies, no schema changes.
