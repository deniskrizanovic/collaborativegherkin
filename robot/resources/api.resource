*** Settings ***
Documentation       REST keywords for the browser-free API-contract suites
...                 (design D15). Equivalent of Playwright's
...                 `request.newContext({ storageState })`: an HTTP session
...                 that carries one user's NextAuth cookie and nothing else.

Library             OperatingSystem
Library             RequestsLibrary
Resource            variables.resource


*** Keywords ***
Create API Session For
    [Documentation]    Open RequestsLibrary session ${alias} against ${BASE_URL},
    ...    signed in as the user in ${storage_state} (a Playwright storage-state
    ...    JSON). Only the `authjs.session-token` cookie is sent, as a
    ...    `Cookie` header: RequestsLibrary keeps `cookies=` in one library-wide
    ...    slot, so the last `Create Session` would sign in every alias.
    [Arguments]    ${alias}    ${storage_state}
    ${json}=    Get File    ${storage_state}
    ${token}=    Evaluate
    ...    next(c["value"] for c in json.loads($json)["cookies"] if c["name"] == "authjs.session-token")
    ...    modules=json
    ${headers}=    Create Dictionary    Cookie=authjs.session-token=${token}
    Create Session    ${alias}    ${BASE_URL}    headers=${headers}

Create Session As
    [Documentation]    POST /api/sessions on RequestsLibrary session ${alias}
    ...    and return the new session id.
    [Arguments]    ${alias}    ${title}
    ${body}=    Create Dictionary    title=${title}
    ${response}=    POST On Session    ${alias}    /api/sessions    json=${body}    expected_status=201
    RETURN    ${response.json()}[id]
