# llm-review Specification

## Purpose

Sending a session's Gherkin content to a large language model for critique via
the OpenRouter gateway. The model and prompt are stored per-session as nullable
columns on the `Session` record; when unset the app falls back to the default
constants in `src/lib/llm-constants.ts`.

## Requirements

### Requirement: Triggering a review

Clicking "Get AI Coaching" SHALL send the current Gherkin content to the
resolved model via OpenRouter. While the request is in flight the button MUST
be disabled and show "Reviewing…" and the model dropdown MUST be disabled. A
successful response MUST be displayed as Markdown in a modal whose header shows
the model name; a failure MUST display an error in the modal and reset the
button.

#### Scenario: Clicking Get AI Coaching sends content and disables controls
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts) — modal opens · button disabled in flight
- **WHEN** a user on a session page clicks "Get AI Coaching"
- **THEN** the current Gherkin content is sent to the resolved model via the OpenRouter gateway
- **AND** the "Get AI Coaching" button is disabled and shows "Reviewing…" while the request is in flight
- **AND** the model dropdown is disabled while the request is in flight

#### Scenario: Successful LLM response displayed as Markdown in modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts) — header shows model name · Markdown rendered
- **WHEN** the LLM returns a response and the review completes
- **THEN** the result is displayed in a modal, rendered as Markdown
- **AND** the modal header shows the name of the model that produced the result

#### Scenario: LLM failure shows error in modal and resets button
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the LLM request fails and the review completes with an error
- **THEN** an error message is displayed in the modal
- **AND** the button returns to its normal state

### Requirement: Dismissing the results modal

The results modal SHALL close on Escape, on a click outside the inner panel, or
on clicking the ✕ button.

#### Scenario: Escape closes results modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the results modal is open and the user presses Escape
- **THEN** the modal closes

#### Scenario: Clicking outside panel closes results modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the results modal is open and the user clicks outside the modal inner panel
- **THEN** the modal closes

#### Scenario: X button closes results modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the results modal is open and the user clicks the ✕ button
- **THEN** the modal closes

### Requirement: Selecting a model

A model dropdown SHALL be shown alongside the "Get AI Coaching" button,
pre-selected to the session's stored model or the default when none is set.
Changing the selection MUST persist the new model to the session immediately so
the next review uses it. When no model is stored the dropdown MUST default to
`openrouter/free`.

#### Scenario: Model dropdown shown pre-selected to session model or default
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts) — button and dropdown visible · expected models listed
- **WHEN** a user is on a session page and the page loads
- **THEN** a model dropdown is shown alongside the "Get AI Coaching" button
- **AND** the dropdown is pre-selected to the session's stored model, or the default model if none is set

#### Scenario: Changing model persists to session immediately
> **Tests:** none
- **WHEN** the user changes the selected model in the dropdown
- **THEN** the new model is saved to the session record immediately
- **AND** the next review uses the newly selected model

#### Scenario: No model set on session defaults to openrouter/free
> **Tests:** none
- **WHEN** no model is stored on the session and the page loads
- **THEN** the dropdown defaults to `openrouter/free`

### Requirement: Editing the review prompt

An "Edit prompt" button SHALL open a modal with a textarea pre-filled with the
current prompt (or the default when none is stored). Saving MUST persist the new
prompt to the session and close the modal so the next review uses it; the Save
button MUST be disabled when the textarea has fewer than 10 characters. Cancel,
Escape, or an outside click MUST close the modal without saving.

#### Scenario: Edit prompt button opens modal with pre-filled textarea
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts) — button visible · modal opens with pre-filled textarea
- **WHEN** a user on a session page clicks "Edit prompt"
- **THEN** a modal opens containing a textarea pre-filled with the current prompt

#### Scenario: Saving new prompt persists to session and closes modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the prompt edit modal is open and the user edits the textarea and clicks "Save"
- **THEN** the new prompt is saved to the session record
- **AND** the modal closes
- **AND** the next review in this session uses the updated prompt

#### Scenario: Cancel, Escape, or outside click closes prompt modal without saving
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts) — Cancel · Escape · click outside
- **WHEN** the prompt edit modal is open and the user clicks "Cancel", presses Escape, or clicks outside the panel
- **THEN** the modal closes without saving

#### Scenario: Save disabled when textarea has fewer than 10 chars
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the prompt edit modal is open and the textarea has fewer than 10 characters
- **THEN** the "Save" button is disabled

#### Scenario: No prompt set on session prefills textarea with default
> **Tests:** none
- **WHEN** no prompt is stored on the session and the prompt edit modal is opened
- **THEN** the textarea is pre-filled with the default prompt

### Requirement: POST /api/llm-review

`POST /api/llm-review` SHALL accept a body `{ content, sessionId }`, resolve the
prompt and model from the session record (falling back to defaults), and send a
chat completion to OpenRouter with the resolved prompt as the system message and
the content as the user message, returning 200 with `{ result }`. Error
handling: unknown `sessionId` → 404; stale stored model → 400; empty `content`
→ 400 with validation errors; missing `OPENROUTER_API_KEY` → 500 with
`"LLM service not configured"`; non-2xx from OpenRouter → 502 with
`"LLM request failed"`; unexpected error → 500.

#### Scenario: Valid request resolves session prompt and model and returns 200
> **Tests:** none
- **WHEN** a POST request with a valid body `{ content, sessionId }` is made to `/api/llm-review`
- **THEN** the prompt and model are resolved from the session record, falling back to defaults if not set
- **AND** a chat completion request is sent to OpenRouter with the resolved prompt as the system message and the content as the user message
- **AND** a 200 response is returned containing `{ result }` with the model's reply

#### Scenario: Session not found returns 404
> **Tests:** none
- **WHEN** a POST request whose body contains a `sessionId` matching no session is made to `/api/llm-review`
- **THEN** a 404 response is returned

#### Scenario: Stale model stored on session returns 400
> **Tests:** none
- **WHEN** a POST request is made to `/api/llm-review` and the session's stored model is no longer in the available models list
- **THEN** a 400 response is returned

#### Scenario: Empty content returns 400
> **Tests:** none
- **WHEN** a POST request with an empty `content` is made to `/api/llm-review`
- **THEN** a 400 response is returned with validation errors

#### Scenario: Missing API key returns 500
> **Tests:** none
- **WHEN** a POST request is made to `/api/llm-review` and `OPENROUTER_API_KEY` is not set
- **THEN** a 500 response is returned with the message `"LLM service not configured"`

#### Scenario: Non-2xx from OpenRouter returns 502
> **Tests:** none
- **WHEN** the OpenRouter request returns a non-2xx response for a POST to `/api/llm-review`
- **THEN** a 502 response is returned with the message `"LLM request failed"`

#### Scenario: Unexpected error returns 500
> **Tests:** none
- **WHEN** an unexpected error occurs during a POST request to `/api/llm-review`
- **THEN** a 500 response is returned

### Requirement: Coaching fields via PATCH /api/sessions/[id]

The session's `prompt` and `model` coaching fields SHALL be updated via the
standard session PATCH endpoint. A valid `{ prompt }` (at least 10 characters)
or `{ model }` (an available model ID) MUST save and return 200 with
`{ ok: true }`. A model not in the allowed list MUST return 400; a prompt
shorter than 10 characters MUST return 400 with validation errors.

#### Scenario: Valid prompt body saves to session and returns 200
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 200 when prompt is updated
- **WHEN** a PATCH request with a valid body `{ prompt }` of at least 10 characters is made to `/api/sessions/[id]`
- **THEN** the prompt is saved to the session record
- **AND** a 200 response is returned with `{ ok: true }`

#### Scenario: Valid model body saves to session and returns 200
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 200 when model is updated
- **WHEN** a PATCH request with a valid body `{ model }` where model is an available model ID is made to `/api/sessions/[id]`
- **THEN** the model is saved to the session record
- **AND** a 200 response is returned with `{ ok: true }`

#### Scenario: Unknown model returns 400
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 400 when model is not in AVAILABLE_MODELS
- **WHEN** a PATCH request whose body contains a `model` value not in the allowed list is made to `/api/sessions/[id]`
- **THEN** a 400 response is returned with validation errors

#### Scenario: Prompt shorter than 10 chars returns 400
> **Tests:** [`src/app/api/sessions/[id]/route.test.ts`](../../../src/app/api/sessions/[id]/route.test.ts) — PATCH returns 400 when prompt is too short
- **WHEN** a PATCH request whose body contains a `prompt` shorter than 10 characters is made to `/api/sessions/[id]`
- **THEN** a 400 response is returned with validation errors

### Requirement: Cached review result

A "View last review" button SHALL be visible in the session header after a
review completes and its modal is closed, reopening the modal with the same
result without a new API call. The button MUST be absent before the first
review. While a new review is in flight the cached result MUST remain
available; when the new review completes it MUST replace the cached result.

#### Scenario: View last review button visible after review is closed
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** a review has completed, the result modal has been closed, and the user looks at the session header
- **THEN** a "View last review" button is visible

#### Scenario: View last review reopens modal without new API call
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** the "View last review" button is visible and the user clicks it
- **THEN** the result modal reopens showing the same result without a new API call

#### Scenario: View last review button absent before first review
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** no review has been run yet and the user looks at the session header
- **THEN** the "View last review" button is not visible

#### Scenario: Cached result remains available while new review in flight
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** a review result is cached and a new review is triggered and in flight
- **THEN** the cached result remains available via "View last review"

#### Scenario: New review result replaces cached result
> **Tests:** [`e2e/llm-review.spec.ts`](../../../e2e/llm-review.spec.ts)
- **WHEN** a new review completes and the result arrives
- **THEN** the cached result is replaced with the new result
