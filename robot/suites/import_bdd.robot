*** Settings ***
Documentation       Business-language twin of import.robot: spec §7.1 Gherkin
...                 text import (openspec/specs/gherkin-import/spec.md).
...
...                 Each test is the GIVEN/THEN lines of its scenario; the steps
...                 live in ../resources/steps/gherkin_import.resource and
...                 shared.resource. Import texts and the blocks each should
...                 become are test data in *** Variables ***. The session opens
...                 with the cursor on the Feature block, so imported blocks land
...                 right after it.

Resource            ../resources/common.resource
Resource            ../resources/steps/gherkin_import.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    import


*** Variables ***
${VALID_SEQUENCE}
...                 Feature: My feature
...                 Scenario: My scenario
...                 Given some context
...                 When I do something
...                 Then I see the result
...                 separator=\n
@{VALID_SEQUENCE_BLOCKS}
...                 feature: My feature
...                 scenario: My scenario
...                 given: some context
...                 when: I do something
...                 then: I see the result
# Then before Feature before Given: an order the editor never offers.
${OUT_OF_ORDER}
...                 Then the result comes first
...                 Feature: A feature in the middle
...                 Given the context comes last
...                 separator=\n
@{OUT_OF_ORDER_BLOCKS}
...                 then: the result comes first
...                 feature: A feature in the middle
...                 given: the context comes last
${SINGLE_FEATURE}    Feature: Test
${MARKDOWN_PREFIXED}
...                 \# Feature: Markdown feature
...                 \#\# Scenario: Markdown scenario
...                 - Given: some context
...                 - When: I do something
...                 - Then: I see the result
...                 separator=\n
@{MARKDOWN_PREFIXED_BLOCKS}
...                 feature: Markdown feature
...                 scenario: Markdown scenario
...                 given: some context
...                 when: I do something
...                 then: I see the result
# ${SPACE * 2} keeps double spaces inside a cell (two spaces would split it).
${PIPE_ROWS}
...                 Scenario: Table import
...                 Given the following users:
...                 | name${SPACE * 2}| role${SPACE * 2}|
...                 | --- | --- |
...                 | Alice | admin |
...                 | Bob${SPACE * 3}| user${SPACE * 2}|
...                 separator=\n
${PIPE_ROWS_TABLE}    ${{[["name", "role"], ["Alice", "admin"], ["Bob", "user"]]}}
${MIXED_WITH_PLAIN_TEXT}
...                 This is just plain text with no keywords at all
...                 Scenario: Kept scenario
...                 Featuring nothing in particular
...                 Given a kept step
...                 separator=\n
@{MIXED_WITH_PLAIN_TEXT_BLOCKS}
...                 scenario: Kept scenario
...                 given: a kept step
${UPPERCASE_WITH_COLON}    GIVEN: something uppercase
@{UPPERCASE_WITH_COLON_BLOCKS}    given: something uppercase
${WITHOUT_COLON}    Given something without a colon
@{WITHOUT_COLON_BLOCKS}    given: something without a colon


*** Test Cases ***
SC-7.1.1: Import button always visible in toolbar
    Given a user is in a session editor
    When the editor renders
    Then an "Import" button with class gherkin-import-btn is always visible in the toolbar

SC-7.1.2: Clicking Import opens modal with textarea and buttons
    Given the user clicks the Import button
    Then a modal overlay with class gherkin-import-modal opens
    And the modal contains a textarea with class gherkin-import-textarea
    And the modal contains a confirm button .gherkin-import-confirm ("Insert")
    And the modal contains a cancel button .gherkin-import-cancel ("Cancel")

SC-7.1.4: Cancel closes modal without inserting
    Given the user clicks Cancel
    Then the modal closes without inserting anything

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — valid sequence
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${VALID_SEQUENCE}
    Then each recognisable keyword line is inserted as a Gherkin block at the current cursor position — ${VALID_SEQUENCE_BLOCKS}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — out-of-order inserted leniently
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${OUT_OF_ORDER}
    Then blocks are inserted in the order they appear in the text, regardless of canFollow() validity — ${OUT_OF_ORDER_BLOCKS}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — textarea cleared
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${SINGLE_FEATURE}
    Then the modal closes and the textarea is cleared

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — markdown-prefixed Gherkin parsed
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${MARKDOWN_PREFIXED}
    Then each recognisable keyword line is inserted as a Gherkin block at the current cursor position — ${MARKDOWN_PREFIXED_BLOCKS}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — pipe rows become DataTable
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${PIPE_ROWS}
    Then pipe-delimited rows (| cell | cell |) are grouped into DataTable blocks — ${PIPE_ROWS_TABLE}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — plain text skipped
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${MIXED_WITH_PLAIN_TEXT}
    Then lines that do not match any keyword or table pattern are skipped — ${MIXED_WITH_PLAIN_TEXT_BLOCKS}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive with colon
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${UPPERCASE_WITH_COLON}
    Then each recognisable keyword line is inserted as a Gherkin block at the current cursor position — ${UPPERCASE_WITH_COLON_BLOCKS}

SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive without colon
    Given the user pastes or types Gherkin text into the textarea and clicks Insert with ${WITHOUT_COLON}
    Then each recognisable keyword line is inserted as a Gherkin block at the current cursor position — ${WITHOUT_COLON_BLOCKS}
