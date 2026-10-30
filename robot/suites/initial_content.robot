*** Settings ***
Documentation       Port of e2e/initial-content.spec.ts — spec §3.1 initial scaffold content.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk1    initial-content


*** Test Cases ***
SC-3.1.2: New document seeded with 5 scaffold blocks once — order
    Open Session
    ${types}=    Block Types In Editor
    @{expected}=    Create List    feature    scenario    given    when    then
    Should Be Equal    ${types}    ${expected}

SC-3.1.2: New document seeded with 5 scaffold blocks once — empty text
    Open Session
    ${texts}=    Texts Of All    ${BLOCKS}
    Should Be True    all(t == "" for t in $texts)    Not every scaffold block is empty: ${texts}

SC-3.1.2: New document seeded with 5 scaffold blocks once — cursor on Feature
    Open Session
    ${texts}=    Toolbar Button Texts
    List Should Contain Value    ${texts}    Scenario
    List Should Not Contain Value    ${texts}    Feature
