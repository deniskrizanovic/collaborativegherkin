*** Settings ***
Documentation       Business-language twin of image.robot: spec §3.8 image
...                 insertion and §3.12 image block selection
...                 (openspec/specs/gherkin-editor/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_editor.resource and
...                 shared.resource. The When step arms `Promise To Upload File`
...                 before the click, so "a file picker opens" fails if no file
...                 chooser opens (design D8).

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

SC-3.8.3: Drag and drop image embeds at drop position
    Given a user is in a session editor with the cursor in the Feature block
    When the user drops an image file onto the Then block
    Then the image is embedded as an image block immediately after the Then block
    And the Feature block is still followed by the block that followed it before the drop

SC-3.8.5: Image dropped outside every block embeds after the nearest block — below the last block
    Given a user is in a session editor with the cursor in the Feature block
    When the user drops an image file below the last block
    Then the image is embedded as an image block at the end of the document

SC-3.12.1: Clicking an image selects it
    Given a document contains an image block that is not selected
    When the user clicks the image
    Then the image is shown as selected

SC-3.12.2: Arrow key moves the selection onto an image
    Given the cursor is at the end of the block directly before an image block
    When the user presses ArrowRight
    Then the image is shown as selected

SC-3.12.3: Typing does not replace a selected image — letter
    Given an image block is selected
    When the user types a letter or / — letter
    Then the image stays in the document
    And no text is inserted and the block picker does not open

SC-3.12.3: Typing does not replace a selected image — slash
    Given an image block is selected
    When the user types a letter or / — slash
    Then the image stays in the document
    And no text is inserted and the block picker does not open

SC-3.12.4: Backspace removes a selected image
    Given an image block between two Gherkin blocks is selected
    When the user presses Backspace
    Then the image is removed from the document
    And the Gherkin blocks on either side of it are unchanged
