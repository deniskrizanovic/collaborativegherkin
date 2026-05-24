# 8. LLM Review

The LLM review feature allows users to send the current session's Gherkin content to a large language model for critique and improvement suggestions. The model and prompt are shared across all users and persisted in the database.

---

## 8.1 Triggering a review

#### SC-8.1.1 Clicking Get AI Coaching sends content and disables controls
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — modal opens · button disabled in flight

**Given** a user is on a session page  
**When** the user clicks "Get AI Coaching"  
**Then** the current Gherkin content is sent to the selected model via the OpenRouter gateway  
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

#### SC-8.3.1 Model dropdown shown pre-selected to persisted model
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — button and dropdown visible · expected models listed

**Given** a user is on a session page  
**When** the page loads  
**Then** a model dropdown is shown alongside the "Get AI Coaching" button  
**And** the dropdown is pre-selected to the currently persisted model

#### SC-8.3.2 Changing model persists immediately
> **Tests:** none

**Given** the user changes the selected model in the dropdown  
**When** the selection changes  
**Then** the new model is persisted to the database immediately  
**And** the next review uses the newly selected model

#### SC-8.3.3 No model setting defaults to llama-3.2-3b
> **Tests:** none

**Given** no model setting exists in the database  
**When** the page loads  
**Then** the dropdown defaults to `meta-llama/llama-3.2-3b-instruct:free`

The set of available models is:

| Model ID                                    |
|---------------------------------------------|
| `meta-llama/llama-3.2-3b-instruct:free`     |
| `deepseek/deepseek-v4-flash:free`           |
| `google/gemma-4-31b-it:free`                |
| `google/gemma-4-26b-a4b-it:free`            |

---

## 8.4 Editing the review prompt

#### SC-8.4.1 Edit prompt button opens modal with pre-filled textarea
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts) — button visible · modal opens with pre-filled textarea

**Given** a user is on a session page  
**When** the user clicks "Edit prompt"  
**Then** a modal opens containing a textarea pre-filled with the current prompt

#### SC-8.4.2 Saving new prompt persists it and closes modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the prompt edit modal is open  
**When** the user edits the textarea and clicks "Save"  
**Then** the new prompt is persisted to the database  
**And** the modal closes  
**And** the next review uses the updated prompt

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

#### SC-8.4.5 No prompt in DB prefills textarea with default on first open
> **Tests:** none

**Given** no prompt setting exists in the database  
**When** the prompt edit modal is opened for the first time  
**Then** the textarea is pre-filled with the default prompt

---

## 8.5 API — GET /api/llm-settings

#### SC-8.5.1 Settings exist returns 200 with prompt, model, availableModels
> **Tests:** none

**Given** settings exist in the database  
**When** a GET request is made to `/api/llm-settings`  
**Then** a 200 response is returned containing `{ prompt, model, availableModels }`

#### SC-8.5.2 Missing key returns field with default value
> **Tests:** none

**Given** a setting key is missing from the database  
**When** a GET request is made to `/api/llm-settings`  
**Then** the missing field is returned with its default value

#### SC-8.5.3 Server error returns 500
> **Tests:** none

**Given** a server error occurs  
**When** a GET request is made to `/api/llm-settings`  
**Then** a 500 response is returned

---

## 8.6 API — PUT /api/llm-settings

#### SC-8.6.1 Valid prompt body upserts and returns 200
> **Tests:** none

**Given** a valid body `{ prompt }` with at least 10 characters  
**When** a PUT request is made to `/api/llm-settings`  
**Then** the prompt is upserted in the database  
**And** a 200 response is returned with `{ ok: true }`

#### SC-8.6.2 Valid model body upserts and returns 200
> **Tests:** none

**Given** a valid body `{ model }` where model is one of the available model IDs  
**When** a PUT request is made to `/api/llm-settings`  
**Then** the model is upserted in the database  
**And** a 200 response is returned with `{ ok: true }`

#### SC-8.6.3 Unknown model returns 400
> **Tests:** none

**Given** the body contains a `model` value not in the allowed list  
**When** a PUT request is made to `/api/llm-settings`  
**Then** a 400 response is returned with validation errors

#### SC-8.6.4 Prompt shorter than 10 chars returns 400
> **Tests:** none

**Given** the body contains a `prompt` shorter than 10 characters  
**When** a PUT request is made to `/api/llm-settings`  
**Then** a 400 response is returned with validation errors

#### SC-8.6.5 Server error returns 500
> **Tests:** none

**Given** a server error occurs  
**When** a PUT request is made to `/api/llm-settings`  
**Then** a 500 response is returned

---

## 8.7 API — POST /api/llm-review

#### SC-8.7.1 Valid request proxies to OpenRouter and returns 200
> **Tests:** none

**Given** a valid body `{ content, model }` where model is in the allowed list  
**When** a POST request is made to `/api/llm-review`  
**Then** the current prompt is fetched from the database  
**And** a chat completion request is sent to OpenRouter with the prompt as the system message and the content as the user message  
**And** a 200 response is returned containing `{ result }` with the model's reply

#### SC-8.7.2 Unknown model returns 400
> **Tests:** none

**Given** the body contains a `model` not in the allowed list  
**When** a POST request is made to `/api/llm-review`  
**Then** a 400 response is returned with validation errors

#### SC-8.7.3 Empty content returns 400
> **Tests:** none

**Given** the body contains an empty `content`  
**When** a POST request is made to `/api/llm-review`  
**Then** a 400 response is returned with validation errors

#### SC-8.7.4 Missing API key returns 500
> **Tests:** none

**Given** `OPENROUTER_API_KEY` is not set  
**When** a POST request is made to `/api/llm-review`  
**Then** a 500 response is returned with the message `"LLM service not configured"`

#### SC-8.7.5 Non-2xx from OpenRouter returns 502
> **Tests:** none

**Given** the OpenRouter request returns a non-2xx response  
**When** a POST request is made to `/api/llm-review`  
**Then** a 502 response is returned with the message `"LLM request failed"`

#### SC-8.7.6 Unexpected error returns 500
> **Tests:** none

**Given** an unexpected error occurs  
**When** a POST request is made to `/api/llm-review`  
**Then** a 500 response is returned

---

## 8.8 Cached review result

#### SC-8.8.1 View last review button visible after review is closed
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** a review has completed and the result modal has been closed  
**When** the user looks at the session header  
**Then** a "View last review" button is visible

#### SC-8.8.2 View last review reopens modal without new API call
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** the "View last review" button is visible  
**When** the user clicks it  
**Then** the result modal reopens showing the same result without a new API call

#### SC-8.8.3 View last review button absent before first review
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** no review has been run yet  
**When** the user looks at the session header  
**Then** the "View last review" button is not visible

#### SC-8.8.4 Cached result remains available while new review in flight
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** a review result is cached and a new review is triggered  
**When** the new review is in flight  
**Then** the cached result remains available via "View last review"

#### SC-8.8.5 New review result replaces cached result
> **Tests:** [`e2e/llm-review.spec.ts`](../../e2e/llm-review.spec.ts)

**Given** a new review completes  
**When** the result arrives  
**Then** the cached result is replaced with the new result
