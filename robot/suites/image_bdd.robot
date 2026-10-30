*** Settings ***
Documentation       Business-language twin of image.robot: spec §3.8 image
...                 insertion (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_editor.resource and
...                 shared.resource. The When step arms `Promise To Upload File`
...                 before the click, so "a file picker opens" fails if no file
...                 chooser opens (design D8). SC-3.8.3 (drag and drop at the
...                 drop position) is excluded until issue #54 is fixed: the
...                 drop handler ignores the drop coordinates.

Resource            ../resources/common.resource
Resource            ../resources/files.resource
Resource            ../resources/steps/gherkin_editor.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           bdd    image


*** Test Cases ***
SC-3.8.1: Image toolbar button opens file picker and embeds image
    Given a user is in a session editor
    When the user clicks the Image toolbar button
    Then a file picker opens
    And selecting an image file embeds it as an image block immediately after the current block

SC-3.8.2: Slash-command Image selection opens file picker and embeds image
    Given a user is in a session editor
    When the user types / and selects Image from the block picker
    Then a file picker opens
    And selecting an image file embeds it as an image block immediately after the current block
