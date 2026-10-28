*** Settings ***
Documentation       Port of e2e/visual-separation.spec.ts — spec §3.7.
...                 Visual separation is CSS: a given/scenario block that follows
...                 then/and/but gets a 1px top border, so the computed
...                 border-top-width is asserted. The "separator not in export"
...                 test lands in chunk 3.

Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk2    visual-separation


*** Test Cases ***
SC-3.7.1: Given after then/and/but gets top border — after then
    Open Session
    Build Feature To Then
    # Insert And after then, then insert Given after And.
    Click Toolbar Button    And
    Click    [data-gherkin-type="and"] >> nth=-1
    Click Toolbar Button    Given
    # The second given block follows then, so it should have a top border.
    Get Style    [data-gherkin-type="given"] >> nth=-1    border-top-width    ==    1px

SC-3.7.1: Given after then/and/but gets top border — after and
    Open Session
    Build Feature To Then
    Click Toolbar Button    And
    Click    [data-gherkin-type="and"] >> nth=-1
    Click Toolbar Button    Given
    Get Style    [data-gherkin-type="given"] >> nth=-1    border-top-width    ==    1px

SC-3.7.1: Given after then/and/but gets top border — after but
    Open Session
    Build Feature To Then
    Click Toolbar Button    But
    Click    [data-gherkin-type="but"] >> nth=-1
    Click Toolbar Button    Given
    Get Style    [data-gherkin-type="given"] >> nth=-1    border-top-width    ==    1px

SC-3.7.2: Scenario after then/and/but gets top border — after then
    Open Session
    Build Feature To Then
    # Enter after "then" produces "and"; use the toolbar for the next scenario.
    Click Toolbar Button    Scenario
    Get Element Count    [data-gherkin-type="scenario"]    >=    2
    Get Style    [data-gherkin-type="scenario"] >> nth=-1    border-top-width    ==    1px

SC-3.7.2: Scenario after then/and/but gets top border — after and
    Open Session
    Build Feature To Then
    Click Toolbar Button    And
    Click    [data-gherkin-type="and"] >> nth=-1
    Click Toolbar Button    Scenario
    Get Style    [data-gherkin-type="scenario"] >> nth=-1    border-top-width    ==    1px

SC-3.7.2: Scenario after then/and/but gets top border — after but
    Open Session
    Build Feature To Then
    Click Toolbar Button    But
    Click    [data-gherkin-type="but"] >> nth=-1
    Click Toolbar Button    Scenario
    Get Style    [data-gherkin-type="scenario"] >> nth=-1    border-top-width    ==    1px

SC-3.7.1: Given after then/and/but gets top border — first given after scenario has no border
    Open Session
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    # No CSS sibling rule should apply here.
    Get Style    [data-gherkin-type="given"] >> nth=0    border-top-width    ==    0px


*** Keywords ***
Build Feature To Then
    [Documentation]    Feature → Scenario → Given → When → Then via Enter,
    ...    waiting for each new block.
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    Press Enter And Wait For Block    when
    Press Enter And Wait For Block    then

Click Toolbar Button
    [Arguments]    ${label}
    ${button}=    Toolbar Button    ${label}
    Click    ${button}
