*** Settings ***
Documentation       Business-language twin of visual_separation.robot: spec §3.7
...                 visual separation (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/THEN lines of its scenario; the steps
...                 live in ../resources/steps/gherkin_editor.resource. The
...                 Given step inserts the given / scenario block right after
...                 the then, and or but block through the toolbar. The
...                 "separator not in export" tests download the TXT export, so
...                 every test removes its temp files.

Resource            ../resources/common.resource
Resource            ../resources/files.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           bdd    visual-separation


*** Test Cases ***
SC-3.7.1: Given after then/and/but gets top border (visual only) — after then
    Given a given block immediately follows a then, and, or but block — then
    Then a horizontal rule and vertical space are rendered above the given block

SC-3.7.1: Given after then/and/but gets top border (visual only) — after and
    Given a given block immediately follows a then, and, or but block — and
    Then a horizontal rule and vertical space are rendered above the given block

SC-3.7.1: Given after then/and/but gets top border (visual only) — after but
    Given a given block immediately follows a then, and, or but block — but
    Then a horizontal rule and vertical space are rendered above the given block

SC-3.7.1: Given after then/and/but gets top border (visual only) — separator not in export
    Given a given block immediately follows a then, and, or but block — and
    Then a horizontal rule and vertical space are rendered above the given block
    And this separation is purely visual and does not affect the document structure or export output

SC-3.7.2: Scenario after then/and/but gets top border (visual only) — after then
    Given a scenario block immediately follows a then, and, or but block — then
    Then a horizontal rule and vertical space are rendered above the scenario block

SC-3.7.2: Scenario after then/and/but gets top border (visual only) — after and
    Given a scenario block immediately follows a then, and, or but block — and
    Then a horizontal rule and vertical space are rendered above the scenario block

SC-3.7.2: Scenario after then/and/but gets top border (visual only) — after but
    Given a scenario block immediately follows a then, and, or but block — but
    Then a horizontal rule and vertical space are rendered above the scenario block

SC-3.7.2: Scenario after then/and/but gets top border (visual only) — separator not in export
    Given a scenario block immediately follows a then, and, or but block — then
    Then a horizontal rule and vertical space are rendered above the scenario block
    And this separation is purely visual and does not affect the document structure or export output
