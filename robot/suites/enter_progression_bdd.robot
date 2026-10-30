*** Settings ***
Documentation       Business-language twin of enter_progression.robot: spec §3.2
...                 Enter auto-progression (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_editor.resource.
...                 The expected block type is test data, written as the Then
...                 step's refinement (`— Scenario`), never worked out by a
...                 keyword. The expected types are the ones the technical tests
...                 assert.
...
...                 SC-3.2.2 (Enter on an image block) has no test here: the app
...                 cannot put the cursor on an image (issue #53, design D9).

Resource            ../resources/common.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    enter-progression


*** Test Cases ***
SC-3.2.1: Enter at end of block inserts auto-progression type — feature → scenario
    Given the cursor is at the end of a block of type Feature
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — Scenario
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — scenario → given
    Given the cursor is at the end of a block of type Scenario
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — Given
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — given → when
    Given the cursor is at the end of a block of type Given
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — When
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — when → then
    Given the cursor is at the end of a block of type When
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — Then
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — then → and
    Given the cursor is at the end of a block of type Then
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — And
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — and → and
    Given the cursor is at the end of a block of type And
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — And
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — but → and
    Given the cursor is at the end of a block of type But
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — And
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — background → given
    Given the cursor is at the end of a block of type Background
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — Given
    And the cursor is placed at the start of the new block's text

SC-3.2.1: Enter at end of block inserts auto-progression type — rule → scenario
    Given the cursor is at the end of a block of type Rule
    When the user presses Enter
    Then a new block of the auto-progression type is inserted immediately after the current block — Scenario
    And the cursor is placed at the start of the new block's text
