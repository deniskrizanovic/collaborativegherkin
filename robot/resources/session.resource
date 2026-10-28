*** Settings ***
Documentation       Session and editor keywords: Robot ports of e2e/helpers.ts.

Library             Browser
Resource            common.resource


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

Type Into Block
    [Documentation]    Click the first block of ${type} and type ${text}.
    [Arguments]    ${type}    ${text}
    Click    [data-gherkin-type="${type}"] >> nth=0
    Keyboard Input    type    ${text}

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

Last Index Of
    [Documentation]    Return the index of the last ${value} in ${list}
    ...    (JavaScript `lastIndexOf`), or -1 when absent.
    [Arguments]    ${list}    ${value}
    ${index}=    Evaluate    len($list) - 1 - $list[::-1].index($value) if $value in $list else -1
    RETURN    ${index}

Texts Of All
    [Documentation]    Return the textContent of every element matching
    ...    ${selector} (Playwright `allTextContents`).
    [Arguments]    ${selector}
    ${texts}=    Evaluate JavaScript    ${selector}
    ...    (els) => els.map((el) => el.textContent ?? "")
    ...    all_elements=True
    RETURN    ${texts}

Toolbar Button Texts
    [Documentation]    Return the label of every toolbar button.
    ${texts}=    Texts Of All    .gherkin-toolbar-btn
    RETURN    ${texts}

Toolbar Button
    [Documentation]    Return the selector for the toolbar button labelled ${label}.
    [Arguments]    ${label}
    RETURN    .gherkin-toolbar-btn:has-text("${label}")
