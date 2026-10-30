*** Settings ***
Documentation       Business-language twin of initial_content.robot: spec §3.1
...                 initial scaffold content (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_editor.resource.
...                 `pnpm lint:robot-steps` checks every step against the spec.
...                 The `— second joiner does not re-seed` test opens two
...                 isolated contexts, like collaboration.robot, but lives here:
...                 the lint needs every line of SC-3.1.2 covered by the tests of
...                 the chunk that adds the scenario.

Resource            ../resources/common.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    initial-content


*** Test Cases ***
SC-3.1.2: New document seeded with 5 scaffold blocks once — order
    Given the Y.js document is empty after synchronisation
    When the first user's editor finishes syncing
    Then the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then

SC-3.1.2: New document seeded with 5 scaffold blocks once — empty text
    Given the Y.js document is empty after synchronisation
    When the first user's editor finishes syncing
    Then each scaffold block contains no text — only the keyword label is displayed

SC-3.1.2: New document seeded with 5 scaffold blocks once — cursor on Feature
    Given the Y.js document is empty after synchronisation
    When the first user's editor finishes syncing
    Then the cursor is placed at the start of the Feature block

SC-3.1.2: New document seeded with 5 scaffold blocks once — second joiner does not re-seed
    Given the Y.js document is empty after synchronisation
    When the first user's editor finishes syncing
    Then the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding
