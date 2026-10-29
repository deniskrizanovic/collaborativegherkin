*** Settings ***
Documentation       Business-language keywords for the slash-command block picker.
...
...                 Pilot of docs/robot-framework-evaluation.md §6.7. Each keyword
...                 is named after a GIVEN/WHEN/THEN line of
...                 openspec/specs/gherkin-editor/spec.md, so a test can repeat its
...                 spec scenario word for word. Robot drops a leading
...                 Given/When/Then/And/But when it looks a keyword up, so
...                 `Given the block picker menu is open` calls
...                 `the block picker menu is open`.
...
...                 Naming: domain keywords are lower-case sentences; the
...                 Title Case keywords at the bottom are technical helpers that
...                 tests never call directly.
...
...                 Steps share state through test variables. Each keyword's
...                 documentation lists the ones it sets or reads:
...                 ${PREVIOUS_BLOCK}, ${BLOCKS_BEFORE}, ${TYPES_BEFORE},
...                 ${OPTION_COUNT}, ${FOCUSED_INDEX}, ${TARGET_INDEX}, ${FOCUSED_TYPE}.

Library             Collections
Resource            session.resource


*** Variables ***
${PICKER}                   [style*="position: fixed"]
${BLOCKS}                   .gherkin-editor [data-gherkin-type]
# Background of the focused picker item.
${FOCUSED_BG}               rgba(0, 38, 100, 0.06)
# Picker labels after a Feature block, as asserted by e2e/block-picker.spec.ts.
@{VALID_AFTER_FEATURE}      Rule    Background    Scenario
@{INVALID_AFTER_FEATURE}    Feature


*** Keywords ***
# ---- Given ---------------------------------------------------------------

the cursor is inside a block
    [Documentation]    Open a fresh session. Open Session ends with a click on
    ...    the Feature block, so the cursor is inside it.
    Open Session

the cursor is inside a block on a new line after ${type}
    [Documentation]    Put the cursor on a new line after the last ${type} block
    ...    (click it, End, Enter). Opens a session first if none is open and
    ...    closes a picker left open by an earlier step, so a test can visit
    ...    several contexts. Sets ${PREVIOUS_BLOCK}.
    ${url}=    Get Url
    IF    "/sessions/" not in $url    Open Session
    Close Picker If Open
    Set Test Variable    ${PREVIOUS_BLOCK}    ${type}
    Click    [data-gherkin-type="${type.lower()}"] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter

the block picker menu is open
    [Documentation]    Open the picker on a new line after the Feature block,
    ...    where it lists several items (on the Feature block itself it lists
    ...    only Feature). Checks that the first item has focus.
    ...    Sets ${BLOCKS_BEFORE}, ${TYPES_BEFORE}, ${OPTION_COUNT}, ${FOCUSED_INDEX}.
    the cursor is inside a block on a new line after Feature
    the user types /
    a block picker menu opens
    Item Should Have Focus    0
    ${count}=    Get Element Count    ${PICKER} >> button
    Set Test Variable    ${OPTION_COUNT}    ${count}
    Remember Blocks

the block picker menu is open and an item is focused
    [Documentation]    Open the picker on the seeded Scenario block (replace
    ...    mode) and record the focused item.
    ...    Sets ${BLOCKS_BEFORE}, ${TYPES_BEFORE}, ${TARGET_INDEX},
    ...    ${FOCUSED_INDEX}, ${FOCUSED_TYPE}.
    Open Session
    Remember Blocks
    ${index}=    Get Index From List    ${TYPES_BEFORE}    scenario
    Set Test Variable    ${TARGET_INDEX}    ${index}
    Click    [data-gherkin-type="scenario"]
    the user types /
    a block picker menu opens
    Item Should Have Focus    0
    ${label}=    Get Text    ${PICKER} >> button >> nth=${FOCUSED_INDEX}
    Set Test Variable    ${FOCUSED_TYPE}    ${label.strip().lower().replace(" ", "_")}

# ---- When ----------------------------------------------------------------

the user types ${text}
    Keyboard Input    type    ${text}

the user presses ${key:Escape|Enter}
    Keyboard Key    press    ${key}

the user presses the down arrow key
    Keyboard Key    press    ArrowDown

the user presses the up arrow key
    Keyboard Key    press    ArrowUp

the user clicks the item
    [Documentation]    Click the focused item. Reads ${FOCUSED_INDEX}.
    Click    ${PICKER} >> button >> nth=${FOCUSED_INDEX}

the user clicks outside the menu
    Mouse Button    click    10    10

# ---- Then ----------------------------------------------------------------

a block picker menu opens
    Wait For Elements State    ${PICKER}    visible

the menu lists the block types that are valid next blocks for the current block, according to canFollow()
    [Documentation]    Expectations exist only for the context after a Feature
    ...    block, the one e2e/block-picker.spec.ts checks. Reads ${PREVIOUS_BLOCK}.
    ${previous}=    Get Variable Value    ${PREVIOUS_BLOCK}    ${None}
    Should Be Equal    ${previous}    Feature    ignore_case=True
    ...    msg=valid next blocks are recorded only for a new line after Feature
    FOR    ${label}    IN    @{VALID_AFTER_FEATURE}
        Wait For Elements State    ${PICKER} >> text=${label}    visible
    END
    ${texts}=    Texts Of All    ${PICKER} >> button
    FOR    ${label}    IN    @{INVALID_AFTER_FEATURE}
        List Should Not Contain Value    ${texts}    ${label}
    END

the menu always includes Image as the final option, regardless of the current block type
    ${text}=    Get Text    ${PICKER} >> button >> nth=-1
    Should Be Equal    ${text.strip()}    Image

focus moves to the next item in the list
    [Documentation]    Reads ${FOCUSED_INDEX} and ${OPTION_COUNT}.
    ${next}=    Evaluate    (${FOCUSED_INDEX} + 1) % ${OPTION_COUNT}
    Focus Should Move To    ${next}

focus moves to the previous item in the list
    [Documentation]    Reads ${FOCUSED_INDEX} and ${OPTION_COUNT}. From the
    ...    first item, focus wraps to the last.
    ${previous}=    Evaluate    (${FOCUSED_INDEX} - 1) % ${OPTION_COUNT}
    Focus Should Move To    ${previous}

the focused block type is inserted and the menu closes
    Picked Type Should Replace Target Block

the clicked block type is inserted and the menu closes
    Picked Type Should Replace Target Block

the menu closes without inserting a block
    [Documentation]    Reads ${BLOCKS_BEFORE} and ${TYPES_BEFORE}.
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE}
    ${types}=    Block Types In Editor
    Lists Should Be Equal    ${types}    ${TYPES_BEFORE}

# ---- Technical helpers ---------------------------------------------------

Remember Blocks
    [Documentation]    Sets ${BLOCKS_BEFORE} and ${TYPES_BEFORE}.
    ${count}=    Get Element Count    ${BLOCKS}
    ${types}=    Block Types In Editor
    Set Test Variable    ${BLOCKS_BEFORE}    ${count}
    Set Test Variable    ${TYPES_BEFORE}    ${types}

Close Picker If Open
    ${open}=    Get Element Count    ${PICKER}
    IF    ${open} > 0
        Keyboard Key    press    Escape
        Wait For Elements State    ${PICKER}    hidden
    END

Item Should Have Focus
    [Documentation]    Sets ${FOCUSED_INDEX}.
    [Arguments]    ${index}
    Get Style    ${PICKER} >> button >> nth=${index}    background    *=    ${FOCUSED_BG}
    Set Test Variable    ${FOCUSED_INDEX}    ${index}

Focus Should Move To
    [Documentation]    Item ${index} gains focus and the item at ${FOCUSED_INDEX}
    ...    loses it. Updates ${FOCUSED_INDEX}.
    [Arguments]    ${index}
    Get Style    ${PICKER} >> button >> nth=${index}    background    *=    ${FOCUSED_BG}
    Get Style    ${PICKER} >> button >> nth=${FOCUSED_INDEX}    background    not contains    ${FOCUSED_BG}
    Set Test Variable    ${FOCUSED_INDEX}    ${index}

Picked Type Should Replace Target Block
    [Documentation]    The menu closes, the block count is unchanged, and the
    ...    target block now has the picked type. Reads ${BLOCKS_BEFORE},
    ...    ${TYPES_BEFORE}, ${TARGET_INDEX}, ${FOCUSED_TYPE}.
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE}
    ${types}=    Block Types In Editor
    Should Not Be Equal    ${types}[${TARGET_INDEX}]    ${TYPES_BEFORE}[${TARGET_INDEX}]
    Should Be Equal    ${types}[${TARGET_INDEX}]    ${FOCUSED_TYPE}
