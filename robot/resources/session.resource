*** Settings ***
Documentation       Session and editor keywords: Robot ports of e2e/helpers.ts.

Library             Browser
Resource            common.resource


*** Keywords ***
Create Session Via API
    [Documentation]    POST /api/sessions using the current page's cookies and
    ...    return the new session id. Port of helpers.ts `createSession`.
    ...    `Http` runs fetch inside the page, so a fresh page (about:blank,
    ...    no origin) is first pointed at the app to get a same-origin context.
    [Arguments]    ${title}
    ${url}=    Get Url
    IF    not $url.startswith($BASE_URL)    Go To    ${BASE_URL}
    ${payload}=    Evaluate    json.dumps({"title": $title})    modules=json
    ${response}=    Http    ${BASE_URL}/api/sessions    POST    ${payload}
    Should Be Equal As Integers    ${response}[status]    201
    RETURN    ${response}[body][id]

Open Session
    [Documentation]    Create a session, open it, wait for the editor and click
    ...    the Feature block so Tiptap has focus. Port of helpers.ts `openSession`.
    [Arguments]    ${title}=Test session
    ${id}=    Create Session Via API    ${title}
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    [data-gherkin-type="feature"]    visible
    Click    [data-gherkin-type="feature"]
    RETURN    ${id}

Press Enter And Wait For Block
    [Documentation]    Press Enter, wait until one more block of ${type} exists,
    ...    then click the last one. Port of helpers.ts `pressEnterAndWait`:
    ...    never assume a keypress has taken effect.
    [Arguments]    ${type}
    ${selector}=    Set Variable    [data-gherkin-type="${type}"]
    ${before}=    Get Element Count    ${selector}
    Keyboard Key    press    Enter
    Get Element Count    ${selector}    >    ${before}
    Click    ${selector} >> nth=-1

Click Editor
    [Documentation]    Click the editor surface. Port of helpers.ts `clickEditor`.
    Click    .gherkin-editor

Block Types In Editor
    [Documentation]    Return the `data-gherkin-type` of every block in the
    ...    editor, in document order (Playwright `evaluateAll`).
    ${types}=    Evaluate JavaScript    .gherkin-editor [data-gherkin-type]
    ...    (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    ...    all_elements=True
    RETURN    ${types}

Toolbar Button
    [Documentation]    Return the selector for the toolbar button labelled ${label}.
    [Arguments]    ${label}
    RETURN    .gherkin-toolbar-btn:has-text("${label}")
