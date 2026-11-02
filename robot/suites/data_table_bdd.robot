*** Settings ***
Documentation       Business-language twin of data_table.robot: spec §3.11 data
...                 table insertion (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_editor.resource.
...                 Cells are named by row and column counted from 1. The
...                 collaborator scenario SC-3.11.10 is in collaboration_bdd.robot.
...                 The export scenarios SC-3.11.7 / SC-3.11.8 are in
...                 export_bdd.robot.

Resource            ../resources/common.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    data-table


*** Test Cases ***
SC-3.11.1: Table button shown when cursor is on step or data table — on Given
    Given the cursor is on a step block (given, when, then, and, or but) or on a data table block that follows a step — Given
    Then the toolbar shows a "Table" button

SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell
    Given the toolbar shows a "Table" button — cursor on Given
    When the user clicks it
    Then a 2×2 data table stub with empty cells is inserted immediately after the current block
    And the cursor is placed inside the first cell
    And text the user types next appears in the first cell

SC-3.11.3: Slash-command picker includes Table when on step block
    Given the user types / and the current/previous block is a step type
    Then the block picker includes "Table" as an option

SC-3.11.9: Choosing Table in the block picker puts the cursor in the first cell
    Given the block picker, opened by typing / on a step block, shows "Table" as an option
    When the user chooses "Table"
    Then a 2×2 data table stub with empty cells is inserted immediately after the step block
    And the / typed to open the picker is removed from the step block
    And the cursor is placed inside the first cell
    And text the user types next appears in the first cell

SC-3.11.4: Tab moves focus to next cell — within a row
    Given a data table is in the document
    When the user presses Tab inside a cell in row 1, column 1
    Then focus moves to the next cell (left to right, top to bottom) — row 1, column 2

SC-3.11.4: Tab moves focus to next cell — to the next row
    Given a data table is in the document
    When the user presses Tab inside a cell in row 1, column 2
    Then focus moves to the next cell (left to right, top to bottom) — row 2, column 1

SC-3.11.5: Shift+Tab moves focus to previous cell — within a row
    Given a data table is in the document
    When the user presses Shift+Tab inside a cell in row 1, column 2
    Then focus moves to the previous cell — row 1, column 1

SC-3.11.5: Shift+Tab moves focus to previous cell — to the previous row
    Given a data table is in the document
    When the user presses Shift+Tab inside a cell in row 2, column 1
    Then focus moves to the previous cell — row 1, column 2

SC-3.11.6: Add row and Add column controls available
    Given a data table is in the document
    Then "Add row" and "Add column" controls are available within the table UI
