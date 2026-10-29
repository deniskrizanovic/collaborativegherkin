*** Settings ***
Documentation       Port of e2e/home.spec.ts — home page, session list, create form,
...                 session header and invite link. SC-1.2.4 mocks the
...                 create call with the routes.cjs extension (chunk 4).

Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk1    home


*** Variables ***
${TITLE_INPUT}      .nsw-form__input
${SUBMIT}           button[type="submit"]


*** Test Cases ***
SC-1.1.2: No sessions shows empty state
    # Delete all sessions via the API so the home page is genuinely empty.
    ${list}=    Call API    GET    /api/sessions
    FOR    ${session}    IN    @{list}[body]
        Call API    DELETE    /api/sessions/${session}[id]
    END
    Go To    ${BASE_URL}/
    Wait For Elements State    .sessions-list    hidden
    Wait For Elements State    .create-form    visible

SC-1.1.1: Sessions listed newest first — list visible after creating
    ${id}=    Create Session Via API    List test session
    Go To    ${BASE_URL}/
    Wait For Elements State    .session-link >> nth=0    visible
    Get Attribute    .session-link >> nth=0    href    ==    /sessions/${id}

SC-1.1.1: Sessions listed newest first — order
    Create Session Via API    Session Alpha
    Create Session Via API    Session Beta
    Go To    ${BASE_URL}/
    Get Text    .session-name >> nth=0    ==    Session Beta

SC-1.2.2: Empty title disables Create button
    Go To    ${BASE_URL}/
    Wait For Elements State    ${SUBMIT}    disabled

SC-1.2.3: Title over 200 chars shows validation error
    Go To    ${BASE_URL}/
    ${long_title}=    Evaluate    "a" * 201
    # Bypass maxLength and trigger React's synthetic onChange via the native value setter.
    Evaluate JavaScript    ${TITLE_INPUT}
    ...    (el, value) => {
    ...        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    ...        setter.call(el, value);
    ...        el.dispatchEvent(new Event("input", { bubbles: true }));
    ...        el.dispatchEvent(new Event("change", { bubbles: true }));
    ...    }
    ...    arg=${long_title}
    Click    ${SUBMIT}
    Wait For Elements State    .form-error    visible
    Get Url    ==    ${BASE_URL}/

SC-1.2.4: Server error shows error message
    [Tags]    -chunk1    chunk4
    # Only POST gets the 500; the GET that lists sessions reaches the server.
    Fulfill Route    **/api/sessions    500    {"error": "Server error"}    POST
    Go To    ${BASE_URL}/
    Fill Text    ${TITLE_INPUT}    My session
    Click    ${SUBMIT}
    Wait For Elements State    .form-error    visible

SC-1.2.1: Valid title creates session and redirects
    Go To    ${BASE_URL}/
    Fill Text    ${TITLE_INPUT}    Redirect test session
    Click    ${SUBMIT}
    Get Url    matches    /sessions/

SC-1.3.1: Valid session ID loads editor with title
    ${title}=    Set Variable    Header title session
    ${id}=    Create Session Via API    ${title}
    Go To    ${BASE_URL}/sessions/${id}
    Get Text    .session-title    ==    ${title}

SC-1.4.1: Copy invite link copies URL and shows Copied!
    Grant Permissions    clipboard-read    clipboard-write
    Open Session    Copy link session
    Wait For Elements State    .copy-link-btn    visible
    Get Text    .copy-link-btn    ==    Copy invite link
    Click    .copy-link-btn
    Get Text    .copy-link-btn    ==    Copied!
