*** Settings ***
Documentation       Port of e2e/llm-review.spec.ts — spec §8 (AI coaching review).
...                 /api/llm-review is never called for real: every review test
...                 mocks it with the routes.cjs extension. `Intercept Review`
...                 fulfills it at once; `Hold Route` keeps it in flight until
...                 `Release Route`, so the in-flight UI state can be asserted.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk4    llm-review


*** Variables ***
${REVIEW_URL}       /api/llm-review
# "\#" escapes the leading "#", which would otherwise start a Robot comment.
${MOCK_REVIEW}      \## Feedback\n\n- Step 1 is ambiguous.\n- Consider adding an edge case.
${REVIEW_BTN}       .session-review-btn
${MODEL_SELECT}     .session-model-select
${MODAL}            .session-review-modal
${MODAL_BODY}       .session-review-modal-body
${MODAL_CLOSE}      .session-review-modal-close
${VIEW_LAST_BTN}    .session-view-last-review-btn
${EDIT_PROMPT}      .session-edit-prompt-btn
${PROMPT_MODAL}     .session-prompt-modal
${PROMPT_TEXT}      .session-prompt-textarea


*** Test Cases ***
SC-8.3.1: Model dropdown shown pre-selected to persisted model — button and dropdown visible
    Open Session
    Wait For Elements State    ${REVIEW_BTN}    visible
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
    Wait For Elements State    ${EDIT_PROMPT}    visible

SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — modal opens
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    Get Text    ${MODAL_BODY}    *=    Feedback

SC-8.1.2: Successful LLM response displayed as Markdown in modal — header shows model name
    Open Session
    Intercept Review
    ${selected_model}=    Get Property    ${MODEL_SELECT}    value
    Click    ${REVIEW_BTN}
    Get Text    .session-review-modal-header    *=    ${selected_model}

SC-8.1.2: Successful LLM response displayed as Markdown in modal — Markdown rendered
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL_BODY} h2    visible
    Get Element Count    ${MODAL_BODY} li    ==    2

SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — button disabled in flight
    Open Session
    # Hold the request open until we've checked the disabled state.
    ${body}=    Review Body    ${MOCK_REVIEW}
    Hold Route    ${REVIEW_URL}    200    ${body}
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${REVIEW_BTN}    disabled
    Get Text    ${REVIEW_BTN}    ==    Reviewing…
    Wait For Elements State    ${MODEL_SELECT}    disabled
    Release Route    ${REVIEW_URL}
    Wait For Elements State    ${MODAL}    visible
    Wait For Elements State    ${REVIEW_BTN}    enabled

SC-8.2.3: X button closes results modal
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    Click    ${MODAL_CLOSE}
    Wait For Elements State    ${MODAL}    hidden

SC-8.2.1: Escape closes results modal
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${MODAL}    hidden

SC-8.2.2: Clicking outside panel closes results modal
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    # Click the overlay itself (not the inner panel).
    Click With Options    ${MODAL}    position_x=5    position_y=5
    Wait For Elements State    ${MODAL}    hidden

SC-8.8.3: View last review button absent before first review
    Open Session
    Wait For Elements State    ${VIEW_LAST_BTN}    hidden

SC-8.8.1: View last review button visible after review is closed
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    Click    ${MODAL_CLOSE}
    Wait For Elements State    ${MODAL}    hidden
    Wait For Elements State    ${VIEW_LAST_BTN}    visible

SC-8.8.2: View last review reopens modal without new API call
    Open Session
    Intercept Review
    Click    ${REVIEW_BTN}
    Get Text    ${MODAL_BODY}    *=    Feedback
    Click    ${MODAL_CLOSE}
    Wait For Elements State    ${MODAL}    hidden
    Click    ${VIEW_LAST_BTN}
    Wait For Elements State    ${MODAL}    visible
    Get Text    ${MODAL_BODY}    *=    Feedback

SC-8.8.4: Cached result remains available while new review in flight
    Open Session
    Intercept Review
    # Complete first review and close modal.
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    Click    ${MODAL_CLOSE}
    # Hold the second request open. The newer route takes precedence.
    ${body}=    Review Body    New result
    Hold Route    ${REVIEW_URL}    200    ${body}
    Click    ${REVIEW_BTN}
    # Old result still accessible while in flight.
    Wait For Elements State    ${VIEW_LAST_BTN}    visible
    Release Route    ${REVIEW_URL}
    Wait For Elements State    ${MODAL}    visible

SC-8.8.5: New review result replaces cached result
    Open Session
    Intercept Review    First result content
    Click    ${REVIEW_BTN}
    Get Text    ${MODAL_BODY}    *=    First result content
    Click    ${MODAL_CLOSE}
    Intercept Review    Second result content
    Click    ${REVIEW_BTN}
    Get Text    ${MODAL_BODY}    *=    Second result content

SC-8.1.3: LLM failure shows error in modal and resets button
    Open Session
    Fulfill Route    ${REVIEW_URL}    500    {"error": "LLM request failed"}
    Click    ${REVIEW_BTN}
    Wait For Elements State    ${MODAL}    visible
    Get Text    ${MODAL_BODY}    *=    LLM request failed

SC-8.4.1: Edit prompt button opens modal with pre-filled textarea
    Open Session
    Click    ${EDIT_PROMPT}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    ${value}=    Get Property    ${PROMPT_TEXT}    value
    Should Be True    len($value) > 10

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Cancel
    Open Session
    Click    ${EDIT_PROMPT}
    Fill Text    ${PROMPT_TEXT}    Changed prompt text that is long enough
    Click    .session-prompt-cancel
    Wait For Elements State    ${PROMPT_MODAL}    hidden

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Escape
    Open Session
    Click    ${EDIT_PROMPT}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${PROMPT_MODAL}    hidden

SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — click outside
    Open Session
    Click    ${EDIT_PROMPT}
    Wait For Elements State    ${PROMPT_MODAL}    visible
    Click With Options    ${PROMPT_MODAL}    position_x=5    position_y=5
    Wait For Elements State    ${PROMPT_MODAL}    hidden

SC-8.4.4: Save disabled when textarea has fewer than 10 chars
    Open Session
    Click    ${EDIT_PROMPT}
    Fill Text    ${PROMPT_TEXT}    short
    Wait For Elements State    .session-prompt-save    disabled

SC-8.4.2: Saving new prompt persists it and closes modal
    Open Session
    Click    ${EDIT_PROMPT}
    ${new_prompt}=    Set Variable    You are a strict BDD coach. Be extremely concise and critical.
    Fill Text    ${PROMPT_TEXT}    ${new_prompt}
    Click    .session-prompt-save
    Wait For Elements State    ${PROMPT_MODAL}    hidden
    # Re-open and verify.
    Click    ${EDIT_PROMPT}
    Get Property    ${PROMPT_TEXT}    value    ==    ${new_prompt}
    # Clean up: close without saving.
    Click    .session-prompt-cancel


*** Keywords ***
Review Body
    [Documentation]    Return the JSON body of a successful review: {"result": ${result}}.
    [Arguments]    ${result}
    ${body}=    Evaluate    json.dumps({"result": $result})    modules=json
    RETURN    ${body}

Intercept Review
    [Documentation]    Fulfill /api/llm-review with 200 and ${result} as the
    ...    review text. Port of the spec's `interceptReview` helper.
    [Arguments]    ${result}=${MOCK_REVIEW}
    ${body}=    Review Body    ${result}
    Fulfill Route    ${REVIEW_URL}    200    ${body}
