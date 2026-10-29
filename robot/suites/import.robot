*** Settings ***
Documentation       Port of e2e/import.spec.ts — spec §7.1 Gherkin text import.

Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk1    import


*** Variables ***
${IMPORT_BTN}       .gherkin-import-btn
${MODAL}            .gherkin-import-modal
${TEXTAREA}         .gherkin-import-textarea
${CONFIRM}          .gherkin-import-confirm
${CANCEL}           .gherkin-import-cancel


*** Test Cases ***
SC-7.1.1: Import button always visible in toolbar
    Open Session
    Wait For Elements State    ${IMPORT_BTN}    visible

SC-7.1.2: Clicking Import opens modal with textarea and buttons
    Open Session
    Click    ${IMPORT_BTN}
    Wait For Elements State    ${MODAL}    visible
    Wait For Elements State    ${TEXTAREA}    visible
    Wait For Elements State    ${CONFIRM}    visible
    Wait For Elements State    ${CANCEL}    visible

SC-7.1.4: Cancel closes modal without inserting
    Open Session
    Click    ${IMPORT_BTN}
    Fill Text    ${TEXTAREA}    Feature: Should not appear
    Click    ${CANCEL}
    Wait For Elements State    ${MODAL}    hidden
    Get Element Count    [data-gherkin-type="feature"]    ==    1

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — valid sequence
    Open Session
    Import Gherkin
    ...    Feature: My feature
    ...    Scenario: My scenario
    ...    Given some context
    ...    When I do something
    ...    Then I see the result
    Wait For Elements State    ${MODAL}    hidden
    Get Element Count    [data-gherkin-type="feature"]    ==    2
    Get Element Count    [data-gherkin-type="scenario"]    ==    2
    Get Element Count    [data-gherkin-type="given"]    ==    2
    Get Element Count    [data-gherkin-type="when"]    ==    2
    Get Element Count    [data-gherkin-type="then"]    ==    2

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — out-of-order inserted leniently
    Open Session
    Import Gherkin    Scenario: Orphan    Given context
    Get Element Count    [data-gherkin-type="scenario"]    ==    2
    Get Element Count    [data-gherkin-type="given"]    ==    2

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — textarea cleared
    Open Session
    Import Gherkin    Feature: Test
    # Reopen modal and verify textarea is empty.
    Click    ${IMPORT_BTN}
    Get Property    ${TEXTAREA}    value    ==    ${EMPTY}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — markdown-prefixed Gherkin parsed
    Open Session
    Import Gherkin
    ...    \# Feature: Markdown feature
    ...    \#\# Scenario: Markdown scenario
    ...    - Given: some context
    ...    - When: I do something
    ...    - Then: I see the result
    Wait For Elements State    ${MODAL}    hidden
    Get Element Count    [data-gherkin-type="feature"]    ==    2
    Get Element Count    [data-gherkin-type="scenario"]    ==    2
    Get Element Count    [data-gherkin-type="given"]    ==    2
    Get Element Count    [data-gherkin-type="when"]    ==    2
    Get Element Count    [data-gherkin-type="then"]    ==    2

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — pipe rows become DataTable
    Open Session
    # ${SPACE * 2} keeps the double spaces inside one cell (2+ spaces would split it).
    Import Gherkin
    ...    Scenario: Table import
    ...    Given the following users:
    ...    | name${SPACE * 2}| role${SPACE * 2}|
    ...    | --- | --- |
    ...    | Alice | admin |
    ...    | Bob${SPACE * 3}| user${SPACE * 2}|
    Wait For Elements State    ${MODAL}    hidden
    Get Element Count    [data-gherkin-type="scenario"]    ==    2
    Get Element Count    [data-gherkin-type="given"]    ==    2
    Get Element Count    [data-gherkin-table]    ==    1

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — plain text skipped
    Open Session
    ${before}=    Get Element Count    .gherkin-editor [data-gherkin-type]
    Import Gherkin    This is just plain text with no keywords at all
    Wait For Elements State    ${MODAL}    hidden
    Get Element Count    .gherkin-editor [data-gherkin-type]    ==    ${before}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive with colon
    Open Session
    ${before}=    Get Element Count    [data-gherkin-type="given"]
    Import Gherkin    GIVEN: something uppercase
    Get Element Count    [data-gherkin-type="given"]    ==    ${before + 1}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive without colon
    Open Session
    ${before}=    Get Element Count    [data-gherkin-type="given"]
    Import Gherkin    Given something without a colon
    Get Element Count    [data-gherkin-type="given"]    ==    ${before + 1}


*** Keywords ***
Import Gherkin
    [Documentation]    Open the Import modal, fill the textarea with @{lines}
    ...    joined by newlines, and click Insert.
    [Arguments]    @{lines}
    ${text}=    Catenate    SEPARATOR=\n    @{lines}
    Click    ${IMPORT_BTN}
    Fill Text    ${TEXTAREA}    ${text}
    Click    ${CONFIRM}
