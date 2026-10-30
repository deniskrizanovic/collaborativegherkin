*** Settings ***
Documentation       Session keywords: the session lifecycle, REST calls made
...                 through the page, extra browser contexts, cookies and
...                 response waits. Robot ports of e2e/helpers.ts
...                 `createSession` / `openSession` and of the context and
...                 response patterns of the e2e specs.
...
...                 Also the session page's AI review controls (spec §8): their
...                 selectors, the review and settings routes the tests mock,
...                 and the body of a mocked review.
...
...                 Editor blocks, the toolbar, the picker, images and tables
...                 are in editor.resource; temp files and downloads in
...                 files.resource.

Resource            common.resource
Resource            editor.resource


*** Variables ***
# AI review controls of the session page (src/app/sessions/[id]/SessionView.tsx).
${SESSION_ACTIONS}      .session-actions
${REVIEW_BUTTON}        .session-review-btn
${MODEL_SELECT}         .session-model-select
${REVIEW_MODAL}         .session-review-modal
${REVIEW_MODAL_HEADER}    .session-review-modal-header
${REVIEW_MODAL_TITLE}    .session-review-modal-title
${REVIEW_MODAL_BODY}    .session-review-modal-body
${REVIEW_MODAL_CLOSE}    .session-review-modal-close
${VIEW_LAST_BUTTON}     .session-view-last-review-btn
${EDIT_PROMPT_BUTTON}    .session-edit-prompt-btn
${PROMPT_MODAL}         .session-prompt-modal
${PROMPT_TEXTAREA}      .session-prompt-textarea
${PROMPT_SAVE}          .session-prompt-save
${PROMPT_CANCEL}        .session-prompt-cancel
${SETTINGS_ERROR}       .form-error
${REVIEW_URL}           /api/llm-review
# Session settings GET. Matches /api/sessions/<id> but not /api/sessions, so
# `Create Session Via API` is never intercepted.
${SETTINGS_URL}         **/api/sessions/*
# Opening words of DEFAULT_PROMPT in src/lib/llm-constants.ts.
${DEFAULT_PROMPT_START}    You are an excellent Software Requirements Analyst.


*** Keywords ***
Call API
    [Documentation]    Send ${method} ${path} with the current page's cookies and
    ...    return the response dict (status, body, ...). Equivalent of
    ...    Playwright's `page.request`. `Http` runs fetch inside the page, so a
    ...    fresh page (about:blank, no origin) is first pointed at the app.
    [Arguments]    ${method}    ${path}    ${body}=${None}
    ${url}=    Get Url
    IF    not $url.startswith($BASE_URL)    Go To    ${BASE_URL}
    ${response}=    Http    ${BASE_URL}${path}    ${method}    ${body}
    RETURN    ${response}

Create Session Via API
    [Documentation]    POST /api/sessions and return the new session id.
    ...    Port of helpers.ts `createSession`.
    [Arguments]    ${title}
    ${payload}=    Evaluate    json.dumps({"title": $title})    modules=json
    ${response}=    Call API    POST    /api/sessions    ${payload}
    Should Be Equal As Integers    ${response}[status]    201
    RETURN    ${response}[body][id]

Open Session
    [Documentation]    Create a session, open it, wait for the editor and click
    ...    the Feature block so Tiptap has focus. Port of helpers.ts `openSession`.
    [Arguments]    ${title}=Test session
    ${id}=    Create Session Via API    ${title}
    Open Session Page    ${id}
    ${feature}=    Block Selector    feature
    Click    ${feature}
    RETURN    ${id}

Open Session Page
    [Documentation]    Open session ${id} on the current page, wait for the
    ...    editor, and return the page id. No click, so focus is left to the
    ...    caller (the collaboration tests click where they type).
    [Arguments]    ${id}
    Go To    ${BASE_URL}/sessions/${id}
    ${feature}=    Block Selector    feature
    Wait For Elements State    ${feature}    visible
    ${ids}=    Get Page Ids    CURRENT    CURRENT    CURRENT
    RETURN    ${ids}[0]

Open Second Context
    [Documentation]    Open a second, isolated context signed in as the user in
    ...    ${storage_state}, with its own page, and return that page's id. The
    ...    first page is switched back to before returning, so the caller always
    ...    names the page it acts on with `Switch Page    <id>    context=ALL`.
    ...    Browser closes this context at the end of the test (design D6).
    [Arguments]    ${storage_state}
    ${first}=    Get Page Ids    CURRENT    CURRENT    CURRENT
    ${tracing}=    Trace File For Test    -second
    New Context    storageState=${storage_state}    baseURL=${BASE_URL}    tracing=${tracing}
    ${second}=    New Page
    Switch Page    ${first}[0]    context=ALL
    RETURN    ${second}[page_id]

Cookie Header From Context
    [Documentation]    Return the current context's cookies as one `Cookie`
    ...    header value, `name=value; …`. Port of the
    ...    `cookies.map(...).join("; ")` in websocket-auth.spec.ts.
    ${cookies}=    Get Cookies
    ${header}=    Evaluate    "; ".join(f"{c['name']}={c['value']}" for c in $cookies)
    RETURN    ${header}

Expect Response Status
    [Documentation]    Run ${action} with @{args} and assert the response to
    ...    ${method} on a URL containing ${url_part} has ${status}. Port of
    ...    `Promise.all([page.waitForResponse(pred), action])`: the wait starts
    ...    before the action, so a fast response cannot be missed.
    [Arguments]    ${url_part}    ${method}    ${status}    ${action}    @{args}
    ${promise}=    Promise To    Wait For Response
    ...    matcher=(r) => r.url().includes("${url_part}") && r.request().method() === "${method}"
    Run Keyword    ${action}    @{args}
    ${response}=    Wait For    ${promise}
    Should Be Equal As Integers    ${response}[status]    ${status}

Session Settings Via API
    [Documentation]    GET /api/sessions/${id} and return its body, the
    ...    session's stored AI settings (`model` and `prompt`, each null when
    ...    unset).
    [Arguments]    ${id}
    ${response}=    Call API    GET    /api/sessions/${id}
    Should Be Equal As Integers    ${response}[status]    200
    RETURN    ${response}[body]

Store Session Settings Via API
    [Documentation]    PATCH /api/sessions/${id} with ${settings}, a dictionary
    ...    with `model`, `prompt` or both, then read the settings back and check
    ...    that each value was stored.
    [Arguments]    ${id}    ${settings}
    ${body}=    Evaluate    json.dumps(dict($settings))    modules=json
    ${response}=    Call API    PATCH    /api/sessions/${id}    ${body}
    Should Be Equal As Integers    ${response}[status]    200
    ${stored}=    Session Settings Via API    ${id}
    FOR    ${key}    ${value}    IN    &{settings}
        Should Be Equal    ${stored}[${key}]    ${value}
    END

Review Body
    [Documentation]    Return the JSON body of a successful review: {"result": ${result}}.
    [Arguments]    ${result}
    ${body}=    Evaluate    json.dumps({"result": $result})    modules=json
    RETURN    ${body}
