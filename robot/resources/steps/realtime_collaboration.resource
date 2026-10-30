*** Settings ***
Documentation       Business-language steps for
...                 openspec/specs/realtime-collaboration/spec.md.
...
...                 Each keyword is named after a GIVEN/WHEN/THEN line of that
...                 spec, so a `bdd` test repeats its scenario word for word.
...                 Steps whose text also appears in another capability are in
...                 shared.resource. Title Case keywords at the bottom are
...                 technical helpers that tests never call.
...
...                 Each user is a separate browser context (`Open Second
...                 Context`), so BroadcastChannel cannot bridge them and every
...                 change has to travel through the WebSocket server.
...
...                 Shared variables set by the keywords of this file:
...                 ${USER_PAGES}: page id of each user's editor; the first is
...                 the user who makes the change.
...                 ${CHANGED_TYPES}, ${CHANGED_TEXTS}: block types and texts in
...                 the changing user's editor once the change is made.

Library             Collections
Resource            ../session.resource
Resource            ../editor.resource
Resource            shared.resource


*** Keywords ***
# ---- Given ---------------------------------------------------------------

two or more users have the same session URL open
    [Documentation]    Create a session and open it in two isolated contexts
    ...    signed in as the same user. Ends on the first user's page.
    ...    Sets: ${USER_PAGES}.
    ${id}=    Create Session Via API    Collab test
    ${first}=    Open Session Page    ${id}
    ${second}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${second}    context=ALL
    Open Session Page    ${id}
    Switch Page    ${first}    context=ALL
    @{pages}=    Create List    ${first}    ${second}
    Set Test Variable    ${USER_PAGES}    ${pages}

# ---- When ----------------------------------------------------------------

one user types or inserts a block — types
    [Documentation]    The first user types into the Feature block.
    ...    Reads: ${USER_PAGES}. Sets: ${CHANGED_TYPES}, ${CHANGED_TEXTS}.
    Require Step State    USER_PAGES    two or more users have the same session URL open
    Switch Page    ${USER_PAGES}[0]    context=ALL
    ${feature}=    Block Selector    feature
    Click Block    ${feature}
    Keyboard Input    type    Shared feature
    Get Text    ${feature}    ==    Shared feature
    Remember Changed Blocks

one user types or inserts a block — inserts a block
    [Documentation]    The first user inserts a Scenario block after the
    ...    Feature block through the toolbar.
    ...    Reads: ${USER_PAGES}. Sets: ${CHANGED_TYPES}, ${CHANGED_TEXTS}.
    Require Step State    USER_PAGES    two or more users have the same session URL open
    Switch Page    ${USER_PAGES}[0]    context=ALL
    ${before}=    Get Element Count    ${BLOCKS}
    ${feature}=    Block Selector    feature
    Click Block    ${feature}
    Click Toolbar Button    Scenario
    Get Element Count    ${BLOCKS}    ==    ${before + 1}
    Remember Changed Blocks

# ---- Then ----------------------------------------------------------------

all other connected users see the change reflected in their editors in real time
    [Documentation]    Within 5 s, every other user's editor shows the same
    ...    blocks, in the same order, with the same types and texts, as the
    ...    changing user's editor.
    ...    Reads: ${USER_PAGES}, ${CHANGED_TYPES}, ${CHANGED_TEXTS}.
    Require Step State    CHANGED_TYPES    one user types or inserts a block — <change>
    ${count}=    Get Length    ${CHANGED_TYPES}
    FOR    ${page}    IN    @{USER_PAGES}[1:]
        Switch Page    ${page}    context=ALL
        Wait For Condition    Element Count    ${BLOCKS}    ==    ${count}    timeout=5s
        FOR    ${index}    IN RANGE    ${count}
            ${block}=    Set Variable    ${BLOCKS} >> nth=${index}
            Wait For Condition    Attribute    ${block}    data-gherkin-type    ==    ${CHANGED_TYPES}[${index}]    timeout=5s
            Wait For Condition    Property    ${block}    textContent    ==    ${CHANGED_TEXTS}[${index}]    timeout=5s
        END
    END

# ---- Technical helpers ---------------------------------------------------

Remember Changed Blocks
    [Documentation]    Record the current page's block types and texts.
    ...    Sets: ${CHANGED_TYPES}, ${CHANGED_TEXTS}.
    ${types}=    Block Types In Editor
    ${texts}=    Texts Of All    ${BLOCKS}
    Set Test Variable    ${CHANGED_TYPES}    ${types}
    Set Test Variable    ${CHANGED_TEXTS}    ${texts}
