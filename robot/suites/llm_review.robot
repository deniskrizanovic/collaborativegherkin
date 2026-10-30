*** Settings ***
Documentation       Port of e2e/llm-review.spec.ts — spec §8 (AI coaching review).
...                 /api/llm-review is never called for real: every review test
...                 mocks it with the routes.cjs extension. `Intercept Review`
...                 fulfills it at once; `Hold Route` keeps it in flight until
...                 `Release Route`, so the in-flight UI state can be asserted.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk4    llm-review


*** Variables ***
# "\#" escapes the leading "#", which would otherwise start a Robot comment.
${MOCK_REVIEW}      \## Feedback\n\n- Step 1 is ambiguous.\n- Consider adding an edge case.
${EMPTY_SETTINGS}    {"model": null, "prompt": null}


*** Test Cases ***
SC-8.3.1: Model dropdown shown pre-selected to persisted model — button and dropdown visible
    Open Session
    Wait For Elements State    ${REVIEW_BUTTON}    visible
    Wait For Elements State    ${MODEL_SELECT}    visible

SC-8.3.1: Model dropdown shown pre-selected to persisted model — expected models listed
    Open Session
    Wait For Elements State    ${MODEL_SELECT} option >> nth=0    attached
    ${texts}=    Texts Of All    ${MODEL_SELECT} option
    List Should Contain Value    ${texts}    meta-llama/llama-3.2-3b-instruct:free
    List Should Contain Value    ${texts}    deepseek/deepseek-v4-flash:free
    List Should Contain Value    ${texts}    google/gemma-4-31b-it:free
    List Should Contain Value    ${texts}    google/gemma-4-26b-a4b-it:free

SC-8.4.1: Edit prompt button opens modal with pre-filled textarea — button visible
    Open Session
    Wait For Elements State    ${EDIT_PROMPT_BUTTON}    visible

SC-8.3.4: Model dropdown is disabled until session settings have loaded — controls disabled while settings load is pending
    Hold Route    ${SETTINGS_URL}    200    ${EMPTY_SETTINGS}    GET
    Open Session
    Wait For Elements State    ${EDIT_PROMPT_BUTTON}    disabled
    Wait For Elements State    ${MODEL_SELECT}    disabled
    Release Route    ${SETTINGS_URL}
    Wait For Elements State    ${EDIT_PROMPT_BUTTON}    enabled
    Wait For Elements State    ${MODEL_SELECT}    enabled

SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — modal opens
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    *=    Feedback

SC-8.1.2: Successful LLM response displayed as Markdown in modal — header shows model name
    Open Session
    Intercept Review
    Wait For Elements State    ${MODEL_SELECT}    enabled
    ${selected_model}=    Get Property    ${MODEL_SELECT}    value
    Click    ${REVIEW_BUTTON}
    Get Text    ${REVIEW_MODAL_HEADER}    *=    ${selected_model}

SC-8.1.2: Successful LLM response displayed as Markdown in modal — Markdown rendered
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL_BODY} h2    visible
    Get Element Count    ${REVIEW_MODAL_BODY} li    ==    2

SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — button disabled in flight
    Open Session
    # Hold the request open until we've checked the disabled state.
    ${body}=    Review Body    ${MOCK_REVIEW}
    Hold Route    ${REVIEW_URL}    200    ${body}
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_BUTTON}    disabled
    Get Text    ${REVIEW_BUTTON}    ==    Reviewing…
    Wait For Elements State    ${MODEL_SELECT}    disabled
    Release Route    ${REVIEW_URL}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Wait For Elements State    ${REVIEW_BUTTON}    enabled

SC-8.2.3: X button closes results modal
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Click    ${REVIEW_MODAL_CLOSE}
    Wait For Elements State    ${REVIEW_MODAL}    hidden

SC-8.2.1: Escape closes results modal
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${REVIEW_MODAL}    hidden

SC-8.2.2: Clicking outside panel closes results modal
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    # Click the overlay itself (not the inner panel).
    Click With Options    ${REVIEW_MODAL}    position_x=5    position_y=5
    Wait For Elements State    ${REVIEW_MODAL}    hidden

SC-8.8.3: View last review button absent before first review
    Open Session
    Wait For Elements State    ${VIEW_LAST_BUTTON}    hidden

SC-8.8.1: View last review button visible after review is closed
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Click    ${REVIEW_MODAL_CLOSE}
    Wait For Elements State    ${REVIEW_MODAL}    hidden
    Wait For Elements State    ${VIEW_LAST_BUTTON}    visible

SC-8.8.2: View last review reopens modal without new API call
    Open Session
    Intercept Review
    Click    ${REVIEW_BUTTON}
    Get Text    ${REVIEW_MODAL_BODY}    *=    Feedback
    Click    ${REVIEW_MODAL_CLOSE}
    Wait For Elements State    ${REVIEW_MODAL}    hidden
    Click    ${VIEW_LAST_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    *=    Feedback

SC-8.8.4: Cached result remains available while new review in flight
    Open Session
    Intercept Review
    # Complete first review and close modal.
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Click    ${REVIEW_MODAL_CLOSE}
    # Hold the second request open. The newer route takes precedence.
    ${body}=    Review Body    New result
    Hold Route    ${REVIEW_URL}    200    ${body}
    Click    ${REVIEW_BUTTON}
    # Old result still accessible while in flight.
    Wait For Elements State    ${VIEW_LAST_BUTTON}    visible
    Release Route    ${REVIEW_URL}
    Wait For Elements State    ${REVIEW_MODAL}    visible

SC-8.8.5: New review result replaces cached result
    Open Session
    Intercept Review    First result content
    Click    ${REVIEW_BUTTON}
    Get Text    ${REVIEW_MODAL_BODY}    *=    First result content
    Click    ${REVIEW_MODAL_CLOSE}
    Intercept Review    Second result content
    Click    ${REVIEW_BUTTON}
    Get Text    ${REVIEW_MODAL_BODY}    *=    Second result content

SC-8.1.3: LLM failure shows error in modal and resets button
    Open Session
    Fulfill Route    ${REVIEW_URL}    500    {"error": "LLM request failed"}
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    *=    LLM request failed

SC-8.4.1: Edit prompt button opens modal with pre-filled textarea
    Open Session
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    ${value}=    Get Property    ${PROMPT_TEXTAREA}    value
    Should Be True    len($value) > 10

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Cancel
    Open Session
    Click    ${EDIT_PROMPT_BUTTON}
    Fill Text    ${PROMPT_TEXTAREA}    Changed prompt text that is long enough
    Click    ${PROMPT_CANCEL}
    Wait For Elements State    ${PROMPT_MODAL}    hidden

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Escape
    Open Session
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${PROMPT_MODAL}    hidden

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — click outside
    Open Session
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    Click With Options    ${PROMPT_MODAL}    position_x=5    position_y=5
    Wait For Elements State    ${PROMPT_MODAL}    hidden

SC-8.4.4: Save disabled when textarea has fewer than 10 chars
    Open Session
    Click    ${EDIT_PROMPT_BUTTON}
    Fill Text    ${PROMPT_TEXTAREA}    short
    Wait For Elements State    ${PROMPT_SAVE}    disabled

SC-8.4.2: Saving new prompt persists it and closes modal
    Open Session
    Click    ${EDIT_PROMPT_BUTTON}
    ${new_prompt}=    Set Variable    You are a strict BDD coach. Be extremely concise and critical.
    Fill Text    ${PROMPT_TEXTAREA}    ${new_prompt}
    Click    ${PROMPT_SAVE}
    Wait For Elements State    ${PROMPT_MODAL}    hidden
    # Re-open and verify.
    Click    ${EDIT_PROMPT_BUTTON}
    Get Property    ${PROMPT_TEXTAREA}    value    ==    ${new_prompt}
    # Clean up: close without saving.
    Click    ${PROMPT_CANCEL}

SC-8.4.6: A prompt edited after a slow settings load is the one saved
    Hold Route    ${SETTINGS_URL}    200    ${EMPTY_SETTINGS}    GET
    Open Session
    Wait For Elements State    ${EDIT_PROMPT_BUTTON}    disabled
    Release Route    ${SETTINGS_URL}
    Click    ${EDIT_PROMPT_BUTTON}
    ${new_prompt}=    Set Variable    You are a patient BDD coach. Explain every suggestion.
    Fill Text    ${PROMPT_TEXTAREA}    ${new_prompt}
    Click    ${PROMPT_SAVE}
    Wait For Elements State    ${PROMPT_MODAL}    hidden
    # Reload against the real server: the PATCH must have sent the edited text.
    Clear Routes
    Reload
    Click    ${EDIT_PROMPT_BUTTON}
    Get Property    ${PROMPT_TEXTAREA}    value    ==    ${new_prompt}

SC-8.4.7: Failed settings load leaves the default prompt editable
    Fulfill Route    ${SETTINGS_URL}    500    {"error": "Failed to fetch session"}    GET
    Open Session
    Get Text    ${SETTINGS_ERROR}    ==    Couldn't load this session's AI settings.
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    Get Property    ${PROMPT_TEXTAREA}    value    ^=    ${DEFAULT_PROMPT_START}


*** Keywords ***
Intercept Review
    [Documentation]    Fulfill /api/llm-review with 200 and ${result} as the
    ...    review text. Port of the spec's `interceptReview` helper.
    [Arguments]    ${result}=${MOCK_REVIEW}
    ${body}=    Review Body    ${result}
    Fulfill Route    ${REVIEW_URL}    200    ${body}
