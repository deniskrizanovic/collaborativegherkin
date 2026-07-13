## MODIFIED Requirements

### Requirement: POST /api/llm-review

`POST /api/llm-review` SHALL require an authenticated caller. The handler MUST
call `auth()` as its first action, before parsing the body or looking up the
session, and MUST return **401** with no session lookup and no OpenRouter call
when the caller is unauthenticated. Following the capability-URL model in
ADR-0005, the handler MUST NOT gate on session ownership: any signed-in caller
holding the session id (owner or invited collaborator) may run a review. A
rejected (401) request MUST emit an AI security log event via the Pino logger
without logging request content or secrets.

For an authenticated caller, the endpoint SHALL accept a body
`{ content, sessionId }`, resolve the prompt and model from the session record
(falling back to defaults), and send a chat completion to OpenRouter with the
resolved prompt as the system message and the content as the user message,
returning 200 with `{ result }`. Error handling: unauthenticated → 401 (checked
first); unknown `sessionId` → 404; stale stored model → 400; empty `content` →
400 with validation errors; missing `OPENROUTER_API_KEY` → 500 with
`"LLM service not configured"`; non-2xx from OpenRouter → 502 with
`"LLM request failed"`; unexpected error → 500.

#### Scenario: Unauthenticated request is rejected before any session lookup
> **Tests:** [`src/app/api/llm-review/route.test.ts`](../../../../../src/app/api/llm-review/route.test.ts) — POST returns 401 when unauthenticated, no session lookup or OpenRouter call
- **GIVEN** a caller with no authenticated session
- **WHEN** a POST request is made to `/api/llm-review` with any body
- **THEN** a 401 response is returned
- **AND** no session record is loaded and no request is sent to OpenRouter
- **AND** an AI security log event is emitted without request content or secrets

#### Scenario: Any authenticated holder of the id runs a review and returns 200
> **Tests:** [`src/app/api/llm-review/route.test.ts`](../../../../../src/app/api/llm-review/route.test.ts) — POST returns 200 for an authenticated caller regardless of session ownership
- **GIVEN** an authenticated caller and a valid body `{ content, sessionId }` for an existing session
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** the prompt and model are resolved from the session record, falling back to defaults if not set
- **AND** a chat completion request is sent to OpenRouter with the resolved prompt as the system message and the content as the user message
- **AND** a 200 response is returned containing `{ result }` with the model's reply, regardless of whether the caller is the session's creator

#### Scenario: Session not found returns 404
> **Tests:** [`src/app/api/llm-review/route.test.ts`](../../../../../src/app/api/llm-review/route.test.ts) — POST returns 404 for an authenticated caller when session is unknown
- **GIVEN** an authenticated caller and a body containing a `sessionId` that does not match any session
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** a 404 response is returned

#### Scenario: Stale model stored on session returns 400
> **Tests:** none — pre-existing behavior outside this change's auth scope; no test yet exercises the stored-model-no-longer-available branch. Tracked for future coverage.
- **GIVEN** an authenticated caller and a session whose stored model is no longer in the available models list
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** a 400 response is returned

#### Scenario: Empty content returns 400
> **Tests:** [`src/app/api/llm-review/route.test.ts`](../../../../../src/app/api/llm-review/route.test.ts) — POST returns 400 for an authenticated caller with empty content
- **GIVEN** an authenticated caller and a body containing an empty `content`
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** a 400 response is returned with validation errors

#### Scenario: Missing API key returns 500
> **Tests:** [`src/app/api/llm-review/route.test.ts`](../../../../../src/app/api/llm-review/route.test.ts) — returns 500 with `"LLM service not configured"` when the service throws `CoachingConfigError`
- **GIVEN** an authenticated caller and `OPENROUTER_API_KEY` is not set
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** a 500 response is returned with the message `"LLM service not configured"`

#### Scenario: Non-2xx from OpenRouter returns 502
> **Tests:** [`src/app/api/llm-review/route.test.ts`](../../../../../src/app/api/llm-review/route.test.ts) — returns 502 when the service throws `CoachingRequestError`
- **GIVEN** an authenticated caller and the OpenRouter request returns a non-2xx response
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** a 502 response is returned with the message `"LLM request failed"`

#### Scenario: Unexpected error returns 500
> **Tests:** none — generic catch-all fallback outside this change's auth scope; the specific error branches (config, request, rate-limit) are covered, so this default path has no dedicated test yet. Tracked for future coverage.
- **GIVEN** an authenticated caller and an unexpected error occurs
- **WHEN** a POST request is made to `/api/llm-review`
- **THEN** a 500 response is returned
