*** Settings ***
Documentation       Port of e2e/import.spec.ts — spec §7.1 Gherkin text import.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk1    import


*** Test Cases ***
SC-7.1.1: Import button always visible in toolbar
    Open Session
    Wait For Elements State    ${IMPORT_BUTTON}    visible

SC-7.1.2: Clicking Import opens modal with textarea and buttons
    Open Session
    Click    ${IMPORT_BUTTON}
    Wait For Elements State    ${IMPORT_MODAL}    visible
    Wait For Elements State    ${IMPORT_TEXTAREA}    visible
    Wait For Elements State    ${IMPORT_CONFIRM}    visible
    Wait For Elements State    ${IMPORT_CANCEL}    visible

SC-7.1.4: Cancel closes modal without inserting
    Open Session
    Click    ${IMPORT_BUTTON}
    Fill Text    ${IMPORT_TEXTAREA}    Feature: Should not appear
    Click    ${IMPORT_CANCEL}
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    Get Element Count    ${BLOCK_TYPE}[feature]    ==    1

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — valid sequence
    Open Session
    Import Gherkin
    ...    Feature: My feature
    ...    Scenario: My scenario
    ...    Given some context
    ...    When I do something
    ...    Then I see the result
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    Get Element Count    ${BLOCK_TYPE}[feature]    ==    2
    Get Element Count    ${BLOCK_TYPE}[scenario]    ==    2
    Get Element Count    ${BLOCK_TYPE}[given]    ==    2
    Get Element Count    ${BLOCK_TYPE}[when]    ==    2
    Get Element Count    ${BLOCK_TYPE}[then]    ==    2

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — out-of-order inserted leniently
    Open Session
    Import Gherkin    Scenario: Orphan    Given context
    Get Element Count    ${BLOCK_TYPE}[scenario]    ==    2
    Get Element Count    ${BLOCK_TYPE}[given]    ==    2

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — textarea cleared
    Open Session
    Import Gherkin    Feature: Test
    # Reopen modal and verify textarea is empty.
    Click    ${IMPORT_BUTTON}
    Get Property    ${IMPORT_TEXTAREA}    value    ==    ${EMPTY}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — markdown-prefixed Gherkin parsed
    Open Session
    Import Gherkin
    ...    \# Feature: Markdown feature
    ...    \#\# Scenario: Markdown scenario
    ...    - Given: some context
    ...    - When: I do something
    ...    - Then: I see the result
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    Get Element Count    ${BLOCK_TYPE}[feature]    ==    2
    Get Element Count    ${BLOCK_TYPE}[scenario]    ==    2
    Get Element Count    ${BLOCK_TYPE}[given]    ==    2
    Get Element Count    ${BLOCK_TYPE}[when]    ==    2
    Get Element Count    ${BLOCK_TYPE}[then]    ==    2

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
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    Get Element Count    ${BLOCK_TYPE}[scenario]    ==    2
    Get Element Count    ${BLOCK_TYPE}[given]    ==    2
    Get Element Count    ${TABLE}    ==    1

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — plain text skipped
    Open Session
    ${before}=    Get Element Count    ${BLOCKS}
    Import Gherkin    This is just plain text with no keywords at all
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    Get Element Count    ${BLOCKS}    ==    ${before}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive with colon
    Open Session
    ${before}=    Get Element Count    ${BLOCK_TYPE}[given]
    Import Gherkin    GIVEN: something uppercase
    Get Element Count    ${BLOCK_TYPE}[given]    ==    ${before + 1}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive without colon
    Open Session
    ${before}=    Get Element Count    ${BLOCK_TYPE}[given]
    Import Gherkin    Given something without a colon
    Get Element Count    ${BLOCK_TYPE}[given]    ==    ${before + 1}


*** Keywords ***
Import Gherkin
    [Documentation]    Open the Import modal, fill the textarea with @{lines}
    ...    joined by newlines, and click Insert.
    [Arguments]    @{lines}
    ${text}=    Catenate    SEPARATOR=\n    @{lines}
    Click    ${IMPORT_BUTTON}
    Fill Text    ${IMPORT_TEXTAREA}    ${text}
    Click    ${IMPORT_CONFIRM}
