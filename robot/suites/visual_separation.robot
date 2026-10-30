*** Settings ***
Documentation       Port of e2e/visual-separation.spec.ts — spec §3.7.
...                 Visual separation is CSS: a given/scenario block that follows
...                 then/and/but gets a 1px top border, so the computed
...                 border-top-width is asserted. The "separator not in export"
...                 test (chunk 3) downloads the TXT export and checks it.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk2    visual-separation


*** Test Cases ***
SC-3.7.1: Given after then/and/but gets top border — after then
    Open Session
    Build Scaffold To Then
    # Insert And after then, then insert Given after And.
    Click Toolbar Button    And
    Click    ${BLOCK_TYPE}[and] >> nth=-1
    Click Toolbar Button    Given
    # The second given block follows then, so it should have a top border.
    Get Style    ${BLOCK_TYPE}[given] >> nth=-1    border-top-width    ==    1px

SC-3.7.1: Given after then/and/but gets top border — after and
    Open Session
    Build Scaffold To Then
    Click Toolbar Button    And
    Click    ${BLOCK_TYPE}[and] >> nth=-1
    Click Toolbar Button    Given
    Get Style    ${BLOCK_TYPE}[given] >> nth=-1    border-top-width    ==    1px

SC-3.7.1: Given after then/and/but gets top border — after but
    Open Session
    Build Scaffold To Then
    Click Toolbar Button    But
    Click    ${BLOCK_TYPE}[but] >> nth=-1
    Click Toolbar Button    Given
    Get Style    ${BLOCK_TYPE}[given] >> nth=-1    border-top-width    ==    1px

SC-3.7.2: Scenario after then/and/but gets top border — after then
    Open Session
    Build Scaffold To Then
    # Enter after "then" produces "and"; use the toolbar for the next scenario.
    Click Toolbar Button    Scenario
    Get Element Count    ${BLOCK_TYPE}[scenario]    >=    2
    Get Style    ${BLOCK_TYPE}[scenario] >> nth=-1    border-top-width    ==    1px

SC-3.7.2: Scenario after then/and/but gets top border — after and
    Open Session
    Build Scaffold To Then
    Click Toolbar Button    And
    Click    ${BLOCK_TYPE}[and] >> nth=-1
    Click Toolbar Button    Scenario
    Get Style    ${BLOCK_TYPE}[scenario] >> nth=-1    border-top-width    ==    1px

SC-3.7.2: Scenario after then/and/but gets top border — after but
    Open Session
    Build Scaffold To Then
    Click Toolbar Button    But
    Click    ${BLOCK_TYPE}[but] >> nth=-1
    Click Toolbar Button    Scenario
    Get Style    ${BLOCK_TYPE}[scenario] >> nth=-1    border-top-width    ==    1px

SC-3.7.1: Given after then/and/but gets top border — first given after scenario has no border
    Open Session
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    # No CSS sibling rule should apply here.
    Get Style    ${BLOCK_TYPE}[given] >> nth=0    border-top-width    ==    0px


SC-3.7.1: Given after then/and/but gets top border — separator not in export
    [Tags]    -chunk2    chunk3
    [Teardown]    Remove Temp Files
    Open Session
    Click    ${BLOCK_TYPE}[feature] >> nth=0
    Keyboard Input    type    F
    Press Enter And Wait For Block    scenario
    Keyboard Input    type    S
    Press Enter And Wait For Block    given
    Keyboard Input    type    G1
    Press Enter And Wait For Block    when
    Keyboard Input    type    W
    Press Enter And Wait For Block    then
    Keyboard Input    type    T
    # Insert And after then, then Given after And.
    Click Toolbar Button    And
    Click    ${BLOCK_TYPE}[and] >> nth=-1
    Click Toolbar Button    Given
    Click    ${BLOCK_TYPE}[given] >> nth=-1
    Keyboard Input    type    G2
    ${path}    ${filename}=    Download Via Button    ${EXPORT_BUTTON}
    ${content}=    Get File    ${path}    encoding=UTF-8
    # No hr or separator marker in the export.
    Should Not Contain    ${content}    ---
    Should Not Contain    ${content}    <hr
    # Every non-empty line has the "Keyword: text" format.
    ${lines}=    Read Lines    ${path}
    FOR    ${line}    IN    @{lines}
        IF    $line    Should Match Regexp    ${line}    ^\\w+:${SPACE}
    END

