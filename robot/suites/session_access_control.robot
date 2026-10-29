*** Settings ***
Documentation       Port of the collaborator-UX block of
...                 e2e/session-access-control.spec.ts (ADR-0005). The owner page
...                 (user.json) creates the session; a second context signed in
...                 as a distinct user (user2.json) opens the shared link. Each
...                 GET/PATCH status is asserted on the network, independently of
...                 the UI, because the old bug swallowed a 403 silently.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk5    session-access-control


*** Variables ***
${FEATURE}          [data-gherkin-type="feature"]
${MODEL_SELECT}     .session-model-select
${PROMPT_MODAL}     .session-prompt-modal
${PROMPT}           A collaborator-supplied review prompt that is comfortably long enough.


*** Test Cases ***
a second user opens the shared link: no error banner, settings load
    ${id}=    Create Session Via API    Shared with a collaborator
    Open Shared Link As Other User
    # The settings GET on load must succeed for a non-owner (200), not 403.
    Expect Response Status    /api/sessions/${id}    GET    200
    ...    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${FEATURE}    visible
    # The "silently swallowed 403" regression surfaced as this banner.
    Get Element Count    .form-error    ==    0
    Wait For Elements State    ${MODEL_SELECT}    visible

a second user can change the model and it persists (PATCH 200, no banner)
    ${id}=    Create Session Via API    Collaborator changes model
    Open Shared Link As Other User
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${FEATURE}    visible

    ${current}=    Get Property    ${MODEL_SELECT}    value
    ${options}=    Evaluate JavaScript    ${MODEL_SELECT} option
    ...    (els) => els.map((el) => el.value)
    ...    all_elements=True
    Remove Values From List    ${options}    ${current}
    Should Not Be Empty    ${options}    msg=need a second model option to select
    ${target}=    Set Variable    ${options}[0]

    # Selecting a new model fires a PATCH: it must succeed for a non-owner.
    Expect Response Status    /api/sessions/${id}    PATCH    200
    ...    Select Options By    ${MODEL_SELECT}    value    ${target}
    Get Element Count    .form-error    ==    0

    # Reload: the change persisted (the write really landed, not just an
    # optimistic UI update that got rolled back).
    Reload
    Wait For Elements State    ${FEATURE}    visible
    Get Property    ${MODEL_SELECT}    value    ==    ${target}

a second user can save a new prompt (modal closes, no banner)
    ${id}=    Create Session Via API    Collaborator edits prompt
    Open Shared Link As Other User
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${FEATURE}    visible

    Click    .session-edit-prompt-btn
    Wait For Elements State    ${PROMPT_MODAL}    visible
    Fill Text    .session-prompt-textarea    ${PROMPT}
    Expect Response Status    /api/sessions/${id}    PATCH    200
    ...    Click    .session-prompt-save

    # Success path: modal closes, no banner. The old bug closed the modal even
    # on a 403, so the 200 above is asserted independently.
    Wait For Elements State    ${PROMPT_MODAL}    hidden
    Get Element Count    .form-error    ==    0


*** Keywords ***
Open Shared Link As Other User
    [Documentation]    Open a second context as user2 and make its page current.
    ${page}=    Open Second Context    ${OTHER_STATE}
    Switch Page    ${page}    context=ALL
