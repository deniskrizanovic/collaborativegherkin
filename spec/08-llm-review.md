# 8. LLM Review

The LLM review feature allows users to send the current session's Gherkin content to a large language model for critique and improvement suggestions. The model and prompt are shared across all users and persisted in the database.

---

## 8.1 Triggering a review

**Given** a user is on a session page  
**When** the user clicks "Get AI Coaching"  
**Then** the current Gherkin content is sent to the selected model via the OpenRouter gateway  
**And** the "Get AI Coaching" button is disabled and shows "Reviewing…" while the request is in flight  
**And** the model dropdown is disabled while the request is in flight

**Given** the LLM returns a response  
**When** the review completes  
**Then** the result is displayed in a modal  
**And** the result is rendered as Markdown  
**And** the modal header shows the name of the model that produced the result

**Given** the LLM request fails  
**When** the review completes with an error  
**Then** an error message is displayed in the modal  
**And** the button returns to its normal state

---

## 8.2 Dismissing the results modal

**Given** the results modal is open  
**When** the user presses Escape  
**Then** the modal closes

**Given** the results modal is open  
**When** the user clicks outside the modal inner panel  
**Then** the modal closes

**Given** the results modal is open  
**When** the user clicks the ✕ button  
**Then** the modal closes

---

## 8.3 Selecting a model

**Given** a user is on a session page  
**When** the page loads  
**Then** a model dropdown is shown alongside the "Get AI Coaching" button  
**And** the dropdown is pre-selected to the currently persisted model

**Given** the user changes the selected model in the dropdown  
**When** the selection changes  
**Then** the new model is persisted to the database immediately  
**And** the next review uses the newly selected model

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

**Given** a user is on a session page  
**When** the user clicks "Edit prompt"  
**Then** a modal opens containing a textarea pre-filled with the current prompt

**Given** the prompt edit modal is open  
**When** the user edits the textarea and clicks "Save"  
**Then** the new prompt is persisted to the database  
**And** the modal closes  
**And** the next review uses the updated prompt

**Given** the prompt edit modal is open  
**When** the user clicks "Cancel" or presses Escape or clicks outside the panel  
**Then** the modal closes without saving

**Given** the user has cleared the textarea or entered fewer than 10 characters  
**When** the prompt edit modal is open  
**Then** the "Save" button is disabled

**Given** no prompt setting exists in the database  
**When** the prompt edit modal is opened for the first time  
**Then** the textarea is pre-filled with the default prompt

---

## 8.5 API — GET /api/llm-settings

**Given** settings exist in the database  
**When** a GET request is made to `/api/llm-settings`  
**Then** a 200 response is returned containing `{ prompt, model, availableModels }`

**Given** a setting key is missing from the database  
**When** a GET request is made to `/api/llm-settings`  
**Then** the missing field is returned with its default value

**Given** a server error occurs  
**When** a GET request is made to `/api/llm-settings`  
**Then** a 500 response is returned

---

## 8.6 API — PUT /api/llm-settings

**Given** a valid body `{ prompt }` with at least 10 characters  
**When** a PUT request is made to `/api/llm-settings`  
**Then** the prompt is upserted in the database  
**And** a 200 response is returned with `{ ok: true }`

**Given** a valid body `{ model }` where model is one of the available model IDs  
**When** a PUT request is made to `/api/llm-settings`  
**Then** the model is upserted in the database  
**And** a 200 response is returned with `{ ok: true }`

**Given** the body contains a `model` value not in the allowed list  
**When** a PUT request is made to `/api/llm-settings`  
**Then** a 400 response is returned with validation errors

**Given** the body contains a `prompt` shorter than 10 characters  
**When** a PUT request is made to `/api/llm-settings`  
**Then** a 400 response is returned with validation errors

**Given** a server error occurs  
**When** a PUT request is made to `/api/llm-settings`  
**Then** a 500 response is returned

---

## 8.7 API — POST /api/llm-review

**Given** a valid body `{ content, model }` where model is in the allowed list  
**When** a POST request is made to `/api/llm-review`  
**Then** the current prompt is fetched from the database  
**And** a chat completion request is sent to OpenRouter with the prompt as the system message and the content as the user message  
**And** a 200 response is returned containing `{ result }` with the model's reply

**Given** the body contains a `model` not in the allowed list  
**When** a POST request is made to `/api/llm-review`  
**Then** a 400 response is returned with validation errors

**Given** the body contains an empty `content`  
**When** a POST request is made to `/api/llm-review`  
**Then** a 400 response is returned with validation errors

**Given** `OPENROUTER_API_KEY` is not set  
**When** a POST request is made to `/api/llm-review`  
**Then** a 500 response is returned with the message `"LLM service not configured"`

**Given** the OpenRouter request returns a non-2xx response  
**When** a POST request is made to `/api/llm-review`  
**Then** a 502 response is returned with the message `"LLM request failed"`

**Given** an unexpected error occurs  
**When** a POST request is made to `/api/llm-review`  
**Then** a 500 response is returned

---

## 8.8 Cached review result

**Given** a review has completed and the result modal has been closed  
**When** the user looks at the session header  
**Then** a "View last review" button is visible

**Given** the "View last review" button is visible  
**When** the user clicks it  
**Then** the result modal reopens showing the same result without a new API call

**Given** no review has been run yet  
**When** the user looks at the session header  
**Then** the "View last review" button is not visible

**Given** a review result is cached and a new review is triggered  
**When** the new review is in flight  
**Then** the cached result remains available via "View last review"

**Given** a new review completes  
**When** the result arrives  
**Then** the cached result is replaced with the new result
