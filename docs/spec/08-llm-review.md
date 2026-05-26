# 8. LLM Review

The LLM review feature allows users to send the current session's Gherkin content to a large language model for critique and improvement suggestions. The model and prompt are stored per-session as nullable columns on the `Session` record. If no value is set for a session, the app falls back to the default model and prompt constants in `src/lib/llm-constants.ts`.

---

## 8.1 Triggering a review

#### SC-8.1.1 Clicking Get AI Coaching sends content and disables controls
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — modal opens · button disabled in flight

**Given** a user is on a session page  
**When** the user clicks "Get AI Coaching"  
**Then** the current Gherkin content is sent to the resolved model via the OpenRouter gateway  
**And** the "Get AI Coaching" button is disabled and shows "Reviewing…" while the request is in flight  
**And** the model dropdown is disabled while the request is in flight

#### SC-8.1.2 Successful LLM response displayed as Markdown in modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — header shows model name · Markdown rendered

**Given** the LLM returns a response  
**When** the review completes  
**Then** the result is displayed in a modal  
**And** the result is rendered as Markdown  
**And** the modal header shows the name of the model that produced the result

#### SC-8.1.3 LLM failure shows error in modal and resets button
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the LLM request fails  
**When** the review completes with an error  
**Then** an error message is displayed in the modal  
**And** the button returns to its normal state

---

## 8.2 Dismissing the results modal

#### SC-8.2.1 Escape closes results modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the results modal is open  
**When** the user presses Escape  
**Then** the modal closes

#### SC-8.2.2 Clicking outside panel closes results modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the results modal is open  
**When** the user clicks outside the modal inner panel  
**Then** the modal closes

#### SC-8.2.3 X button closes results modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the results modal is open  
**When** the user clicks the ✕ button  
**Then** the modal closes

---

## 8.3 Selecting a model

#### SC-8.3.1 Model dropdown shown pre-selected to session model or default
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — button and dropdown visible · expected models listed

**Given** a user is on a session page  
**When** the page loads  
**Then** a model dropdown is shown alongside the "Get AI Coaching" button  
**And** the dropdown is pre-selected to the session's stored model, or the default model if none is set

#### SC-8.3.2 Changing model persists to session immediately
> **Tests:** none

**Given** the user changes the selected model in the dropdown  
**When** the selection changes  
**Then** the new model is saved to the session record immediately  
**And** the next review uses the newly selected model

#### SC-8.3.3 No model set on session defaults to `openrouter/free`
> **Tests:** none

**Given** no model is stored on the session  
**When** the page loads  
**Then** the dropdown defaults to `openrouter/free`

The set of available models is:

| Model ID                                    |
|---------------------------------------------|
| `openrouter/free`                           |
| `meta-llama/llama-3.2-3b-instruct:free`     |
| `deepseek/deepseek-v4-flash:free`           |
| `google/gemma-4-31b-it:free`                |
| `google/gemma-4-26b-a4b-it:free`            |
| `minimax/minimax-m2.5:free`                 |
| `nvidia/nemotron-3-super:free`              |
| `deepseek/deepseek-r1:free`                 |
| `openai/gpt-oss-120b:free`                  |

---

## 8.4 Editing the review prompt

#### SC-8.4.1 Edit prompt button opens modal with pre-filled textarea
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — button visible · modal opens with pre-filled textarea

**Given** a user is on a session page  
**When** the user clicks "Edit prompt"  
**Then** a modal opens containing a textarea pre-filled with the current prompt

#### SC-8.4.2 Saving new prompt persists to session and closes modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the prompt edit modal is open  
**When** the user edits the textarea and clicks "Save"  
**Then** the new prompt is saved to the session record  
**And** the modal closes  
**And** the next review in this session uses the updated prompt

#### SC-8.4.3 Cancel, Escape, or outside click closes prompt modal without saving
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — Cancel · Escape · click outside

**Given** the prompt edit modal is open  
**When** the user clicks "Cancel" or presses Escape or clicks outside the panel  
**Then** the modal closes without saving

#### SC-8.4.4 Save disabled when textarea has fewer than 10 chars
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the user has cleared the textarea or entered fewer than 10 characters  
**When** the prompt edit modal is open  
**Then** the "Save" button is disabled

#### SC-8.4.5 No prompt set on session prefills textarea with default
> **Tests:** none

**Given** no prompt is stored on the session  
**When** the prompt edit modal is opened  
**Then** the textarea is pre-filled with the default prompt

---

## 8.5 API — POST /api/llm-review

#### SC-8.5.1 Valid request resolves session prompt and model and returns 200
> **Tests:** none

**Given** a valid body `{ content, sessionId }`  
**When** a POST request is made to `/api/llm-review`  
**Then** the prompt and model are resolved from the session record, falling back to defaults if not set  
**And** a chat completion request is sent to OpenRouter with the resolved prompt as the system message and the content as the user message  
**And** a 200 response is returned containing `{ result }` with the model's reply

#### SC-8.5.2 Session not found returns 404
> **Tests:** none

**Given** the body contains a `sessionId` that does not match any session  
**When** a POST request is made to `/api/llm-review`  
**Then** a 404 response is returned

#### SC-8.5.3 Stale model stored on session returns 400
> **Tests:** none

**Given** the session's stored model is no longer in the available models list  
**When** a POST request is made to `/api/llm-review`  
**Then** a 400 response is returned

#### SC-8.5.4 Empty content returns 400
> **Tests:** none

**Given** the body contains an empty `content`  
**When** a POST request is made to `/api/llm-review`  
**Then** a 400 response is returned with validation errors

#### SC-8.5.5 Missing API key returns 500
> **Tests:** none

**Given** `OPENROUTER_API_KEY` is not set  
**When** a POST request is made to `/api/llm-review`  
**Then** a 500 response is returned with the message `"LLM service not configured"`

#### SC-8.5.6 Non-2xx from OpenRouter returns 502
> **Tests:** none

**Given** the OpenRouter request returns a non-2xx response  
**When** a POST request is made to `/api/llm-review`  
**Then** a 502 response is returned with the message `"LLM request failed"`

#### SC-8.5.7 Unexpected error returns 500
> **Tests:** none

**Given** an unexpected error occurs  
**When** a POST request is made to `/api/llm-review`  
**Then** a 500 response is returned

---

## 8.6 API — PATCH /api/sessions/[id] (coaching fields)

The session's `prompt` and `model` are updated via the standard session PATCH endpoint.

#### SC-8.6.1 Valid prompt body saves to session and returns 200
> **Tests:** none

**Given** a valid body `{ prompt }` with at least 10 characters  
**When** a PATCH request is made to `/api/sessions/[id]`  
**Then** the prompt is saved to the session record  
**And** a 200 response is returned with `{ ok: true }`

#### SC-8.6.2 Valid model body saves to session and returns 200
> **Tests:** none

**Given** a valid body `{ model }` where model is one of the available model IDs  
**When** a PATCH request is made to `/api/sessions/[id]`  
**Then** the model is saved to the session record  
**And** a 200 response is returned with `{ ok: true }`

#### SC-8.6.3 Unknown model returns 400
> **Tests:** none

**Given** the body contains a `model` value not in the allowed list  
**When** a PATCH request is made to `/api/sessions/[id]`  
**Then** a 400 response is returned with validation errors

#### SC-8.6.4 Prompt shorter than 10 chars returns 400
> **Tests:** none

**Given** the body contains a `prompt` shorter than 10 characters  
**When** a PATCH request is made to `/api/sessions/[id]`  
**Then** a 400 response is returned with validation errors

---

## 8.7 Cached review result

#### SC-8.7.1 View last review button visible after review is closed
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** a review has completed and the result modal has been closed  
**When** the user looks at the session header  
**Then** a "View last review" button is visible

#### SC-8.7.2 View last review reopens modal without new API call
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the "View last review" button is visible  
**When** the user clicks it  
**Then** the result modal reopens showing the same result without a new API call

#### SC-8.7.3 View last review button absent before first review
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** no review has been run yet  
**When** the user looks at the session header  
**Then** the "View last review" button is not visible

#### SC-8.7.4 Cached result remains available while new review in flight
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** a review result is cached and a new review is triggered  
**When** the new review is in flight  
**Then** the cached result remains available via "View last review"

#### SC-8.7.5 New review result replaces cached result
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** a new review completes  
**When** the result arrives  
**Then** the cached result is replaced with the new result
