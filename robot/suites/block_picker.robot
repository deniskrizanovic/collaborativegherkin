*** Settings ***
Documentation       Port of e2e/block-picker.spec.ts — spec §3.3 slash-command block picker.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk2    block-picker


*** Test Cases ***
SC-3.3.1: Typing / opens picker with valid next blocks and Image
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Input    type    /
    # After Feature: Rule, Background, Scenario are valid.
    Wait For Elements State    text=Scenario >> nth=0    visible

SC-3.3.1: Typing / opens picker with valid next blocks and Image — only valid types shown
    Open Session
    # Enter on Feature gives an untyped line; "/" there opens the picker in
    # insert mode with options for "after Feature": Rule, Background, Scenario.
    Open Picker On New Line After Feature
    Wait For Elements State    ${PICKER} >> text=Rule    visible
    Wait For Elements State    ${PICKER} >> text=Background    visible
    Wait For Elements State    ${PICKER} >> text=Scenario    visible
    # Feature itself is not valid after Feature.
    ${texts}=    Texts Of All    ${PICKER} >> button
    List Should Not Contain Value    ${texts}    Feature

SC-3.3.2: Down arrow moves picker focus to next item
    Open Session
    Open Picker On New Line After Feature
    Get Style    ${PICKER} >> button >> nth=0    background    *=    ${FOCUSED_BG}
    Keyboard Key    press    ArrowDown
    Get Style    ${PICKER} >> button >> nth=1    background    *=    ${FOCUSED_BG}

SC-3.3.3: Up arrow moves picker focus to previous item
    Open Session
    Open Picker On New Line After Feature
    Keyboard Key    press    ArrowUp
    # Wraps to the last item.
    Get Style    ${PICKER} >> button >> nth=-1    background    *=    ${FOCUSED_BG}

SC-3.3.4: Enter on focused picker item inserts type and closes
    Open Session
    # Typing / on the seeded Scenario block: replace mode changes its type.
    Click    ${BLOCK_TYPE}[scenario]
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Keyboard Key    press    Enter
    Wait For Elements State    ${PICKER}    hidden
    # Block count stays the same — type was replaced, not a new block added.
    Get Element Count    ${BLOCKS}    ==    5
    ${types}=    Block Types In Editor
    Should Not Be Equal    ${types}[1]    scenario

SC-3.3.5: Clicking picker item inserts type and closes
    Open Session
    Click    ${BLOCK_TYPE}[scenario]
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Click    ${PICKER} >> button >> nth=0
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    5
    ${types}=    Block Types In Editor
    Should Not Be Equal    ${types}[1]    scenario

SC-3.3.6: Escape closes picker without inserting
    Open Session
    ${before}=    Get Element Count    ${BLOCKS}
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${before}

SC-3.3.7: Clicking outside picker closes without inserting
    Open Session
    ${before}=    Get Element Count    ${BLOCKS}
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Mouse Button    click    10    10
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${before}

SC-3.3.1: Typing / opens picker with valid next blocks and Image — Image always last
    Open Session
    # Context 1: after Scenario. End+Enter on Feature, then End+Enter on the new
    # Scenario gives an untyped line whose prevType is scenario.
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    Click    ${BLOCK_TYPE}[scenario] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Last Picker Item Should Be Image
    Keyboard Key    press    Escape
    # Context 2: after Then — Enter from the seeded then block.
    Click    ${BLOCK_TYPE}[then] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Last Picker Item Should Be Image
    Keyboard Key    press    Escape


*** Keywords ***
Open Picker On New Line After Feature
    [Documentation]    End+Enter on the Feature block, type "/" on the new
    ...    untyped line, and wait for the picker.
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible

Last Picker Item Should Be Image
    ${text}=    Get Text    ${PICKER} >> button >> nth=-1
    Should Be Equal    ${text.strip()}    Image
