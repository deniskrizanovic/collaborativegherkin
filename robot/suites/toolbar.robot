*** Settings ***
Documentation       Port of e2e/toolbar.spec.ts — spec §3.4 toolbar.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource

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
    ${rule}=    Toolbar Button    Rule
    Click    ${rule}
    Wait For Elements State    [data-gherkin-type="rule"]    visible

SC-3.4.2: Clicking toolbar button inserts block and moves cursor — Scenario after Feature
    Open Session
    ${before}=    Get Element Count    [data-gherkin-type="scenario"]
    ${scenario}=    Toolbar Button    Scenario
    Click    ${scenario}
    Get Element Count    [data-gherkin-type="scenario"]    ==    ${before + 1}

SC-3.4.1: Toolbar shows valid next blocks and Image — Image present on non-Feature block
    Open Session
    Click    [data-gherkin-type="then"]
    ${texts}=    Toolbar Button Texts
    List Should Contain Value    ${texts}    Image
