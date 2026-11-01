*** Settings ***
Documentation       Business-language steps for openspec/specs/gherkin-editor/spec.md.
...
...                 Each keyword is named after a GIVEN/WHEN/THEN line of that
...                 spec, so a `bdd` test repeats its scenario word for word.
...                 Steps whose text also appears in another capability are in
...                 shared.resource. Title Case keywords at the bottom are
...                 technical helpers that tests never call.
...
...                 Shared variables set by the keywords of this file:
...                 ${PREVIOUS_BLOCK}: type of the block before the cursor's new
...                 line, whose valid next blocks the picker lists.
...                 ${CONTENT_BEFORE}, ${TYPES_BEFORE}, ${BLOCKS_BEFORE},
...                 ${CURRENT_NODE_INDEX}: the editor before the action (top-level
...                 nodes, block types, block count, the cursor's node), all set
...                 through `Remember Editor`.
...                 ${OPTION_COUNT}: number of items in the open picker.
...                 ${FOCUSED_INDEX}: index of the focused picker item.
...                 ${TARGET_INDEX}: index of the block the picker replaces.
...                 ${FOCUSED_TYPE}: block type of the focused picker item.
...                 ${CURRENT_BLOCK}: type of the block the cursor is inside,
...                 whose valid next blocks the toolbar shows.
...                 ${CURRENT_INDEX}: index, among the editor's blocks, of the
...                 block the cursor is in before an insert.
...                 ${NEW_BLOCK_INDEX}: index, among the editor's blocks, of the
...                 block an insert added.
...                 ${CHOSEN_TYPE}: block type of the toolbar button clicked.
...                 ${SESSION_ID}: id of the session created by a Given step.
...                 ${FIRST_PAGE}: page id of the first user's editor.
...                 ${UPLOAD_PROMISE}: the armed file-chooser upload of an image.

Library             Collections
Resource            ../session.resource
Resource            ../editor.resource
Resource            ../files.resource
Resource            shared.resource


*** Variables ***
# Valid / invalid next-block labels per context block type, as asserted by
# the technical tests (e2e/block-picker.spec.ts, e2e/toolbar.spec.ts). Test
# data, not rules: filled only for the contexts the tests visit, never derived
# from canFollow() (design D4).
&{VALID_NEXT_LABELS}        feature=${{["Rule", "Background", "Scenario"]}}
&{INVALID_NEXT_LABELS}      feature=${{["Feature"]}}
# Keyword label of each seeded scaffold block, as the editor's CSS displays it
# (src/app/globals.css, `p[data-gherkin-type]::before`).
@{SCAFFOLD_LABELS}          Feature:    Scenario:    Given    When    Then
# Text a cursor step types to find out which block the cursor is in.
${CURSOR_MARKER}            cursor-is-here


*** Keywords ***
# ---- Given ---------------------------------------------------------------

the Y.js document is empty after synchronisation
    [Documentation]    Create a session through the API. Nobody has opened it,
    ...    so its Y.js document is empty.
    ...    Sets: ${SESSION_ID}.
    ${id}=    Create Session Via API    Seed test
    Set Test Variable    ${SESSION_ID}    ${id}

the cursor is inside a block
    [Documentation]    Open a fresh session. Open Session ends with a click on
    ...    the Feature block, so the cursor is inside it.
    ...    Sets: ${CURRENT_BLOCK}.
    Open Session
    Set Test Variable    ${CURRENT_BLOCK}    Feature

the cursor is inside a block of type ${type}
    [Documentation]    Open a fresh session and click the last ${type} block.
    ...    ${type} must be a seeded type (Feature, Scenario, Given, When, Then).
    ...    Sets: ${CURRENT_BLOCK}.
    Open Session
    ${selector}=    Block Selector    ${type.lower()}
    Click Block    ${selector} >> nth=-1
    Set Test Variable    ${CURRENT_BLOCK}    ${type}

the cursor is at the end of a block of type ${type}
    [Documentation]    Open a fresh session and put the cursor at the end of the
    ...    last ${type} block (`Put Cursor At End Of Block`, which first inserts
    ...    an And, But, Background or Rule block through the toolbar).
    ...    Sets: ${CURRENT_INDEX}, ${BLOCKS_BEFORE}, ${TYPES_BEFORE}.
    Open Session
    Put Cursor At End Of Block    ${type.lower()}
    Remember Editor
    ${index}=    Last Index Of    ${TYPES_BEFORE}    ${type.lower()}
    Set Test Variable    ${CURRENT_INDEX}    ${index}

a ${block:given|scenario} block immediately follows a then, and, or but block — ${previous:then|and|but}
    [Documentation]    Open a fresh session and build the scaffold to Then. For
    ...    and / but, insert that block after the Then through the toolbar. Then
    ...    insert a ${block} block right after the ${previous} block through the
    ...    toolbar and check where it landed.
    ...    Sets: ${CURRENT_INDEX}, ${BLOCKS_BEFORE}, ${TYPES_BEFORE},
    ...    ${NEW_BLOCK_INDEX}.
    Open Session
    Build Scaffold To Then
    ${selector}=    Block Selector    ${previous}
    IF    "${previous}" != "then"
        Click Toolbar Button    ${previous.title()}
        Get Element Count    ${selector}    >    0
        Click Block    ${selector} >> nth=-1
    END
    Remember Editor
    ${index}=    Last Index Of    ${TYPES_BEFORE}    ${previous}
    Set Test Variable    ${CURRENT_INDEX}    ${index}
    Click Toolbar Button    ${block.title()}
    Block Should Be Inserted After Current Block    ${block}

the cursor is on a step block (given, when, then, and, or but) or on a data table block that follows a step — ${type}
    [Documentation]    Open a fresh session and click the last ${type} block.
    ...    ${type} must be a seeded step type (Given, When, Then).
    the cursor is inside a block of type ${type}

the user types / and the current/previous block is a step type
    [Documentation]    Build the scaffold to Then (a step type) and type `/` on
    ...    the new line after it.
    Open Session
    Build Scaffold To Then
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    the user types /
    a block picker menu opens

a data table is in the document
    [Documentation]    Open a fresh session and insert a 2×2 data table after
    ...    the seeded Given block through the toolbar.
    Open Session
    Insert Table After Block    given

the toolbar is showing valid block types
    [Documentation]    Open a fresh session (cursor on the Feature block) and
    ...    wait for the toolbar.
    ...    Sets: ${CURRENT_INDEX}, ${BLOCKS_BEFORE}, ${TYPES_BEFORE}.
    Open Session
    Wait For Elements State    ${TOOLBAR_BUTTON} >> nth=0    visible
    Remember Editor
    ${index}=    Get Index From List    ${TYPES_BEFORE}    feature
    Set Test Variable    ${CURRENT_INDEX}    ${index}

the cursor is inside a block on a new line after ${type}
    [Documentation]    Put the cursor on a new line after the last ${type} block
    ...    (click it, End, Enter). Opens a session first if none is open and
    ...    closes a picker left open by an earlier step, so a test can visit
    ...    several contexts.
    ...    Sets: ${PREVIOUS_BLOCK}.
    ${url}=    Get Url
    IF    "/sessions/" not in $url    Open Session
    Close Picker If Open
    Set Test Variable    ${PREVIOUS_BLOCK}    ${type}
    ${selector}=    Block Selector    ${type.lower()}
    Click Block    ${selector} >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter

the block picker menu is open
    [Documentation]    Open the picker on a new line after the Feature block,
    ...    where it lists several items (on the Feature block itself it lists
    ...    only Feature). Checks that the first item has focus.
    ...    Sets: ${PREVIOUS_BLOCK}, ${BLOCKS_BEFORE}, ${TYPES_BEFORE},
    ...    ${OPTION_COUNT}, ${FOCUSED_INDEX}.
    the cursor is inside a block on a new line after Feature
    the user types /
    a block picker menu opens
    Item Should Have Focus    0
    ${count}=    Get Element Count    ${PICKER} >> button
    Set Test Variable    ${OPTION_COUNT}    ${count}
    Remember Editor

the block picker menu is open and an item is focused
    [Documentation]    Open the picker on the seeded Scenario block (replace
    ...    mode) and record the focused item.
    ...    Sets: ${BLOCKS_BEFORE}, ${TYPES_BEFORE}, ${TARGET_INDEX},
    ...    ${FOCUSED_INDEX}, ${FOCUSED_TYPE}.
    Open Session
    Remember Editor
    ${index}=    Get Index From List    ${TYPES_BEFORE}    scenario
    Set Test Variable    ${TARGET_INDEX}    ${index}
    ${scenario}=    Block Selector    scenario
    Click Block    ${scenario}
    the user types /
    a block picker menu opens
    Item Should Have Focus    0
    ${label}=    Get Text    ${PICKER} >> button >> nth=${FOCUSED_INDEX}
    Set Test Variable    ${FOCUSED_TYPE}    ${label.strip().lower().replace(" ", "_")}

an image block follows a Then block and the image is selected
    [Documentation]    Open a fresh session, type into Then, insert an image
    ...    after it (the image is the last node) and select the image.
    ...    Sets: ${CONTENT_BEFORE}, ${TYPES_BEFORE}, ${BLOCKS_BEFORE},
    ...    ${CURRENT_NODE_INDEX} (the image's index).
    Build Then Image And    image_last=${True}
    Select Image
    Remember Editor

a document contains an image block that is not selected
    [Documentation]    Open a fresh session with Then, image, And and check
    ...    that the image is not selected.
    Build Then Image And
    Get Element Count    ${SELECTED_IMAGE}    ==    0

the cursor is at the end of the block directly before an image block
    [Documentation]    Open a fresh session with Then, image, And, click the
    ...    Then block, press End and wait until the editor has the cursor at
    ...    the end of its text (`Wait For Cursor At`).
    Build Then Image And
    ${nodes}=    Document Nodes In Editor
    ${index}=    Evaluate    $nodes.index("image") - 1
    Click Block    ${BLOCK_TYPE}[then]
    Keyboard Key    press    End
    ${text}=    Get Text    ${BLOCK_TYPE}[then]
    Wait For Cursor At    ${index}    ${{len($text)}}
    Get Element Count    ${SELECTED_IMAGE}    ==    0

an image block is selected
    [Documentation]    Open a fresh session with Then, image, And and select
    ...    the image.
    ...    Sets: ${CONTENT_BEFORE}, ${TYPES_BEFORE}, ${BLOCKS_BEFORE},
    ...    ${CURRENT_NODE_INDEX}.
    Build Then Image And
    Select Image
    Remember Editor

an image block between two Gherkin blocks is selected
    [Documentation]    Open a fresh session with Then, image, And and select
    ...    the image.
    ...    Sets: ${CONTENT_BEFORE}, ${TYPES_BEFORE}, ${BLOCKS_BEFORE},
    ...    ${CURRENT_NODE_INDEX}.
    an image block is selected

# ---- When ----------------------------------------------------------------

the first user's editor finishes syncing
    [Documentation]    Open the session and wait for its Feature block, which
    ...    the editor renders only once the document has synced.
    ...    Reads: ${SESSION_ID}. Sets: ${FIRST_PAGE}.
    Require Step State    SESSION_ID    the Y.js document is empty after synchronisation
    ${page}=    Open Session Page    ${SESSION_ID}
    Set Test Variable    ${FIRST_PAGE}    ${page}

the editor toolbar renders
    Wait For Elements State    ${TOOLBAR_BUTTON} >> nth=0    visible

the user clicks a toolbar button labelled ${label}
    [Documentation]    Sets: ${CHOSEN_TYPE}.
    Click Toolbar Button    ${label}
    Set Test Variable    ${CHOSEN_TYPE}    ${label.lower()}

the user types /
    Keyboard Input    type    /

the user clicks the Image toolbar button
    [Documentation]    Arm the file chooser with a 1×1 PNG, then click the
    ...    toolbar's Image button. The PNG is removed by `Remove Temp Files`.
    ...    Sets: ${UPLOAD_PROMISE}, ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Arm Image Upload
    Click Toolbar Button    Image

the user types / and selects Image from the block picker
    [Documentation]    Put the cursor at the end of the last Then block, arm the
    ...    file chooser with a 1×1 PNG, type `/` and click the picker's Image
    ...    item. Then, not the Feature block the session opens on: on the first
    ...    block the picker lists only Feature, without Image. The PNG is
    ...    removed by `Remove Temp Files`.
    ...    Sets: ${UPLOAD_PROMISE}, ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Put Cursor At End Of Block    then
    Arm Image Upload
    the user types /
    a block picker menu opens
    Click    ${PICKER} >> button:has-text("Image")

the user presses Tab inside a cell in row ${row}, column ${column}
    [Documentation]    Click the cell (rows and columns count from 1), wait
    ...    until it has focus, then press Tab.
    Press Key In Cell    ${row}    ${column}    Tab

the user presses Shift+Tab inside a cell in row ${row}, column ${column}
    [Documentation]    Click the cell (rows and columns count from 1), wait
    ...    until it has focus, then press Shift+Tab.
    Press Key In Cell    ${row}    ${column}    Shift+Tab

the user presses the down arrow key
    Keyboard Key    press    ArrowDown

the user presses the up arrow key
    Keyboard Key    press    ArrowUp

the user clicks the item
    [Documentation]    Click the focused item.
    ...    Reads: ${FOCUSED_INDEX}.
    Require Step State    FOCUSED_INDEX    the block picker menu is open and an item is focused
    Click    ${PICKER} >> button >> nth=${FOCUSED_INDEX}

the user clicks outside the menu
    Mouse Button    click    10    10

the user presses ${key:ArrowRight|Backspace}
    Keyboard Key    press    ${key}

the user clicks the image
    Click    ${IMAGE_BLOCK}

the user types a letter or / — ${key:letter|slash}
    [Documentation]    Type `x` for a letter, `/` for a slash.
    ${text}=    Set Variable If    "${key}" == "slash"    /    x
    Keyboard Input    type    ${text}

the user clicks the And toolbar button
    [Documentation]    Sets: ${CHOSEN_TYPE}.
    the user clicks a toolbar button labelled And

# ---- Then ----------------------------------------------------------------

the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then
    [Documentation]    Reads: ${FIRST_PAGE}.
    Require Step State    FIRST_PAGE    the first user's editor finishes syncing
    Get Element Count    ${BLOCKS}    ==    5
    ${types}=    Block Types In Editor
    @{expected}=    Create List    feature    scenario    given    when    then
    Lists Should Be Equal    ${types}    ${expected}
    ${texts}=    Texts Of All    ${BLOCKS}
    Should Be True    all(t == "" for t in $texts)    Not every scaffold block is empty: ${texts}

each scaffold block contains no text — only the keyword label is displayed
    [Documentation]    Each block's text is empty and its `::before` label is
    ...    the keyword in @{SCAFFOLD_LABELS}.
    ...    Reads: ${FIRST_PAGE}.
    Require Step State    FIRST_PAGE    the first user's editor finishes syncing
    Get Element Count    ${BLOCKS}    ==    5
    ${texts}=    Texts Of All    ${BLOCKS}
    Should Be True    all(t == "" for t in $texts)    Not every scaffold block is empty: ${texts}
    ${labels}=    Evaluate JavaScript    ${BLOCKS}
    ...    (els) => els.map((el) => getComputedStyle(el, "::before").content.replace(/^"|"$/g, ""))
    ...    all_elements=True
    Lists Should Be Equal    ${labels}    ${SCAFFOLD_LABELS}

the cursor is placed at the start of the Feature block
    [Documentation]    The page has not been clicked, so the editor's own
    ...    selection is checked: read through the editor (`Cursor Position`),
    ...    it is a bare cursor at offset 0 of the Feature block, and the
    ...    toolbar shows the valid next blocks of Feature (no Feature button).
    ...    Typing is not used: the editor is not focused until the user clicks
    ...    it. Boundary: the browser cannot tell a selection the app set from
    ...    ProseMirror's default one at the start of the document; both put
    ...    the cursor where the line says.
    ...    Reads: ${FIRST_PAGE}.
    Require Step State    FIRST_PAGE    the first user's editor finishes syncing
    ${feature}=    Block Selector    feature
    Wait For Elements State    ${feature}    visible
    ${nodes}=    Document Nodes In Editor
    ${index}=    Get Index From List    ${nodes}    feature
    ${cursor}=    Cursor Position
    Should Be Equal As Integers    ${cursor}[index]    ${index}
    ...    The cursor is in node ${cursor}[index] (${nodes}), not in the Feature block
    Should Be Equal As Integers    ${cursor}[offset]    0
    Should Be True    ${cursor}[empty]    The selection is a range, not a cursor
    Toolbar Should Show Valid Next Blocks For    Feature

the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding
    [Documentation]    The first user types into the Feature block. A second,
    ...    isolated context then joins: it sees that text and 5 blocks (no second
    ...    seed), and the first user still sees the text.
    ...    Reads: ${SESSION_ID}, ${FIRST_PAGE}.
    Require Step State    FIRST_PAGE    the first user's editor finishes syncing
    ${feature}=    Block Selector    feature
    Click Block    ${feature}
    Keyboard Input    type    Do not wipe me
    ${second}=    Open Second Context    ${OWNER_STATE}
    Switch Page    ${second}    context=ALL
    Go To    ${BASE_URL}/sessions/${SESSION_ID}
    Wait For Elements State    ${feature}    visible
    Wait For Condition    Text    ${feature}    *=    Do not wipe me    timeout=5s
    Get Element Count    ${BLOCKS}    ==    5
    Switch Page    ${FIRST_PAGE}    context=ALL
    Wait For Condition    Text    ${feature}    *=    Do not wipe me    timeout=5s
    Get Element Count    ${BLOCKS}    ==    5

a new block of the auto-progression type is inserted immediately after the current block — ${type}
    [Documentation]    One block more, of ${type}, right after the current
    ...    block; the others are unchanged and in order.
    ...    Reads: ${CURRENT_INDEX}, ${BLOCKS_BEFORE}, ${TYPES_BEFORE}.
    ...    Sets: ${NEW_BLOCK_INDEX}.
    Require Step State    CURRENT_INDEX    the cursor is at the end of a block of type <type>
    Block Should Be Inserted After Current Block    ${type.lower()}

the cursor is placed at the start of the new block's text
    [Documentation]    Type ${CURSOR_MARKER}: it lands in the new block, which
    ...    was empty, so the cursor was at the start of its text.
    ...    Reads: ${NEW_BLOCK_INDEX}.
    Require Step State    NEW_BLOCK_INDEX    a new block of the auto-progression type is inserted immediately after the current block — <type>
    Typed Text Should Land In New Block

the toolbar shows the block types that are valid next blocks for the current block, according to canFollow()
    [Documentation]    Checks the labels recorded for ${CURRENT_BLOCK} in
    ...    &{VALID_NEXT_LABELS} and &{INVALID_NEXT_LABELS}.
    ...    Reads: ${CURRENT_BLOCK}.
    Require Step State    CURRENT_BLOCK    the cursor is inside a block
    Toolbar Should Show Valid Next Blocks For    ${CURRENT_BLOCK}

the toolbar always shows an Image button, regardless of the current block type
    ${image}=    Toolbar Button    Image
    Wait For Elements State    ${image}    visible
    ${texts}=    Toolbar Button Texts
    List Should Contain Value    ${texts}    Image

a new block of the chosen type is inserted after the current block
    [Documentation]    Reads: ${CHOSEN_TYPE}, ${CURRENT_INDEX}, ${BLOCKS_BEFORE},
    ...    ${TYPES_BEFORE}. Sets: ${NEW_BLOCK_INDEX}.
    Require Step State    CURRENT_INDEX    the toolbar is showing valid block types
    Require Step State    CHOSEN_TYPE    the user clicks a toolbar button labelled <label>
    Block Should Be Inserted After Current Block    ${CHOSEN_TYPE}

the cursor moves to the new block
    [Documentation]    Type ${CURSOR_MARKER}: it lands in the new block.
    ...    Reads: ${NEW_BLOCK_INDEX}.
    Require Step State    NEW_BLOCK_INDEX    a new block of the chosen type is inserted after the current block
    Typed Text Should Land In New Block

a horizontal rule and vertical space are rendered above the ${block:given|scenario} block
    [Documentation]    The inserted ${block} block has a solid 1px top border
    ...    and non-zero top margin and padding.
    ...    Reads: ${NEW_BLOCK_INDEX}.
    Require Step State    NEW_BLOCK_INDEX    a ${block} block immediately follows a then, and, or but block — <previous>
    ${new}=    Set Variable    ${BLOCKS} >> nth=${NEW_BLOCK_INDEX}
    Get Attribute    ${new}    data-gherkin-type    ==    ${block}
    Get Style    ${new}    border-top-width    ==    1px
    Get Style    ${new}    border-top-style    ==    solid
    Get Style    ${new}    margin-top    !=    0px
    Get Style    ${new}    padding-top    !=    0px

this separation is purely visual and does not affect the document structure or export output
    [Documentation]    Structure: the editor's top-level nodes are exactly its
    ...    blocks, so no separator node was added. Export: the TXT export has
    ...    one `Keyword:` line per block, in order, and nothing else.
    ...    Reads: ${NEW_BLOCK_INDEX}.
    Require Step State    NEW_BLOCK_INDEX    a <block> block immediately follows a then, and, or but block — <previous>
    ${types}=    Block Types In Editor
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${types}
    ${path}    ${filename}=    Download Via Button    ${EXPORT_BUTTON}
    ${lines}=    Read Lines    ${path}
    ${actual}=    Evaluate    [line.rstrip() for line in $lines]
    ${expected}=    Evaluate    [t.title() + ":" for t in $types]
    Lists Should Be Equal    ${actual}    ${expected}

a file picker opens
    [Documentation]    The armed file chooser opened and was given the PNG.
    ...    Reads: ${UPLOAD_PROMISE}.
    Require Step State    UPLOAD_PROMISE    the user clicks the Image toolbar button
    Wait For    ${UPLOAD_PROMISE}

selecting an image file embeds it as an image block immediately after the current block
    [Documentation]    The top-level nodes are those of ${CONTENT_BEFORE} with
    ...    one image inserted right after ${CURRENT_NODE_INDEX}, and the image
    ...    renders.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Require Step State    CONTENT_BEFORE    the user clicks the Image toolbar button
    ${before}=    Evaluate    [n["node"] for n in $CONTENT_BEFORE]
    Get Element Count    ${IMAGE_BLOCK}    ==    ${before.count("image") + 1}
    ${index}=    Evaluate    ${CURRENT_NODE_INDEX} + 1
    ${expected}=    Evaluate    $before[:$index] + ["image"] + $before[$index:]
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${expected}
    Wait For Elements State    ${IMAGE_BLOCK} img    visible
    ${box}=    Get BoundingBox    ${IMAGE_BLOCK} img
    Should Be True    ${box}[width] > 0 and ${box}[height] > 0

the toolbar shows a "Table" button
    ${button}=    Toolbar Button    Table
    Wait For Elements State    ${button}    visible

the block picker includes "Table" as an option
    Wait For Elements State    ${PICKER} >> button:has-text("Table")    visible

focus moves to the next cell (left to right, top to bottom) — row ${row}, column ${column}
    ${cell}=    Cell Selector    ${row}    ${column}
    Wait For Elements State    ${cell}    focused

focus moves to the previous cell — row ${row}, column ${column}
    ${cell}=    Cell Selector    ${row}    ${column}
    Wait For Elements State    ${cell}    focused

"Add row" and "Add column" controls are available within the table UI
    [Documentation]    Clicking into a cell shows the table toolbar (it is
    ...    shown on focus-within) with its insert-row-below and
    ...    insert-column-after buttons, enabled.
    Click    ${CELL_0_0}
    Wait For Elements State    ${TABLE_TOOLBAR}    visible
    FOR    ${action}    IN    insert-row-below    insert-col-after
        ${button}=    Set Variable    ${TABLE_TOOLBAR} [data-action="${action}"]
        Wait For Elements State    ${button}    visible
        Wait For Elements State    ${button}    enabled
    END

a block picker menu opens
    Wait For Elements State    ${PICKER}    visible

the menu lists the block types that are valid next blocks for the current block, according to canFollow()
    [Documentation]    Checks the labels recorded for ${PREVIOUS_BLOCK} in
    ...    &{VALID_NEXT_LABELS} and &{INVALID_NEXT_LABELS}.
    ...    Reads: ${PREVIOUS_BLOCK}.
    Require Step State    PREVIOUS_BLOCK    the cursor is inside a block on a new line after <type>
    ${valid}    ${invalid}=    Next Labels For    ${PREVIOUS_BLOCK}
    FOR    ${label}    IN    @{valid}
        Wait For Elements State    ${PICKER} >> text=${label}    visible
    END
    ${texts}=    Texts Of All    ${PICKER} >> button
    FOR    ${label}    IN    @{invalid}
        List Should Not Contain Value    ${texts}    ${label}
    END

the menu always includes Image as the final option, regardless of the current block type
    ${text}=    Get Text    ${PICKER} >> button >> nth=-1
    Should Be Equal    ${text.strip()}    Image

focus moves to the next item in the list
    [Documentation]    Reads: ${FOCUSED_INDEX}, ${OPTION_COUNT}.
    Require Step State    FOCUSED_INDEX    the block picker menu is open
    Require Step State    OPTION_COUNT    the block picker menu is open
    ${next}=    Evaluate    (${FOCUSED_INDEX} + 1) % ${OPTION_COUNT}
    Focus Should Move To    ${next}

focus moves to the previous item in the list
    [Documentation]    From the first item, focus wraps to the last.
    ...    Reads: ${FOCUSED_INDEX}, ${OPTION_COUNT}.
    Require Step State    FOCUSED_INDEX    the block picker menu is open
    Require Step State    OPTION_COUNT    the block picker menu is open
    ${previous}=    Evaluate    (${FOCUSED_INDEX} - 1) % ${OPTION_COUNT}
    Focus Should Move To    ${previous}

the focused block type is inserted and the menu closes
    [Documentation]    Reads: ${BLOCKS_BEFORE}, ${TYPES_BEFORE}, ${TARGET_INDEX},
    ...    ${FOCUSED_TYPE}.
    Require Step State    TARGET_INDEX    the block picker menu is open and an item is focused
    Picked Type Should Replace Target Block

the clicked block type is inserted and the menu closes
    [Documentation]    Reads: ${BLOCKS_BEFORE}, ${TYPES_BEFORE}, ${TARGET_INDEX},
    ...    ${FOCUSED_TYPE}.
    Require Step State    TARGET_INDEX    the block picker menu is open and an item is focused
    Picked Type Should Replace Target Block

the menu closes without inserting a block
    [Documentation]    Reads: ${BLOCKS_BEFORE}, ${TYPES_BEFORE}.
    Require Step State    BLOCKS_BEFORE    the block picker menu is open
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE}
    ${types}=    Block Types In Editor
    Lists Should Be Equal    ${types}    ${TYPES_BEFORE}

a new block is inserted immediately after the image using the auto-progression type of the most recent Gherkin block that precedes the image — ${type}
    [Documentation]    One node more, a ${type} block right after the image;
    ...    the other nodes are unchanged and in order.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    ...    Sets: ${NEW_BLOCK_INDEX}.
    Require Step State    CONTENT_BEFORE    an image block follows a Then block and the image is selected
    Block Should Be Inserted After Image    ${type.lower()}

a new And block is inserted immediately after the image
    [Documentation]    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    ...    Sets: ${NEW_BLOCK_INDEX}.
    Require Step State    CONTENT_BEFORE    an image block follows a Then block and the image is selected
    Block Should Be Inserted After Image    and

the image is shown as selected
    [Documentation]    The image block has ProseMirror's selected-node class
    ...    and the outline that highlights it.
    Get Element Count    ${SELECTED_IMAGE}    ==    1
    Get Style    ${SELECTED_IMAGE}    outline-style    ==    solid

the image stays in the document
    [Documentation]    The top-level nodes are those of ${CONTENT_BEFORE}.
    ...    Reads: ${CONTENT_BEFORE}.
    Require Step State    CONTENT_BEFORE    an image block is selected
    Get Element Count    ${IMAGE_BLOCK}    ==    1
    ${before}=    Evaluate    [n["node"] for n in $CONTENT_BEFORE]
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${before}

no text is inserted and the block picker does not open
    [Documentation]    The editor's content equals ${CONTENT_BEFORE} and no
    ...    picker is shown.
    ...    Reads: ${CONTENT_BEFORE}.
    Require Step State    CONTENT_BEFORE    an image block is selected
    ${content}=    Document Content In Editor
    Should Be Equal    ${content}    ${CONTENT_BEFORE}
    Get Element Count    ${PICKER}    ==    0

the image is removed from the document
    [Documentation]    The top-level nodes are those of ${CONTENT_BEFORE}
    ...    without the image.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Require Step State    CONTENT_BEFORE    an image block between two Gherkin blocks is selected
    Get Element Count    ${IMAGE_BLOCK}    ==    0
    ${expected}=    Evaluate    [n["node"] for n in $CONTENT_BEFORE if n["node"] != "image"]
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${expected}

the Gherkin blocks on either side of it are unchanged
    [Documentation]    The blocks before and after the image keep their type
    ...    and text.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Require Step State    CONTENT_BEFORE    an image block between two Gherkin blocks is selected
    ${content}=    Document Content In Editor
    ${i}=    Set Variable    ${CURRENT_NODE_INDEX}
    Should Be Equal    ${content}[${i - 1}]    ${CONTENT_BEFORE}[${i - 1}]
    Should Be Equal    ${content}[${i}]    ${CONTENT_BEFORE}[${i + 1}]

# ---- Technical helpers ---------------------------------------------------

Block Should Be Inserted After Current Block
    [Documentation]    Wait for one block more, then check the blocks are
    ...    ${TYPES_BEFORE} with ${type} inserted right after ${CURRENT_INDEX}.
    ...    Sets: ${NEW_BLOCK_INDEX}.
    [Arguments]    ${type}
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE + 1}
    ${index}=    Evaluate    ${CURRENT_INDEX} + 1
    ${expected}=    Evaluate    $TYPES_BEFORE[:$index] + [$type] + $TYPES_BEFORE[$index:]
    ${types}=    Block Types In Editor
    Lists Should Be Equal    ${types}    ${expected}
    Set Test Variable    ${NEW_BLOCK_INDEX}    ${index}

Block Should Be Inserted After Image
    [Documentation]    Wait for one block more, then check the top-level nodes
    ...    are those of ${CONTENT_BEFORE} with ${type} inserted right after the
    ...    image at ${CURRENT_NODE_INDEX}.
    ...    Sets: ${NEW_BLOCK_INDEX} (among the blocks, as
    ...    `Typed Text Should Land In New Block` counts).
    [Arguments]    ${type}
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE + 1}
    ${before}=    Evaluate    [n["node"] for n in $CONTENT_BEFORE]
    ${index}=    Evaluate    ${CURRENT_NODE_INDEX} + 1
    ${expected}=    Evaluate    $before[:$index] + [$type] + $before[$index:]
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${expected}
    ${new}=    Evaluate    len([n for n in $before[:$index] if n not in ("image", "table")])
    Set Test Variable    ${NEW_BLOCK_INDEX}    ${new}

Arm Image Upload
    [Documentation]    Write a 1×1 PNG, record the editor (`Remember Editor`),
    ...    and arm `Promise To Upload File` so the next file chooser receives
    ...    the PNG.
    ...    Sets: ${UPLOAD_PROMISE}, ${CONTENT_BEFORE}, ${TYPES_BEFORE},
    ...    ${BLOCKS_BEFORE}, ${CURRENT_NODE_INDEX}.
    ${png}=    Write Tiny PNG
    Remember Editor
    ${promise}=    Promise To Upload File    ${png}
    Set Test Variable    ${UPLOAD_PROMISE}    ${promise}

Press Key In Cell
    [Documentation]    Click the data-table cell in ${row}, ${column} (from 1),
    ...    wait until it has focus and press ${key}.
    [Arguments]    ${row}    ${column}    ${key}
    ${cell}=    Cell Selector    ${row}    ${column}
    Click    ${cell}
    Wait For Elements State    ${cell}    focused
    Keyboard Key    press    ${key}

Typed Text Should Land In New Block
    [Documentation]    Type ${CURSOR_MARKER} and check that the block at
    ...    ${NEW_BLOCK_INDEX}, empty until now, holds exactly it.
    Keyboard Input    type    ${CURSOR_MARKER}
    Get Text    ${BLOCKS} >> nth=${NEW_BLOCK_INDEX}    ==    ${CURSOR_MARKER}

Toolbar Should Show Valid Next Blocks For
    [Documentation]    The toolbar shows every label recorded for ${type} in
    ...    &{VALID_NEXT_LABELS} and none in &{INVALID_NEXT_LABELS}.
    [Arguments]    ${type}
    ${valid}    ${invalid}=    Next Labels For    ${type}
    FOR    ${label}    IN    @{valid}
        ${button}=    Toolbar Button    ${label}
        Wait For Elements State    ${button}    visible
    END
    ${texts}=    Toolbar Button Texts
    FOR    ${label}    IN    @{valid}
        List Should Contain Value    ${texts}    ${label}
    END
    FOR    ${label}    IN    @{invalid}
        List Should Not Contain Value    ${texts}    ${label}
    END

Next Labels For
    [Documentation]    Return the valid and invalid next-block labels recorded
    ...    for context ${type}. Fails for a context with no entry, so a test
    ...    never passes on a list nobody wrote down.
    [Arguments]    ${type}
    ${key}=    Set Variable    ${type.lower()}
    IF    $key not in $VALID_NEXT_LABELS
        Fail    No valid-next labels recorded for ${type}; add them to \&{VALID_NEXT_LABELS}
    END
    RETURN    ${VALID_NEXT_LABELS}[${key}]    ${INVALID_NEXT_LABELS}[${key}]

Item Should Have Focus
    [Documentation]    Sets: ${FOCUSED_INDEX}.
    [Arguments]    ${index}
    Get Style    ${PICKER} >> button >> nth=${index}    background    *=    ${FOCUSED_BG}
    Set Test Variable    ${FOCUSED_INDEX}    ${index}

Focus Should Move To
    [Documentation]    Item ${index} gains focus and the item at ${FOCUSED_INDEX}
    ...    loses it. Reads and updates: ${FOCUSED_INDEX}.
    [Arguments]    ${index}
    Get Style    ${PICKER} >> button >> nth=${index}    background    *=    ${FOCUSED_BG}
    Get Style    ${PICKER} >> button >> nth=${FOCUSED_INDEX}    background    not contains    ${FOCUSED_BG}
    Set Test Variable    ${FOCUSED_INDEX}    ${index}

Picked Type Should Replace Target Block
    [Documentation]    The menu closes, the block count is unchanged, and the
    ...    target block now has the picked type. Reads: ${BLOCKS_BEFORE},
    ...    ${TYPES_BEFORE}, ${TARGET_INDEX}, ${FOCUSED_TYPE}.
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE}
    ${types}=    Block Types In Editor
    Should Not Be Equal    ${types}[${TARGET_INDEX}]    ${TYPES_BEFORE}[${TARGET_INDEX}]
    Should Be Equal    ${types}[${TARGET_INDEX}]    ${FOCUSED_TYPE}
