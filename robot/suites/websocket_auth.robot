*** Settings ***
Documentation       Port of e2e/websocket-auth.spec.ts (ENG-005). The sync
...                 WebSocket must refuse an unauthenticated upgrade before any
...                 room is joined or any document/awareness state is sent.
...                 Each test probes the single server on :3000 with a raw
...                 socket (WebSocketProbe.py, no browser), so the Cookie header
...                 is exactly what the test passes. The owner page is used only
...                 to create sessions and to read the authenticated cookies.

Library             ../libraries/WebSocketProbe.py
Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk6    websocket-auth


*** Variables ***
${WS_BASE}          ${BASE_URL.replace("http", "ws", 1)}


*** Test Cases ***
unauthenticated upgrade is refused with 401 — no room joined, no data sent
    # A real session keeps the room name well-formed: even a valid room is
    # refused without a session cookie.
    ${id}=    Create Session Via API    WS auth negative test
    ${result}=    Probe WebSocket Upgrade    ${WS_BASE}/session-${id}
    Should Not Be True    ${result}[opened]    msg=upgrade must not open without a session cookie
    Should Be Equal As Integers    ${result}[status]    401
    Should Not Be True    ${result}[received_data]    msg=no document/awareness state may be sent

authenticated upgrade to a valid room succeeds
    ${id}=    Create Session Via API    WS auth positive test
    # Reuse the browser context's authenticated session cookie on the raw socket.
    ${cookie}=    Cookie Header From Context
    ${result}=    Probe WebSocket Upgrade    ${WS_BASE}/session-${id}    ${cookie}
    Should Be True    ${result}[opened]    msg=a valid session cookie must be accepted
    # Sync step 1 is sent immediately on connect, so authenticated clients get data.
    Should Be True    ${result}[received_data]

authenticated upgrade to a malformed room is refused
    ${cookie}=    Cookie Header From Context
    ${result}=    Probe WebSocket Upgrade    ${WS_BASE}/default    ${cookie}
    Should Not Be True    ${result}[opened]    msg=a malformed room name must be refused even when authenticated
    Should Be Equal As Integers    ${result}[status]    401
