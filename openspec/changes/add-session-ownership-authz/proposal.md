## Why

`GET` and `PATCH` on `/api/sessions/[id]` authenticate the caller (401 when signed
out) but never check that the caller owns the session. Any signed-in user can read
or modify any other user's session by guessing or enumerating its id — an IDOR
(insecure direct object reference). The compliance review flags this as **ENG-001**
(High, Block) and notes it slipped through because ownership is tested only for
`DELETE` (**ENG-006**). `DELETE` already enforces ownership correctly, so the fix is
to bring `GET` and `PATCH` up to the same standard and close the test gap.

## What Changes

- `GET /api/sessions/[id]` returns **403 Forbidden** when the authenticated user is
  not the owner of the requested session, instead of returning the session body.
- `PATCH /api/sessions/[id]` returns **403 Forbidden** when the authenticated user is
  not the owner of the target session, instead of applying the update.
- Both handlers reuse the existing `DELETE` ownership pattern
  (`row.userId !== authSession.user.id → 403`), keeping the 401 → 404 → 403 ordering
  consistent across all three verbs.
- Add failure-path tests asserting 403 for `GET` and `PATCH` against a session owned
  by a different user (closes ENG-006 / TEST-001 for these paths).

Out of scope: the unauthenticated `llm-review` endpoint (ENG-002 / AI-006) is a
separate follow-up change.

## Capabilities

### New Capabilities
- `session-access-control`: Object-level (ownership) authorization for the
  per-session REST API — who may read, modify, and delete a session, and the
  status-code contract (401/403/404) for each outcome.

### Modified Capabilities
<!-- None: no existing specs in openspec/specs/ yet. -->

## Impact

- **Code:** `src/app/api/sessions/[id]/route.ts` (GET, PATCH handlers).
- **Tests:** `src/app/api/sessions/[id]/route.test.ts` (add 403 cases for GET, PATCH).
- **Behaviour:** Callers that previously received another user's session data via GET,
  or silently modified it via PATCH, now receive 403. No change for owners.
- **Standards:** STD-ENTERPRISE-ACCESS-CONTROL 3.4 (deny by default, object-level),
  3.1 (least privilege); ENG-CTRL-04 3.2 (test failure paths).
- No new dependencies, no schema changes, no API surface changes beyond the added
  403 response.
