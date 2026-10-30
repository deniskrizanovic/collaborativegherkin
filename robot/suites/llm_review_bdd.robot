*** Settings ***
Documentation       Business-language twin of llm_review.robot: spec §8 AI
...                 coaching review (openspec/specs/llm-review/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/llm_review.resource.
...                 /api/llm-review is always mocked. The review text, the
...                 typed document, the prompts and the expected Markdown are
...                 test data below. SC-8.4.2 is excluded: its line "the next
...                 review in this session uses the updated prompt" happens on
...                 the server and cannot be seen from the browser. Technical
...                 variants with no matching spec line ("expected models
...                 listed", "button visible") stay in llm_review.robot.

Resource            ../resources/common.resource
Resource            ../resources/steps/llm_review.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    llm-review


*** Variables ***
&{REVIEW_DOCUMENT}      feature=Coaching    scenario=Ask for feedback    given=a written scenario
...                     when=the user asks for a review    then=feedback is shown
# "\#" escapes the leading "#", which would otherwise start a Robot comment.
${MARKDOWN_REVIEW}      \## Feedback\n\n- Step 1 is ambiguous.\n- Consider adding an edge case.
@{RENDERED_REVIEW}      h2: Feedback    li: Step 1 is ambiguous.    li: Consider adding an edge case.
${LLM_ERROR}            LLM request failed
# Typed over the prompt and never saved. Not named EDITED_PROMPT: that is the
# test variable the Given step sets.
${UNSAVED_PROMPT}       Changed prompt text that is long enough
${NINE_CHARACTERS}      123456789
${NEW_PROMPT}           You are a patient BDD coach. Explain every suggestion.
# Plain text, so each result is shown in the modal exactly as written.
@{TWO_REVIEWS}          First result content    Second result content
# Stored AI settings, so the pre-selected / pre-filled checks run on a stored
# value and not only on the default. The model is AVAILABLE_MODELS[1] of
# src/lib/llm-constants.ts, which is not the default.
&{STORED_MODEL_SETTINGS}     model=meta-llama/llama-3.2-3b-instruct:free
&{STORED_PROMPT_SETTINGS}    prompt=You are a strict reviewer. Flag every vague step.


*** Test Cases ***
SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — content sent
    Given a user is on a session page with ${REVIEW_DOCUMENT}
    When the user clicks "Get AI Coaching"
    Then the current Gherkin content is sent to the resolved model via the OpenRouter gateway

SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — controls disabled in flight
    Given a user is on a session page
    When the user clicks "Get AI Coaching"
    Then the "Get AI Coaching" button is disabled and shows "Reviewing…" while the request is in flight
    And the model dropdown is disabled while the request is in flight

SC-8.1.2: Successful LLM response displayed as Markdown in modal — Markdown rendered
    Given the LLM returns a response with ${MARKDOWN_REVIEW}
    When the review completes
    Then the result is displayed in a modal
    And the result is rendered as Markdown — ${RENDERED_REVIEW}

SC-8.1.2: Successful LLM response displayed as Markdown in modal — header shows model name
    Given the LLM returns a response with ${MARKDOWN_REVIEW}
    When the review completes
    Then the result is displayed in a modal
    And the modal header shows the name of the model that produced the result

SC-8.1.3: LLM failure shows error in modal and resets button
    Given the LLM request fails with ${LLM_ERROR}
    When the review completes with an error
    Then an error message is displayed in the modal
    And the button returns to its normal state

SC-8.2.1: Escape closes results modal
    Given the results modal is open
    When the user presses Escape
    Then the modal closes

SC-8.2.2: Clicking outside panel closes results modal
    Given the results modal is open
    When the user clicks outside the modal inner panel
    Then the modal closes

SC-8.2.3: X button closes results modal
    Given the results modal is open
    When the user clicks the ✕ button
    Then the modal closes

SC-8.3.1: Model dropdown shown pre-selected to session model or default — no stored model
    Given a user is on a session page
    When the page loads
    Then a model dropdown is shown alongside the "Get AI Coaching" button
    And the dropdown is pre-selected to the session's stored model, or the default model if none is set

SC-8.3.1: Model dropdown shown pre-selected to session model or default — stored model
    Given a user is on a session page whose AI settings are stored with ${STORED_MODEL_SETTINGS}
    When the page loads
    Then the dropdown is pre-selected to the session's stored model, or the default model if none is set

SC-8.3.4: Model dropdown is disabled until session settings have loaded
    Given a user has opened a session page and its settings have not finished loading
    When the user looks at the model dropdown
    Then the dropdown is disabled
    And it becomes enabled, showing the session's stored model, once the settings have loaded

SC-8.4.1: Edit prompt button opens modal with pre-filled textarea — no stored prompt
    Given a user is on a session page
    When the user clicks "Edit prompt"
    Then a modal opens containing a textarea pre-filled with the current prompt

SC-8.4.1: Edit prompt button opens modal with pre-filled textarea — stored prompt
    Given a user is on a session page whose AI settings are stored with ${STORED_PROMPT_SETTINGS}
    When the user clicks "Edit prompt"
    Then a modal opens containing a textarea pre-filled with the current prompt

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Cancel
    Given the prompt edit modal is open with ${UNSAVED_PROMPT}
    When the user clicks "Cancel" or presses Escape or clicks outside the panel — Cancel
    Then the modal closes without saving

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Escape
    Given the prompt edit modal is open with ${UNSAVED_PROMPT}
    When the user clicks "Cancel" or presses Escape or clicks outside the panel — Escape
    Then the modal closes without saving

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — outside click
    Given the prompt edit modal is open with ${UNSAVED_PROMPT}
    When the user clicks "Cancel" or presses Escape or clicks outside the panel — outside click
    Then the modal closes without saving

SC-8.4.4: Save disabled when textarea has fewer than 10 chars — cleared
    Given the user has cleared the textarea or entered fewer than 10 characters with ${EMPTY}
    When the prompt edit modal is open
    Then the "Save" button is disabled

SC-8.4.4: Save disabled when textarea has fewer than 10 chars — 9 characters
    Given the user has cleared the textarea or entered fewer than 10 characters with ${NINE_CHARACTERS}
    When the prompt edit modal is open
    Then the "Save" button is disabled

SC-8.4.6: A prompt edited after a slow settings load is the one saved
    Given a user has opened a session page and its settings are slow to load
    When the settings finish loading and the user then edits the prompt and saves it with ${NEW_PROMPT}
    Then "Edit prompt" was disabled until the settings had loaded
    And reopening the prompt after a reload shows the user's edited prompt, not the default

SC-8.4.7: Failed settings load leaves the default prompt editable
    Given a user has opened a session page and its settings fail to load
    When the user clicks "Edit prompt"
    Then the "Couldn't load this session's AI settings." banner is shown
    And the prompt modal opens with the default prompt pre-filled

SC-8.8.1: View last review button visible after review is closed
    Given a review has completed and the result modal has been closed
    When the user looks at the session header
    Then a "View last review" button is visible

SC-8.8.2: View last review reopens modal without new API call
    Given the "View last review" button is visible
    When the user clicks it
    Then the result modal reopens showing the same result without a new API call

SC-8.8.3: View last review button absent before first review
    Given no review has been run yet
    When the user looks at the session header
    Then the "View last review" button is not visible

SC-8.8.4: Cached result remains available while new review in flight
    Given a review result is cached and a new review is triggered with ${TWO_REVIEWS}
    When the new review is in flight
    Then the cached result remains available via "View last review"

SC-8.8.5: New review result replaces cached result
    Given a new review completes with ${TWO_REVIEWS}
    When the result arrives
    Then the cached result is replaced with the new result
