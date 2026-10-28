*** Settings ***
Documentation       Port of e2e/image.spec.ts — spec §3.8 image blocks: toolbar
...                 button, slash-command picker, and drag-and-drop. The file
...                 picker is fed with `Upload File By Selector` (Playwright
...                 `setInputFiles`); the drop is a synthetic DataTransfer event.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           chunk3    image


*** Variables ***
${PICKER}           [style*="position: fixed"]
${IMAGE}            .gherkin-image-block img


*** Test Cases ***
SC-3.8.1: Image toolbar button opens file picker and embeds image
    Open Session
    ${png}=    Write Tiny PNG
    Click    [data-gherkin-type="then"] >> nth=-1
    ${image_button}=    Toolbar Button    Image
    Click    ${image_button}
    Upload File By Selector    input[type="file"]    ${png}
    Wait For Elements State    .gherkin-image-block    visible
    Wait For Elements State    ${IMAGE}    visible
    # The image really renders: a non-null box with both sides > 0.
    ${box}=    Get BoundingBox    ${IMAGE}
    Should Not Be Equal    ${box}    ${None}
    Should Be True    ${box}[width] > 0
    Should Be True    ${box}[height] > 0

SC-3.8.2: Slash-command Image selection opens file picker and embeds image
    Open Session
    ${png}=    Write Tiny PNG
    Click    [data-gherkin-type="then"] >> nth=-1
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    # Image is always the last picker option.
    Click    ${PICKER} >> button >> nth=-1
    Upload File By Selector    input[type="file"]    ${png}
    Wait For Elements State    .gherkin-image-block    visible

SC-3.8.3: Drag and drop image embeds at drop position
    Open Session
    ${bytes}=    Tiny PNG Bytes
    ${base64}=    Evaluate    base64.b64encode($bytes).decode()    modules=base64
    ${arg}=    Create Dictionary    selector=.gherkin-editor-wrapper    base64=${base64}
    Evaluate JavaScript    ${None}
    ...    ({ selector, base64 }) => {
    ...        const el = document.querySelector(selector);
    ...        if (!el) return;
    ...        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    ...        const file = new File([bytes], "test.png", { type: "image/png" });
    ...        const dt = new DataTransfer();
    ...        dt.items.add(file);
    ...        el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    ...    }
    ...    arg=${arg}
    Wait For Elements State    .gherkin-image-block    visible
