*** Settings ***
Documentation       Port of e2e/enter-progression.spec.ts — spec §3.2, the 9 text rows
...                 of the enter-progression table, plus SC-3.2.2 (Enter on an image
...                 block, chunk 3).
...                 The mix of plain End/Enter and Press Enter And Wait For Block
...                 follows the original test by test.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk2    enter-progression


*** Test Cases ***
SC-3.2.1: Enter at end of block inserts auto-progression type — feature → scenario
    Open Session
    Click    [data-gherkin-type="feature"]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    Should Be Equal    ${types}[1]    scenario

SC-3.2.1: Enter at end of block inserts auto-progression type — scenario → given
    Open Session
    Click    [data-gherkin-type="feature"]
    Keyboard Key    press    Enter    # feature → scenario (inserted after the seed's scenario)
    Click    [data-gherkin-type="scenario"] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Last Index Of    ${types}    scenario
    Should Be Equal    ${types}[${i + 1}]    given

SC-3.2.1: Enter at end of block inserts auto-progression type — given → when
    Open Session
    Click    [data-gherkin-type="feature"]
    Keyboard Key    press    Enter    # feature → scenario
    Click    [data-gherkin-type="scenario"] >> nth=-1
    Keyboard Key    press    Enter    # scenario → given
    Click    [data-gherkin-type="given"] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Last Index Of    ${types}    given
    Should Be Equal    ${types}[${i + 1}]    when

SC-3.2.1: Enter at end of block inserts auto-progression type — when → then
    Open Session
    Click    [data-gherkin-type="feature"]
    Keyboard Key    press    Enter    # → scenario
    Click    [data-gherkin-type="scenario"] >> nth=-1
    Keyboard Key    press    Enter    # → given
    Click    [data-gherkin-type="given"] >> nth=-1
    Keyboard Key    press    Enter    # → when
    Click    [data-gherkin-type="when"] >> nth=-1
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Last Index Of    ${types}    when
    Should Be Equal    ${types}[${i + 1}]    then

SC-3.2.1: Enter at end of block inserts auto-progression type — then → and
    Open Session
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    Press Enter And Wait For Block    when
    Press Enter And Wait For Block    then
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
    ${and}=    Toolbar Button    And
    Click    ${and}
    Click    [data-gherkin-type="and"] >> nth=-1
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
    ${but}=    Toolbar Button    But
    Click    ${but}
    Click    [data-gherkin-type="but"] >> nth=-1
    Keyboard Key    press    End
    ${before}=    Block Types In Editor
    ${i}=    Last Index Of    ${before}    but
    Press Enter And Wait For Block    and
    ${after}=    Block Types In Editor
    Should Be Equal    ${after}[${i + 1}]    and

SC-3.2.1: Enter at end of block inserts auto-progression type — background → given
    Open Session
    Click    [data-gherkin-type="feature"]
    ${background}=    Toolbar Button    Background
    Click    ${background}
    Click    [data-gherkin-type="background"]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Evaluate    $types.index("background")
    Should Be Equal    ${types}[${i + 1}]    given

SC-3.2.1: Enter at end of block inserts auto-progression type — rule → scenario
    Open Session
    Click    [data-gherkin-type="feature"]
    ${rule}=    Toolbar Button    Rule
    Click    ${rule}
    Click    [data-gherkin-type="rule"]
    Keyboard Key    press    End
    Keyboard Key    press    Enter
    ${types}=    Block Types In Editor
    ${i}=    Evaluate    $types.index("rule")
    Should Be Equal    ${types}[${i + 1}]    scenario

SC-3.2.2: Enter on image block uses prevType context
    [Tags]    chunk3
    [Teardown]    Remove Temp Files
    Open Session
    # Build: feature → scenario → given → when → then
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    Press Enter And Wait For Block    when
    Press Enter And Wait For Block    then
    # Insert an image after the 'then' block via the toolbar Image button.
    ${png}=    Write Tiny PNG
    Click    [data-gherkin-type="then"] >> nth=-1
    ${image_button}=    Toolbar Button    Image
    Click    ${image_button}
    Upload File By Selector    input[type="file"]    ${png}
    Wait For Elements State    .gherkin-image-block    visible
    # Select the image block, then press Enter.
    Click    .gherkin-image-block
    ${types_before}=    Block Types In Editor
    ${count_before}=    Get Length    ${types_before}
    Keyboard Key    press    Enter
    Get Element Count    [data-gherkin-type]    >    ${count_before}
    # prevType is 'then', so the new block after the image is 'and'.
    ${types_after}=    Block Types In Editor
    Should Be Equal    ${types_after}[-1]    and
