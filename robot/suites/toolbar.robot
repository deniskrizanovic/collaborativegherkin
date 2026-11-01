*** Settings ***
Documentation       Port of e2e/toolbar.spec.ts — spec §3.4 toolbar, and
...                 SC-3.12.5 (toolbar insert with an image selected).

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk1    toolbar


*** Test Cases ***
SC-3.4.1: Toolbar shows valid next blocks and Image — no Feature shown on Feature block
    Open Session
    # Seed places cursor on Feature; toolbar shows valid next blocks, not Feature itself.
    ${texts}=    Toolbar Button Texts
    List Should Contain Value    ${texts}    Scenario
    List Should Not Contain Value    ${texts}    Feature

SC-3.4.1: Toolbar shows valid next blocks and Image — Rule, Background, Scenario after Feature
    Open Session
    ${texts}=    Toolbar Button Texts
    List Should Contain Value    ${texts}    Rule
    List Should Contain Value    ${texts}    Background
    List Should Contain Value    ${texts}    Scenario
    List Should Not Contain Value    ${texts}    Feature

SC-3.4.2: Clicking toolbar button inserts block and moves cursor
    Open Session
    Click Toolbar Button    Rule
    Wait For Elements State    ${BLOCK_TYPE}[rule]    visible

SC-3.4.2: Clicking toolbar button inserts block and moves cursor — Scenario after Feature
    Open Session
    ${before}=    Get Element Count    ${BLOCK_TYPE}[scenario]
    Click Toolbar Button    Scenario
    Get Element Count    ${BLOCK_TYPE}[scenario]    ==    ${before + 1}

SC-3.4.1: Toolbar shows valid next blocks and Image — Image present on non-Feature block
    Open Session
    Click    ${BLOCK_TYPE}[then]
    ${texts}=    Toolbar Button Texts
    List Should Contain Value    ${texts}    Image

SC-3.12.5: Toolbar insert with an image selected places the block after the image
    [Teardown]    Remove Temp Files
    Open Session
    Insert Image After Block    then
    Select Image
    Click Toolbar Button    And
    Get Element Count    ${BLOCK_TYPE}[and]    ==    1
    ${nodes}=    Document Nodes In Editor
    ${expected}=    Create List    feature    scenario    given    when    then    image    and
    Lists Should Be Equal    ${nodes}    ${expected}
    Keyboard Input    type    After image
    Get Text    ${BLOCK_TYPE}[and]    ==    After image
