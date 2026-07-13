## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/27

## Why

`POST /api/llm-review` has **no authentication gate** (finding **ENG-002** /
**AI-006**, High, Block). Unlike every other session route — `GET`, `PATCH`,
and `DELETE` on `/api/sessions/[id]` all call `auth()` — this endpoint loads any
session's stored prompt by id and forwards its content to a third-party LLM
(OpenRouter) for an unauthenticated caller. The consequences: (a) an
anonymous request can read a session's stored prompt and trigger paid inference
against our OpenRouter budget, and (b) AI inference endpoints MUST be
authenticated (STD-AI-SYSTEM-SECURITY 4.1), which this violates. It is step 3 of
the remediation roadmap's blocking Phase 1.

The fix is **authentication, not an ownership guard**. ADR-0005 established that
a session id is an unguessable `cuid` used as a capability URL: any signed-in
holder of the id may read and edit a session (`GET`/`PATCH` are intentionally
open, only `DELETE` is owner-gated). `llm-review` operates on the same session
settings, so it MUST follow the same contract — require a signed-in caller, but
do not gate on ownership, so invited collaborators can still run coaching.

## What Changes

- `POST /api/llm-review` gains an `auth()` gate as its first action: an
  unauthenticated request returns **401** with no session lookup and no
  OpenRouter call. Following ADR-0005, the handler authenticates the caller but
  MUST NOT gate on session ownership (invited collaborators may run coaching).
- The 401 check is ordered **before** body parsing and the session lookup, so an
  anonymous caller cannot probe session existence or reach the LLM provider.
- An AI security log event is emitted on rejected (401) requests via the Pino
  logger, satisfying the AI-006 requirement that AI security events be
  observable. No request content or secrets are logged.
- Unit tests assert the 401-when-unauthenticated path and that the existing
  authenticated contract (200 / 404 / 400 / 500 / 502) is unchanged, closing the
  TEST-001 coverage gap for the `llm-review` auth path.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `llm-review`: The `POST /api/llm-review` requirement adds an authentication
  precondition — unauthenticated → 401 (before any session lookup or LLM call);
  authenticated holder of the id → existing behaviour. No ownership gate,
  consistent with the `GET`/`PATCH` capability-URL contract.

## Impact

- **Code:** `src/app/api/llm-review/route.ts` — add `import { auth }` and a 401
  gate at the top of `POST`, ahead of `request.json()`.
- **Tests:** `src/app/api/llm-review/route.test.ts` — 401 when unauthenticated
  (no session lookup, no OpenRouter fetch); authenticated happy path and existing
  error contract preserved.
- **Behaviour:** Anonymous callers can no longer trigger inference or read stored
  prompts. Any signed-in user holding the session id (owner or invited
  collaborator) is unaffected.
- **Standards:** Closes ENG-002 and AI-006 (STD-AI-SYSTEM-SECURITY 4.1, 8;
  STD-ENTERPRISE-ACCESS-CONTROL 3.4). Aligns with ADR-0005 (capability-URL model).
- No new dependencies, no schema changes, no client-facing API shape change for
  authenticated callers.
