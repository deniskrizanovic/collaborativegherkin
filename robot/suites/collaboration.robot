*** Settings ***
Documentation       Port of e2e/collaboration.spec.ts — spec §3.5, real-time
...                 collaboration. Uses two separate browser contexts so
...                 BroadcastChannel cannot bridge them: all Y.js sync must flow
...                 through the WebSocket server, so a dead or broken ws server
...                 fails these tests where same-context tests would pass.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk5    collaboration


*** Test Cases ***
SC-3.5.1: Change by one user is visible to all in real time
    ${id}=    Create Session Via API    Collab test
    ${page1}=    Open Session Page    ${id}
    ${page2}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${page2}    context=ALL
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${BLOCK_TYPE}[feature]    visible

    Switch Page    ${page1}    context=ALL
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Input    type    Shared feature

    Switch Page    ${page2}    context=ALL
    Wait For Condition    Text    ${BLOCK_TYPE}[feature]    *=    Shared feature    timeout=5s

SC-3.1.2: New document seeded with 5 scaffold blocks once — second joiner does not re-seed
    ${id}=    Create Session Via API    Seed race test
    ${page1}=    Open Session Page    ${id}
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Input    type    Do not wipe me

    ${page2}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${page2}    context=ALL
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${BLOCK_TYPE}[feature]    visible

    Wait For Condition    Text    ${BLOCK_TYPE}[feature]    *=    Do not wipe me    timeout=5s
    Switch Page    ${page1}    context=ALL
    Wait For Condition    Text    ${BLOCK_TYPE}[feature]    *=    Do not wipe me    timeout=5s

SC-3.5.2: Remote user cursors visible in distinct colour
    [Tags]    skip
    Skip    @tiptap/extension-collaboration-cursor has no Tiptap 3 stable release yet; skipped until available
    ${id}=    Create Session Via API    Cursor test
    ${page1}=    Open Session Page    ${id}
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Input    type    A feature

    ${page2}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${page2}    context=ALL
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${BLOCK_TYPE}[feature]    visible
    Click    ${BLOCK_TYPE}[feature]

    Switch Page    ${page1}    context=ALL
    Wait For Elements State    .collaboration-cursor__caret    visible    timeout=5s

