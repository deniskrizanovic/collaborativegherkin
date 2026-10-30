*** Settings ***
Documentation       Business-language pilot of block_picker.robot (docs/robot-framework-evaluation.md §6.7).
...
...                 The same 9 tests, each written as the GIVEN/WHEN/THEN lines of
...                 its scenario in openspec/specs/gherkin-editor/spec.md. The
...                 gherkin-editor steps live in
...                 ../resources/steps/gherkin_editor.resource, steps shared with
...                 other capabilities (`the user presses Escape`) in
...                 ../resources/steps/shared.resource.
...                 `pnpm lint:robot-steps` checks every step against its spec
...                 scenario. The technical suite block_picker.robot stays next
...                 to this one.

Resource            ../resources/common.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           pilot    bdd    block-picker


*** Test Cases ***
SC-3.3.1: Typing / opens picker with valid next blocks and Image
    Given the cursor is inside a block
    When the user types /
    Then a block picker menu opens

SC-3.3.1: Typing / opens picker with valid next blocks and Image — only valid types shown
    Given the cursor is inside a block on a new line after Feature
    When the user types /
    Then a block picker menu opens
    And the menu lists the block types that are valid next blocks for the current block, according to canFollow()

SC-3.3.2: Down arrow moves picker focus to next item
    Given the block picker menu is open
    When the user presses the down arrow key
    Then focus moves to the next item in the list

SC-3.3.3: Up arrow moves picker focus to previous item
    Given the block picker menu is open
    When the user presses the up arrow key
    Then focus moves to the previous item in the list

SC-3.3.4: Enter on focused picker item inserts type and closes
    Given the block picker menu is open and an item is focused
    When the user presses Enter
    Then the focused block type is inserted and the menu closes

SC-3.3.5: Clicking picker item inserts type and closes
    Given the block picker menu is open and an item is focused
    When the user clicks the item
    Then the clicked block type is inserted and the menu closes

SC-3.3.6: Escape closes picker without inserting
    Given the block picker menu is open
    When the user presses Escape
    Then the menu closes without inserting a block

SC-3.3.7: Clicking outside picker closes without inserting
    Given the block picker menu is open
    When the user clicks outside the menu
    Then the menu closes without inserting a block

SC-3.3.1: Typing / opens picker with valid next blocks and Image — Image always last
    Given the cursor is inside a block on a new line after Scenario
    When the user types /
    Then a block picker menu opens
    And the menu always includes Image as the final option, regardless of the current block type
    Given the cursor is inside a block on a new line after Then
    When the user types /
    Then a block picker menu opens
    And the menu always includes Image as the final option, regardless of the current block type
