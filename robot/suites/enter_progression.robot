*** Settings ***
Documentation       Port of e2e/enter-progression.spec.ts — spec §3.2, the 9 text rows
...                 of the enter-progression table, plus SC-3.2.2 (Enter on an image
...                 block, chunk 3).
...                 The mix of plain End/Enter and Press Enter And Wait For Block
...                 follows the original test by test.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk2    enter-progression


*** Test Cases ***
SC-3.2.1: Enter at end of block inserts auto-progression type — feature → scenario
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    Should Be Equal    ${types}[1]    scenario

SC-3.2.1: Enter at end of block inserts auto-progression type — scenario → given
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Key    press    Enter    # feature → scenario (inserted after the seed's scenario)
    Click    ${BLOCK_TYPE}[scenario] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Last Index Of    ${types}    scenario
    Should Be Equal    ${types}[${i + 1}]    given

SC-3.2.1: Enter at end of block inserts auto-progression type — given → when
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Key    press    Enter    # feature → scenario
    Click    ${BLOCK_TYPE}[scenario] >> nth=-1
    Keyboard Key    press    Enter    # scenario → given
    Click    ${BLOCK_TYPE}[given] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Last Index Of    ${types}    given
    Should Be Equal    ${types}[${i + 1}]    when

SC-3.2.1: Enter at end of block inserts auto-progression type — when → then
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Keyboard Key    press    Enter    # → scenario
    Click    ${BLOCK_TYPE}[scenario] >> nth=-1
    Keyboard Key    press    Enter    # → given
    Click    ${BLOCK_TYPE}[given] >> nth=-1
    Keyboard Key    press    Enter    # → when
    Click    ${BLOCK_TYPE}[when] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Last Index Of    ${types}    when
    Should Be Equal    ${types}[${i + 1}]    then

SC-3.2.1: Enter at end of block inserts auto-progression type — then → and
    Open Session
    Build Scaffold To Then
    Press Enter And Wait For Block    and
    ${types}=    Block Types In Editor
    # A "then" immediately followed by "and".
    Should Be True
    ...    ("then", "and") in list(zip($types, $types[1:]))
    ...    No then → and pair in ${types}

SC-3.2.1: Enter at end of block inserts auto-progression type — and → and
    Open Session
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    # Insert an 'and' block via toolbar.
    Click Toolbar Button    And
    Click    ${BLOCK_TYPE}[and] >> nth=-1
    Keyboard Key    press    End
    ${before}=    Block Types In Editor
    ${i}=    Last Index Of    ${before}    and
    Press Enter And Wait For Block    and
    ${after}=    Block Types In Editor
    Should Be Equal    ${after}[${i + 1}]    and

SC-3.2.1: Enter at end of block inserts auto-progression type — but → and
    Open Session
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    Click Toolbar Button    But
    Click    ${BLOCK_TYPE}[but] >> nth=-1
    Keyboard Key    press    End
    ${before}=    Block Types In Editor
    ${i}=    Last Index Of    ${before}    but
    Press Enter And Wait For Block    and
    ${after}=    Block Types In Editor
    Should Be Equal    ${after}[${i + 1}]    and

SC-3.2.1: Enter at end of block inserts auto-progression type — background → given
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Click Toolbar Button    Background
    Click    ${BLOCK_TYPE}[background]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Evaluate    $types.index("background")
    Should Be Equal    ${types}[${i + 1}]    given

SC-3.2.1: Enter at end of block inserts auto-progression type — rule → scenario
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    Click Toolbar Button    Rule
    Click    ${BLOCK_TYPE}[rule]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Evaluate    $types.index("rule")
    Should Be Equal    ${types}[${i + 1}]    scenario

SC-3.2.2: Enter on image block uses prevType context
    [Tags]    chunk3
    [Teardown]    Remove Temp Files
    Open Session
    Build Scaffold To Then
    # Insert an image after the 'then' block via the toolbar Image button.
    Insert Image After Block    then
    Wait For Elements State    ${IMAGE_BLOCK}    visible
    # Select the image block, then press Enter.
    Click    ${IMAGE_BLOCK}
    ${types_before}=    Block Types In Editor
    ${count_before}=    Get Length    ${types_before}
    Keyboard Key    press    Enter
    Get Element Count    ${BLOCKS}    >    ${count_before}
    # prevType is 'then', so the new block after the image is 'and'.
    ${types_after}=    Block Types In Editor
    Should Be Equal    ${types_after}[-1]    and
