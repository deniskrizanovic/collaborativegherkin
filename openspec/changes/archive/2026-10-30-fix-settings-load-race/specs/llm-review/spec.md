## MODIFIED Requirements

### Requirement: Selecting a model

A model dropdown SHALL be shown alongside the "Get AI Coaching" button,
pre-selected to the session's stored model or the default when none is set.
Changing the selection MUST persist the new model to the session immediately so
the next review uses it. When no model is stored the dropdown MUST default to
`openrouter/free`. The dropdown MUST stay disabled until the session's settings
have finished loading, whether the load succeeds or fails, so the initial load
can never overwrite a model the user has picked.

#### Scenario: Model dropdown shown pre-selected to session model or default
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot) — button and dropdown visible · expected models listed
- **GIVEN** a user is on a session page
- **WHEN** the page loads
- **THEN** a model dropdown is shown alongside the "Get AI Coaching" button
- **AND** the dropdown is pre-selected to the session's stored model, or the default model if none is set

#### Scenario: Changing model persists to session immediately
> **Tests:** none
- **GIVEN** the user changes the selected model in the dropdown
- **WHEN** the selection changes
- **THEN** the new model is saved to the session record immediately
- **AND** the next review uses the newly selected model

#### Scenario: No model set on session defaults to openrouter/free
> **Tests:** none
- **GIVEN** no model is stored on the session
- **WHEN** the page loads
- **THEN** the dropdown defaults to `openrouter/free`

#### Scenario: Model dropdown is disabled until session settings have loaded
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot) — controls disabled while settings load is pending
- **GIVEN** a user has opened a session page and its settings have not finished loading
- **WHEN** the user looks at the model dropdown
- **THEN** the dropdown is disabled
- **AND** it becomes enabled, showing the session's stored model, once the settings have loaded

### Requirement: Editing the review prompt

An "Edit prompt" button SHALL open a modal with a textarea pre-filled with the
current prompt (or the default when none is stored). Saving MUST persist the new
prompt to the session and close the modal so the next review uses it; the Save
button MUST be disabled when the textarea has fewer than 10 characters. Cancel,
Escape, or an outside click MUST close the modal without saving. The "Edit
prompt" button MUST stay disabled until the session's settings have finished
loading, so the initial load can never overwrite a prompt the user is editing.
If the settings fail to load, the button MUST become enabled with the default
prompt pre-filled, and the settings error banner MUST be shown.

#### Scenario: Edit prompt button opens modal with pre-filled textarea
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot) — button visible · modal opens with pre-filled textarea
- **GIVEN** a user is on a session page
- **WHEN** the user clicks "Edit prompt"
- **THEN** a modal opens containing a textarea pre-filled with the current prompt

#### Scenario: Saving new prompt persists to session and closes modal
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot)
- **GIVEN** the prompt edit modal is open
- **WHEN** the user edits the textarea and clicks "Save"
- **THEN** the new prompt is saved to the session record
- **AND** the modal closes
- **AND** the next review in this session uses the updated prompt

#### Scenario: Cancel, Escape, or outside click closes prompt modal without saving
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot) — Cancel · Escape · click outside
- **GIVEN** the prompt edit modal is open
- **WHEN** the user clicks "Cancel" or presses Escape or clicks outside the panel
- **THEN** the modal closes without saving

#### Scenario: Save disabled when textarea has fewer than 10 chars
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot)
- **GIVEN** the user has cleared the textarea or entered fewer than 10 characters
- **WHEN** the prompt edit modal is open
- **THEN** the "Save" button is disabled

#### Scenario: No prompt set on session prefills textarea with default
> **Tests:** none
- **GIVEN** no prompt is stored on the session
- **WHEN** the prompt edit modal is opened
- **THEN** the textarea is pre-filled with the default prompt

#### Scenario: A prompt edited after a slow settings load is the one saved
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot)
- **GIVEN** a user has opened a session page and its settings are slow to load
- **WHEN** the settings finish loading and the user then edits the prompt and saves it
- **THEN** "Edit prompt" was disabled until the settings had loaded
- **AND** reopening the prompt after a reload shows the user's edited prompt, not the default

#### Scenario: Failed settings load leaves the default prompt editable
> **Tests:** [`e2e/llm-review.spec.ts`](../../../../../e2e/llm-review.spec.ts) · [`robot/suites/llm_review.robot`](../../../../../robot/suites/llm_review.robot)
- **GIVEN** a user has opened a session page and its settings fail to load
- **WHEN** the user clicks "Edit prompt"
- **THEN** the "Couldn't load this session's AI settings." banner is shown
- **AND** the prompt modal opens with the default prompt pre-filled
