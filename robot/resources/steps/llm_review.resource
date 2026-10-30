*** Settings ***
Documentation       Business-language steps for openspec/specs/llm-review/spec.md.
...
...                 Each keyword is named after a GIVEN/WHEN/THEN line of that
...                 spec, so a `bdd` test repeats its scenario word for word.
...                 Steps whose text also appears in another capability are in
...                 shared.resource. Title Case keywords at the bottom are
...                 technical helpers that tests never call.
...
...                 /api/llm-review is never called for real. A review that
...                 completes is served by `Fulfill Counted Route`, so a step can
...                 check how many requests reached it; a review that has to stay
...                 in flight is held with `Hold Route`, released only by the
...                 test teardown (`Clear Routes`). The session settings GET is
...                 held or failed the same way where a scenario needs it.
...
...                 Where a line describes work done on the server, the step
...                 checks what the browser can see and its [Documentation]
...                 names the boundary.
...
...                 Shared variables set by the keywords of this file:
...                 ${SESSION_ID}: id of the session the user opened (set
...                 through the shared `a user is in a session editor`).
...                 ${REVIEW_REQUEST}: promise of the POST /api/llm-review
...                 request, armed before the click.
...                 ${CONTENT_AT_REVIEW}: the editor's top-level nodes when
...                 "Get AI Coaching" was clicked (`Document Content In Editor`).
...                 ${REVIEWED_MODEL}: the dropdown's model when the review was
...                 clicked.
...                 ${REVIEW_ERROR}: the error message the failed review returns.
...                 ${REVIEW_SHOWN}: text of the result modal's body for the
...                 first completed review.
...                 ${NEW_REVIEW_RESULT}: the result of the second review.
...                 ${HELD_SETTINGS_MODEL}: the stored model the held settings
...                 GET returns once released.
...                 ${PROMPT_BEFORE}, ${EDITED_PROMPT}: the prompt when the modal
...                 opened, and the unsaved text typed over it.
...                 ${EDIT_PROMPT_STATES_WHILE_LOADING}: states of "Edit prompt"
...                 while the settings GET was held.
...                 ${SAVED_PROMPT}: the prompt the user saved.
...                 ${IT_SELECTOR}: see shared.resource.

Library             Collections
Resource            ../session.resource
Resource            ../editor.resource
Resource            shared.resource


*** Variables ***
# Mirrors of src/lib/llm-constants.ts: DEFAULT_MODEL (AVAILABLE_MODELS[0]) and
# AVAILABLE_MODELS[1], a model that is not the default, so a check can tell
# "the stored model" apart from "the default model".
${DEFAULT_MODEL}        openrouter/free
${STORED_MODEL}         meta-llama/llama-3.2-3b-instruct:free
# Result of a review whose text no step checks.
${ANY_REVIEW}           Review result.
${NO_STORED_SETTINGS}    {"model": null, "prompt": null}
${SETTINGS_ERROR_TEXT}    Couldn't load this session's AI settings.


*** Keywords ***
# ---- Given ---------------------------------------------------------------

a user is on a session page
    [Documentation]    Synonym of `a user is in a session editor` (shared): open
    ...    a fresh session, with no stored model or prompt.
    ...    Sets: ${SESSION_ID}.
    a user is in a session editor

a user is on a session page with ${document}
    [Documentation]    As `a user is on a session page`, then type ${document},
    ...    a dictionary of block type to text (`Type Document`).
    ...    Sets: ${SESSION_ID}.
    a user is on a session page
    Type Document    ${document}

a user is on a session page whose AI settings are stored with ${settings}
    [Documentation]    Open a fresh session, store ${settings} (a dictionary
    ...    with `model`, `prompt` or both) as its AI settings through the API,
    ...    then reload, so the page loads them. Checks that a stored model is
    ...    not ${DEFAULT_MODEL}, so the Then steps cannot pass on the default.
    ...    Sets: ${SESSION_ID}.
    IF    "model" in $settings
        Should Not Be Equal    ${settings}[model]    ${DEFAULT_MODEL}
    END
    a user is on a session page
    Store Session Settings Via API    ${SESSION_ID}    ${settings}
    Reload

the LLM returns a response with ${review}
    [Documentation]    Open a fresh session; /api/llm-review answers 200 with
    ...    ${review} as the result.
    ...    Sets: ${SESSION_ID}.
    a user is on a session page
    Serve Review    ${review}

the LLM request fails with ${error}
    [Documentation]    Open a fresh session; /api/llm-review answers 500 with
    ...    ${error} as the error message.
    ...    Sets: ${SESSION_ID}, ${REVIEW_ERROR}.
    a user is on a session page
    ${body}=    Evaluate    json.dumps({"error": $error})    modules=json
    Fulfill Counted Route    ${REVIEW_URL}    500    ${body}
    Set Test Variable    ${REVIEW_ERROR}    ${error}

the results modal is open
    [Documentation]    Open a fresh session, complete a review and wait for
    ...    the result modal.
    ...    Sets: ${SESSION_ID}, ${REVIEW_SHOWN}.
    a user is on a session page
    Complete Review    ${ANY_REVIEW}

a user has opened a session page and its settings have not finished loading
    [Documentation]    Hold the session settings GET, which will return
    ...    ${STORED_MODEL} as the stored model, and open a fresh session.
    ...    Sets: ${SESSION_ID}, ${HELD_SETTINGS_MODEL}.
    Should Not Be Equal    ${STORED_MODEL}    ${DEFAULT_MODEL}
    ${body}=    Evaluate    json.dumps({"model": $STORED_MODEL, "prompt": None})    modules=json
    Hold Route    ${SETTINGS_URL}    200    ${body}    GET
    a user is on a session page
    Set Test Variable    ${HELD_SETTINGS_MODEL}    ${STORED_MODEL}

the prompt edit modal is open with ${edited}
    [Documentation]    Open a fresh session and the prompt modal, record the
    ...    prompt it shows, then type ${edited} over it without saving.
    ...    Sets: ${SESSION_ID}, ${PROMPT_BEFORE}, ${EDITED_PROMPT}.
    a user is on a session page
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_TEXTAREA}    visible
    ${before}=    Get Property    ${PROMPT_TEXTAREA}    value
    Should Not Be Equal    ${edited}    ${before}
    Fill Text    ${PROMPT_TEXTAREA}    ${edited}
    Get Property    ${PROMPT_TEXTAREA}    value    ==    ${edited}
    Set Test Variable    ${PROMPT_BEFORE}    ${before}
    Set Test Variable    ${EDITED_PROMPT}    ${edited}

the user has cleared the textarea or entered fewer than 10 characters with ${text}
    [Documentation]    Open a fresh session and the prompt modal, and replace
    ...    the prompt with ${text}, which test data keeps under 10 characters
    ...    (empty for "cleared").
    ...    Sets: ${SESSION_ID}.
    Should Be True    len($text) < 10    Test data "${text}" is not under 10 characters
    a user is on a session page
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_TEXTAREA}    visible
    Fill Text    ${PROMPT_TEXTAREA}    ${text}
    Get Property    ${PROMPT_TEXTAREA}    value    ==    ${text}

a user has opened a session page and its settings are slow to load
    [Documentation]    Hold the session settings GET (no stored model or
    ...    prompt) and open a fresh session.
    ...    Sets: ${SESSION_ID}.
    Hold Route    ${SETTINGS_URL}    200    ${NO_STORED_SETTINGS}    GET
    a user is on a session page

a user has opened a session page and its settings fail to load
    [Documentation]    The session settings GET answers 500; open a fresh
    ...    session.
    ...    Sets: ${SESSION_ID}.
    Fulfill Route    ${SETTINGS_URL}    500    {"error": "Failed to fetch session"}    GET
    a user is on a session page

a review has completed and the result modal has been closed
    [Documentation]    Open a fresh session, complete a review, then close the
    ...    result modal with ✕.
    ...    Sets: ${SESSION_ID}, ${REVIEW_SHOWN}.
    a user is on a session page
    Complete Review    ${ANY_REVIEW}
    Close Review Modal

the "View last review" button is visible
    [Documentation]    Open a fresh session, complete a review, close the result
    ...    modal and wait for "View last review". "it" in the next step is
    ...    that button.
    ...    Sets: ${SESSION_ID}, ${REVIEW_SHOWN}, ${IT_SELECTOR}.
    a review has completed and the result modal has been closed
    Wait For Elements State    ${VIEW_LAST_BUTTON}    visible
    Set Test Variable    ${IT_SELECTOR}    ${VIEW_LAST_BUTTON}

no review has been run yet
    [Documentation]    Open a fresh session and run no review.
    ...    Sets: ${SESSION_ID}.
    a user is on a session page

a review result is cached and a new review is triggered with ${reviews}
    [Documentation]    Open a fresh session, complete a review with the first
    ...    result of ${reviews} and close the modal, then hold /api/llm-review
    ...    (it would return the second result) and click "Get AI Coaching".
    ...    Sets: ${SESSION_ID}, ${REVIEW_SHOWN}.
    a user is on a session page
    Complete Review    ${reviews}[0]
    Close Review Modal
    ${body}=    Review Body    ${reviews}[1]
    Hold Route    ${REVIEW_URL}    200    ${body}
    Click    ${REVIEW_BUTTON}

a new review completes with ${reviews}
    [Documentation]    Open a fresh session, complete a review with the first
    ...    result of ${reviews} and close the modal, then serve the second
    ...    result and click "Get AI Coaching" again. Test data keeps the second
    ...    result plain text, so the modal shows it as written.
    ...    Sets: ${SESSION_ID}, ${REVIEW_SHOWN}, ${NEW_REVIEW_RESULT}.
    a user is on a session page
    Complete Review    ${reviews}[0]
    Close Review Modal
    Serve Review    ${reviews}[1]
    Set Test Variable    ${NEW_REVIEW_RESULT}    ${reviews}[1]
    Click    ${REVIEW_BUTTON}

# ---- When ----------------------------------------------------------------

the user clicks "Get AI Coaching"
    [Documentation]    Hold /api/llm-review so the review stays in flight,
    ...    record the editor's content, start waiting for the review request,
    ...    then click the button.
    ...    Sets: ${CONTENT_AT_REVIEW}, ${REVIEW_REQUEST}.
    ${body}=    Review Body    ${ANY_REVIEW}
    Hold Route    ${REVIEW_URL}    200    ${body}
    Wait For Elements State    ${REVIEW_BUTTON}    enabled
    ${content}=    Document Content In Editor
    Set Test Variable    ${CONTENT_AT_REVIEW}    ${content}
    ${promise}=    Promise To    Wait For Request    matcher=**${REVIEW_URL}
    Set Test Variable    ${REVIEW_REQUEST}    ${promise}
    Click    ${REVIEW_BUTTON}

the review completes
    [Documentation]    Record the dropdown's model, click "Get AI Coaching",
    ...    and wait for the result modal and for the button to be enabled
    ...    again.
    ...    Sets: ${REVIEWED_MODEL}.
    Wait For Elements State    ${MODEL_SELECT}    enabled
    ${model}=    Get Property    ${MODEL_SELECT}    value
    Set Test Variable    ${REVIEWED_MODEL}    ${model}
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Wait For Elements State    ${REVIEW_BUTTON}    enabled

the review completes with an error
    [Documentation]    Click "Get AI Coaching" and wait for the result modal.
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible

the user clicks outside the modal inner panel
    [Documentation]    Click the overlay near its top-left corner, outside the
    ...    inner panel.
    Click With Options    ${REVIEW_MODAL}    position_x=5    position_y=5

the user clicks the ✕ button
    Get Text    ${REVIEW_MODAL_CLOSE}    ==    ✕
    Click    ${REVIEW_MODAL_CLOSE}

the page loads
    [Documentation]    Wait until the session settings have loaded: the model
    ...    dropdown is enabled only then.
    Wait For Elements State    ${MODEL_SELECT}    enabled

the user looks at the model dropdown
    Wait For Elements State    ${MODEL_SELECT}    visible

the user clicks "Edit prompt"
    Click    ${EDIT_PROMPT_BUTTON}

the user clicks "Cancel" or presses Escape or clicks outside the panel — ${way:Cancel|Escape|outside click}
    [Documentation]    Close the prompt modal the way ${way} names.
    IF    $way == "Cancel"
        Click    ${PROMPT_MODAL} >> ${PROMPT_CANCEL}
    ELSE IF    $way == "Escape"
        Keyboard Key    press    Escape
    ELSE
        Click With Options    ${PROMPT_MODAL}    position_x=5    position_y=5
    END

the prompt edit modal is open
    [Documentation]    The prompt modal the previous step opened is shown.
    Wait For Elements State    ${PROMPT_MODAL}    visible

the settings finish loading and the user then edits the prompt and saves it with ${prompt}
    [Documentation]    Record the states of "Edit prompt" while the settings
    ...    GET is still held, release it, then open the prompt modal, type
    ...    ${prompt}, click Save and wait for the modal to close.
    ...    Sets: ${EDIT_PROMPT_STATES_WHILE_LOADING}, ${SAVED_PROMPT}.
    ${states}=    Get Element States    ${EDIT_PROMPT_BUTTON}
    Set Test Variable    ${EDIT_PROMPT_STATES_WHILE_LOADING}    ${states}
    Release Route    ${SETTINGS_URL}
    Click    ${EDIT_PROMPT_BUTTON}
    Fill Text    ${PROMPT_TEXTAREA}    ${prompt}
    Click    ${PROMPT_SAVE}
    Wait For Elements State    ${PROMPT_MODAL}    hidden
    Set Test Variable    ${SAVED_PROMPT}    ${prompt}

the user looks at the session header
    [Documentation]    Wait for the row of AI review controls under the session
    ...    title, with "Get AI Coaching" ready.
    Wait For Elements State    ${SESSION_ACTIONS}    visible
    Wait For Elements State    ${REVIEW_BUTTON}    enabled

the new review is in flight
    Wait For Elements State    ${REVIEW_BUTTON}    disabled
    Get Text    ${REVIEW_BUTTON}    ==    Reviewing…

the result arrives
    [Documentation]    Wait for the result modal and for "Get AI Coaching" to
    ...    be enabled again.
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Wait For Elements State    ${REVIEW_BUTTON}    enabled

# ---- Then ----------------------------------------------------------------

the current Gherkin content is sent to the resolved model via the OpenRouter gateway
    [Documentation]    The POST /api/llm-review request carries this session's
    ...    id and the editor's content as it was at the click: one
    ...    `Keyword: text` line per block, in document order. Boundary: the
    ...    browser sends the content to /api/llm-review; resolving the model
    ...    and calling OpenRouter happen on the server and are covered by
    ...    src/app/api/llm-review/route.test.ts.
    ...    Reads: ${REVIEW_REQUEST}, ${CONTENT_AT_REVIEW}, ${SESSION_ID}.
    Require Step State    REVIEW_REQUEST    the user clicks "Get AI Coaching"
    ${request}=    Wait For    ${REVIEW_REQUEST}
    Should Be Equal    ${request}[method]    POST
    ${body}=    Evaluate
    ...    $request["postData"] if isinstance($request["postData"], dict) else json.loads($request["postData"])
    ...    modules=json
    Should Be Equal    ${body}[sessionId]    ${SESSION_ID}
    ${blocks}=    Evaluate    [n for n in $CONTENT_AT_REVIEW if "text" in n]
    Should Not Be Empty    ${blocks}
    ${expected}=    Evaluate    [n["node"].title() + ": " + n["text"] for n in $blocks]
    ${lines}=    Evaluate    [line.rstrip() for line in $body["content"].split("\\n")]
    ${expected}=    Evaluate    [line.rstrip() for line in $expected]
    Lists Should Be Equal    ${lines}    ${expected}

the "Get AI Coaching" button is disabled and shows "Reviewing…" while the request is in flight
    [Documentation]    The review request is held, so it is still in flight.
    ...    Reads: ${REVIEW_REQUEST}.
    Require Step State    REVIEW_REQUEST    the user clicks "Get AI Coaching"
    Wait For Elements State    ${REVIEW_BUTTON}    disabled
    Get Text    ${REVIEW_BUTTON}    ==    Reviewing…

the model dropdown is disabled while the request is in flight
    [Documentation]    The review request is held, so it is still in flight.
    ...    Reads: ${REVIEW_REQUEST}.
    Require Step State    REVIEW_REQUEST    the user clicks "Get AI Coaching"
    Wait For Elements State    ${MODEL_SELECT}    disabled
    Get Text    ${REVIEW_BUTTON}    ==    Reviewing…

the result is displayed in a modal
    Wait For Elements State    ${REVIEW_MODAL} >> ${REVIEW_MODAL_BODY}    visible
    Get Text    ${REVIEW_MODAL_BODY}    !=    ${EMPTY}

the result is rendered as Markdown — ${rendered}
    [Documentation]    The headings and list items of the modal body, in
    ...    order, are exactly ${rendered}: `tag: text` strings (test data).
    ${js}=    Catenate
    ...    (el) => [...el.querySelectorAll("h1, h2, h3, h4, h5, h6, li")]
    ...    .map((node) => node.tagName.toLowerCase() + ": " + node.textContent)
    ${elements}=    Evaluate JavaScript    ${REVIEW_MODAL_BODY}    ${js}
    ${expected}=    Evaluate    list($rendered)
    Lists Should Be Equal    ${elements}    ${expected}

the modal header shows the name of the model that produced the result
    [Documentation]    The header's title ends with the model the dropdown
    ...    showed when the review was clicked.
    ...    Reads: ${REVIEWED_MODEL}.
    Require Step State    REVIEWED_MODEL    the review completes
    Get Text    ${REVIEW_MODAL_HEADER} >> ${REVIEW_MODAL_TITLE}    $=    — ${REVIEWED_MODEL}

an error message is displayed in the modal
    [Documentation]    The result modal's body is the error message.
    ...    Reads: ${REVIEW_ERROR}.
    Require Step State    REVIEW_ERROR    the LLM request fails with <error>
    Get Text    ${REVIEW_MODAL} >> ${REVIEW_MODAL_BODY}    ==    ${REVIEW_ERROR}

the button returns to its normal state
    [Documentation]    "Get AI Coaching" is enabled, labelled as before the
    ...    review, and no longer has the `reviewing` class.
    Wait For Elements State    ${REVIEW_BUTTON}    enabled
    Get Text    ${REVIEW_BUTTON}    ==    Get AI Coaching
    Get Classes    ${REVIEW_BUTTON}    validate    "reviewing" not in value

the modal closes
    Wait For Elements State    ${REVIEW_MODAL}    hidden

a model dropdown is shown alongside the "Get AI Coaching" button
    [Documentation]    Both are visible in the same row of session actions.
    Wait For Elements State    ${SESSION_ACTIONS} >> ${MODEL_SELECT}    visible
    ${button}=    Set Variable    ${SESSION_ACTIONS} >> ${REVIEW_BUTTON}
    Wait For Elements State    ${button}    visible
    Get Text    ${button}    ==    Get AI Coaching

the dropdown is pre-selected to the session's stored model, or the default model if none is set
    [Documentation]    Read the session's stored model through the API: the
    ...    dropdown shows it, or ${DEFAULT_MODEL} when it is null.
    ...    Reads: ${SESSION_ID}.
    Require Step State    SESSION_ID    a user is on a session page
    ${settings}=    Session Settings Via API    ${SESSION_ID}
    ${expected}=    Set Variable If    $settings["model"] is None    ${DEFAULT_MODEL}    ${settings}[model]
    Get Property    ${MODEL_SELECT}    value    ==    ${expected}

the dropdown is disabled
    Wait For Elements State    ${MODEL_SELECT}    disabled

it becomes enabled, showing the session's stored model, once the settings have loaded
    [Documentation]    Release the held settings GET; the dropdown becomes
    ...    enabled and shows the stored model, which is not the default.
    ...    Reads: ${HELD_SETTINGS_MODEL}.
    Require Step State    HELD_SETTINGS_MODEL
    ...    a user has opened a session page and its settings have not finished loading
    Release Route    ${SETTINGS_URL}
    Wait For Elements State    ${MODEL_SELECT}    enabled
    Get Property    ${MODEL_SELECT}    value    ==    ${HELD_SETTINGS_MODEL}

a modal opens containing a textarea pre-filled with the current prompt
    [Documentation]    Read the session's stored prompt through the API: the
    ...    textarea holds it, or DEFAULT_PROMPT (checked by its opening words,
    ...    ${DEFAULT_PROMPT_START}) when it is null.
    ...    Reads: ${SESSION_ID}.
    Require Step State    SESSION_ID    a user is on a session page
    ${textarea}=    Set Variable    ${PROMPT_MODAL} >> ${PROMPT_TEXTAREA}
    Wait For Elements State    ${textarea}    visible
    ${settings}=    Session Settings Via API    ${SESSION_ID}
    IF    $settings["prompt"] is None
        Get Property    ${textarea}    value    ^=    ${DEFAULT_PROMPT_START}
    ELSE
        Get Property    ${textarea}    value    ==    ${settings}[prompt]
    END

the modal closes without saving
    [Documentation]    The prompt modal closes, and after a reload it shows
    ...    the prompt from before the edit, not the edited text. The reload
    ...    is what proves "without saving": until then the page keeps the
    ...    unsaved text in its state, so reopening on the same page shows it.
    ...    Reads: ${PROMPT_BEFORE}.
    Require Step State    PROMPT_BEFORE    the prompt edit modal is open with <edited>
    Wait For Elements State    ${PROMPT_MODAL}    hidden
    Reload
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_TEXTAREA}    visible
    Get Property    ${PROMPT_TEXTAREA}    value    ==    ${PROMPT_BEFORE}

the "Save" button is disabled
    ${save}=    Set Variable    ${PROMPT_MODAL} >> ${PROMPT_SAVE}
    Get Text    ${save}    ==    Save
    Wait For Elements State    ${save}    disabled

"Edit prompt" was disabled until the settings had loaded
    [Documentation]    "Edit prompt" was disabled while the settings GET was
    ...    held, and is enabled now that it has loaded.
    ...    Reads: ${EDIT_PROMPT_STATES_WHILE_LOADING}.
    Require Step State    EDIT_PROMPT_STATES_WHILE_LOADING
    ...    the settings finish loading and the user then edits the prompt and saves it with <prompt>
    List Should Contain Value    ${EDIT_PROMPT_STATES_WHILE_LOADING}    disabled
    Wait For Elements State    ${EDIT_PROMPT_BUTTON}    enabled

reopening the prompt after a reload shows the user's edited prompt, not the default
    [Documentation]    Drop the mocked routes, reload against the real server
    ...    and reopen the prompt: it is the saved text and does not start like
    ...    DEFAULT_PROMPT.
    ...    Reads: ${SAVED_PROMPT}.
    Require Step State    SAVED_PROMPT
    ...    the settings finish loading and the user then edits the prompt and saves it with <prompt>
    Clear Routes
    Reload
    Click    ${EDIT_PROMPT_BUTTON}
    Wait For Elements State    ${PROMPT_TEXTAREA}    visible
    ${value}=    Get Property    ${PROMPT_TEXTAREA}    value
    Should Be Equal    ${value}    ${SAVED_PROMPT}
    Should Not Start With    ${value}    ${DEFAULT_PROMPT_START}

the "Couldn't load this session's AI settings." banner is shown
    Get Text    ${SETTINGS_ERROR}    ==    ${SETTINGS_ERROR_TEXT}

the prompt modal opens with the default prompt pre-filled
    [Documentation]    The textarea is editable and starts like DEFAULT_PROMPT.
    ${textarea}=    Set Variable    ${PROMPT_MODAL} >> ${PROMPT_TEXTAREA}
    Wait For Elements State    ${textarea}    editable
    Get Property    ${textarea}    value    ^=    ${DEFAULT_PROMPT_START}

a "View last review" button is visible
    ${button}=    Set Variable    ${SESSION_ACTIONS} >> ${VIEW_LAST_BUTTON}
    Wait For Elements State    ${button}    visible
    Get Text    ${button}    ==    View last review

the result modal reopens showing the same result without a new API call
    [Documentation]    The result modal shows the text it showed for the first
    ...    review, and /api/llm-review has still served exactly one request.
    ...    Reads: ${REVIEW_SHOWN}.
    Require Step State    REVIEW_SHOWN    the "View last review" button is visible
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    ==    ${REVIEW_SHOWN}
    ${count}=    Route Request Count    ${REVIEW_URL}
    Should Be Equal As Integers    ${count}    1

the "View last review" button is not visible
    Wait For Elements State    ${REVIEW_BUTTON}    visible
    Wait For Elements State    ${VIEW_LAST_BUTTON}    hidden

the cached result remains available via "View last review"
    [Documentation]    While the new review is still in flight, "View last
    ...    review" opens the modal on the earlier result.
    ...    Reads: ${REVIEW_SHOWN}.
    Require Step State    REVIEW_SHOWN
    ...    a review result is cached and a new review is triggered with <reviews>
    Click    ${VIEW_LAST_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    ==    ${REVIEW_SHOWN}
    Wait For Elements State    ${REVIEW_BUTTON}    disabled

the cached result is replaced with the new result
    [Documentation]    The modal shows the new result, and after it is closed
    ...    "View last review" shows the new result too, not the earlier one.
    ...    Reads: ${REVIEW_SHOWN}, ${NEW_REVIEW_RESULT}.
    Require Step State    NEW_REVIEW_RESULT    a new review completes with <reviews>
    Should Not Be Equal    ${NEW_REVIEW_RESULT}    ${REVIEW_SHOWN}
    Get Text    ${REVIEW_MODAL_BODY}    ==    ${NEW_REVIEW_RESULT}
    Close Review Modal
    Click    ${VIEW_LAST_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    ==    ${NEW_REVIEW_RESULT}

# ---- Technical helpers ---------------------------------------------------

Serve Review
    [Documentation]    Fulfill /api/llm-review with 200 and ${result} as the
    ...    review text, counting the requests (`Route Request Count`).
    [Arguments]    ${result}
    ${body}=    Review Body    ${result}
    Fulfill Counted Route    ${REVIEW_URL}    200    ${body}

Complete Review
    [Documentation]    Serve ${result}, click "Get AI Coaching" and wait for the
    ...    result modal to show it. Sets: ${REVIEW_SHOWN}.
    [Arguments]    ${result}
    Serve Review    ${result}
    Click    ${REVIEW_BUTTON}
    Wait For Elements State    ${REVIEW_MODAL}    visible
    ${shown}=    Get Text    ${REVIEW_MODAL_BODY}    !=    ${EMPTY}
    Set Test Variable    ${REVIEW_SHOWN}    ${shown}

Close Review Modal
    [Documentation]    Click ✕ and wait for the result modal to close.
    Click    ${REVIEW_MODAL_CLOSE}
    Wait For Elements State    ${REVIEW_MODAL}    hidden
