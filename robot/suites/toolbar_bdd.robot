*** Settings ***
Documentation       Business-language twin of toolbar.robot: spec §3.4 toolbar
...                 (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_editor.resource.
...                 Valid-next labels come from &{VALID_NEXT_LABELS} there.

Resource            ../resources/common.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    toolbar


*** Test Cases ***
SC-3.4.1: Toolbar shows valid next blocks and Image — no Feature shown on Feature block
    Given the cursor is inside a block
    When the editor toolbar renders
    Then the toolbar shows the block types that are valid next blocks for the current block, according to canFollow()

SC-3.4.1: Toolbar shows valid next blocks and Image — Rule, Background, Scenario after Feature
    Given the cursor is inside a block of type Feature
    When the editor toolbar renders
    Then the toolbar shows the block types that are valid next blocks for the current block, according to canFollow()

SC-3.4.1: Toolbar shows valid next blocks and Image — Image present on non-Feature block
    Given the cursor is inside a block of type Then
    When the editor toolbar renders
    Then the toolbar always shows an Image button, regardless of the current block type

SC-3.4.2: Clicking toolbar button inserts block and moves cursor — node inserted
    Given the toolbar is showing valid block types
    When the user clicks a toolbar button labelled Rule
    Then a new block of the chosen type is inserted after the current block
    And the cursor moves to the new block

SC-3.4.2: Clicking toolbar button inserts block and moves cursor — Scenario after Feature
    Given the toolbar is showing valid block types
    When the user clicks a toolbar button labelled Scenario
    Then a new block of the chosen type is inserted after the current block
    And the cursor moves to the new block
