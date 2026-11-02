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
...                 ${IMAGE_PAGES}: page id of each user's editor in the image
...                 removal scenario; the first user selects the image, the
...                 second removes it.
...                 ${CONTENT_BEFORE}: the first user's editor before the image
...                 is removed (`Remember Editor`).
...                 ${TABLE_PAGES}: page id of each user's editor in the table
...                 focus scenario; the first user inserts the table, the
...                 second has the cursor in a block.

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

two users are in the same session and the first user has an image block selected — ${where:image in the middle|image last}
    [Documentation]    The first user builds Then, image, And (or Then, image
    ...    for image last) and selects the image; a second, isolated context
    ...    opens the same session. Ends on the first user's page.
    ...    Sets: ${IMAGE_PAGES}, ${CONTENT_BEFORE}.
    ${id}=    Build Then Image And    image_last=${{"${where}" == "image last"}}
    ${ids}=    Get Page Ids    CURRENT    CURRENT    CURRENT
    ${second}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${second}    context=ALL
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    ${IMAGE_BLOCK}    visible
    Switch Page    ${ids}[0]    context=ALL
    Select Image
    Remember Editor
    @{pages}=    Create List    ${ids}[0]    ${second}
    Set Test Variable    ${IMAGE_PAGES}    ${pages}

two users are editing the same session and the second user's cursor is in a Gherkin block
    [Documentation]    Create a session and open it in two isolated contexts;
    ...    the second user puts the cursor in the seeded Then block. Ends on
    ...    the first user's page.
    ...    Sets: ${TABLE_PAGES}.
    ${id}=    Create Session Via API    Table focus collab
    ${first}=    Open Session Page    ${id}
    ${second}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${second}    context=ALL
    Open Session Page    ${id}
    ${then}=    Block Selector    then
    Click Block    ${then}
    Switch Page    ${first}    context=ALL
    @{pages}=    Create List    ${first}    ${second}
    Set Test Variable    ${TABLE_PAGES}    ${pages}

# ---- When ----------------------------------------------------------------

the first user inserts a data table
    [Documentation]    The first user inserts a table after the seeded Given
    ...    block through the toolbar; its first cell takes the first user's
    ...    focus.
    ...    Reads: ${TABLE_PAGES}.
    Require Step State    TABLE_PAGES    two users are editing the same session and the second user's cursor is in a Gherkin block
    Switch Page    ${TABLE_PAGES}[0]    context=ALL
    Insert Table After Block    given
    Wait For Elements State    ${CELL_0_0}    focused

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

the second user removes that image
    [Documentation]    The second user clicks the image and presses Backspace.
    ...    Reads: ${IMAGE_PAGES}.
    Require Step State    IMAGE_PAGES    two users are in the same session and the first user has an image block selected — <where>
    Switch Page    ${IMAGE_PAGES}[1]    context=ALL
    Select Image
    Keyboard Key    press    Backspace
    Get Element Count    ${IMAGE_BLOCK}    ==    0

# ---- Then ----------------------------------------------------------------

the second user sees the new table
    [Documentation]    Reads: ${TABLE_PAGES}.
    Require Step State    TABLE_PAGES    two users are editing the same session and the second user's cursor is in a Gherkin block
    Switch Page    ${TABLE_PAGES}[1]    context=ALL
    Wait For Elements State    ${TABLE}    visible    timeout=5s

text the second user types next appears in the block where their cursor was, not in the table
    [Documentation]    The second user's focus is not in a table cell; the
    ...    text they type lands in their Then block on both users' editors,
    ...    never in the table, and neither page has an error.
    ...    Reads: ${TABLE_PAGES}.
    Require Step State    TABLE_PAGES    two users are editing the same session and the second user's cursor is in a Gherkin block
    Switch Page    ${TABLE_PAGES}[1]    context=ALL
    ${in_cell}=    Evaluate JavaScript    ${None}
    ...    () => !!document.activeElement?.closest("[data-cell]")
    Should Not Be True    ${in_cell}
    Keyboard Input    type    Collaborator marker
    ${then}=    Block Selector    then
    FOR    ${page}    IN    @{TABLE_PAGES}
        Switch Page    ${page}    context=ALL
        Wait For Condition    Text    ${then}    *=    Collaborator marker    timeout=5s
        Get Text    ${TABLE}    not contains    Collaborator marker
        ${errors}=    Get Page Errors
        Should Be Empty    ${errors}
    END

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

the image disappears from the first user's editor
    [Documentation]    Reads: ${IMAGE_PAGES}.
    Require Step State    IMAGE_PAGES    two users are in the same session and the first user has an image block selected — <where>
    Switch Page    ${IMAGE_PAGES}[0]    context=ALL
    Get Element Count    ${IMAGE_BLOCK}    ==    0

the first user can keep typing in the editor
    [Documentation]    The first user types `Still typing`: it lands in one
    ...    Gherkin block, which the second user sees too; the blocks around
    ...    the image keep their text, and the first user's page has no error.
    ...    Reads: ${IMAGE_PAGES}, ${CONTENT_BEFORE}.
    Require Step State    IMAGE_PAGES    two users are in the same session and the first user has an image block selected — <where>
    Switch Page    ${IMAGE_PAGES}[0]    context=ALL
    Keyboard Input    type    Still typing
    ${typed}=    Set Variable    ${BLOCKS}:has-text("Still typing")
    Get Element Count    ${typed}    ==    1
    FOR    ${node}    IN    @{CONTENT_BEFORE}
        IF    "text" in $node
            ${block}=    Set Variable    ${BLOCK_TYPE}[${node}[node]]
            Get Text    ${block}    *=    ${node}[text]
        END
    END
    ${errors}=    Get Page Errors
    Should Be Empty    ${errors}
    Switch Page    ${IMAGE_PAGES}[1]    context=ALL
    Wait For Condition    Element Count    ${typed}    ==    1    timeout=5s

# ---- Technical helpers ---------------------------------------------------

Remember Changed Blocks
    [Documentation]    Record the current page's block types and texts.
    ...    Sets: ${CHANGED_TYPES}, ${CHANGED_TEXTS}.
    ${types}=    Block Types In Editor
    ${texts}=    Texts Of All    ${BLOCKS}
    Set Test Variable    ${CHANGED_TYPES}    ${types}
    Set Test Variable    ${CHANGED_TEXTS}    ${texts}
