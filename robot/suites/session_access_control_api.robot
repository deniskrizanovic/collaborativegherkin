*** Settings ***
Documentation       Port of the API-contract block of
...                 e2e/session-access-control.spec.ts (ADR-0005). No browser:
...                 RequestsLibrary sessions carry each user's cookie (design D15).
...
...                 A session id is an unguessable cuid shared as an invite link
...                 (a capability URL), so any authenticated holder of the id may
...                 READ (GET) and EDIT settings (PATCH). Only the irreversible
...                 DELETE is owner-only. `owner` is user.json; `other` is a
...                 second, distinct user (user2.json) who holds the id.

Resource            ../resources/api.resource

Suite Setup         Open Owner And Other API Sessions
Suite Teardown      Delete All Sessions

Test Tags           chunk5    session-access-control    api


*** Test Cases ***
non-owner can GET a session they hold the id for (200)
    ${id}=    Create Session As    owner    Collaborator-readable session
    ${response}=    GET On Session    other    /api/sessions/${id}    expected_status=200
    Should Be Equal    ${response.json()}[id]    ${id}

non-owner can PATCH a session's settings (200)
    ${id}=    Create Session As    owner    Collaborator-editable session
    ${body}=    Create Dictionary    prompt=A collaborator-supplied prompt that is long enough.
    PATCH On Session    other    /api/sessions/${id}    json=${body}    expected_status=200

non-owner cannot DELETE a session (403) — deletion stays owner-only
    ${id}=    Create Session As    owner    Owner-only-delete session
    DELETE On Session    other    /api/sessions/${id}    expected_status=403
    # And the owner can still read it: the failed delete changed nothing.
    GET On Session    owner    /api/sessions/${id}    expected_status=200


*** Keywords ***
Open Owner And Other API Sessions
    Create API Session For    owner    ${OWNER_STATE}
    Create API Session For    other    ${OTHER_STATE}
