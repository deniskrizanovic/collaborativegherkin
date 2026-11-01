*** Settings ***
Documentation       Port of e2e/image.spec.ts — spec §3.8 image blocks: toolbar
...                 button, slash-command picker, and drag-and-drop; spec §3.12
...                 selecting an image by click and arrow key, typing on it, and
...                 removing it with Backspace and undoing that. The file
...                 picker is fed with `Upload File By Selector` (Playwright
...                 `setInputFiles`); the drop is a synthetic DataTransfer event.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           chunk3    image


*** Test Cases ***
SC-3.8.1: Image toolbar button opens file picker and embeds image
    Open Session
    Insert Image After Block    then
    Wait For Elements State    ${IMAGE_BLOCK}    visible
    Wait For Elements State    ${IMAGE_BLOCK} img    visible
    # The image really renders: a non-null box with both sides > 0.
    ${box}=    Get BoundingBox    ${IMAGE_BLOCK} img
    Should Not Be Equal    ${box}    ${None}
    Should Be True    ${box}[width] > 0
    Should Be True    ${box}[height] > 0

SC-3.8.2: Slash-command Image selection opens file picker and embeds image
    Open Session
    ${png}=    Write Tiny PNG
    ${then}=    Block Selector    then
    Click    ${then} >> nth=-1
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    # Image is always the last picker option.
    Click    ${PICKER} >> button >> nth=-1
    Upload File By Selector    ${FILE_INPUT}    ${png}
    Wait For Elements State    ${IMAGE_BLOCK}    visible

SC-3.8.3: Drag and drop image embeds at drop position
    Open Session
    ${bytes}=    Tiny PNG Bytes
    ${base64}=    Evaluate    base64.b64encode($bytes).decode()    modules=base64
    ${arg}=    Create Dictionary    selector=${EDITOR_WRAPPER}    base64=${base64}
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
    Wait For Elements State    ${IMAGE_BLOCK}    visible

SC-3.12.1: Clicking an image selects it
    Build Then Image And
    Get Element Count    ${SELECTED_IMAGE}    ==    0
    Click    ${IMAGE_BLOCK}
    Get Element Count    ${SELECTED_IMAGE}    ==    1

SC-3.12.2: Arrow key moves the selection onto an image
    Build Then Image And
    Click Block    ${BLOCK_TYPE}[then]
    Keyboard Key    press    End
    # Then is node 4; wait for the editor to have the caret at its end.
    Wait For Cursor At    4    ${{len("Before image")}}
    Get Element Count    ${SELECTED_IMAGE}    ==    0
    Keyboard Key    press    ArrowRight
    Get Element Count    ${SELECTED_IMAGE}    ==    1

SC-3.12.3: Typing does not replace a selected image — letter
    Typing On Selected Image Changes Nothing    x

SC-3.12.3: Typing does not replace a selected image — slash
    Typing On Selected Image Changes Nothing    /

SC-3.12.4: Backspace removes a selected image
    Build Then Image And
    Select Image
    Keyboard Key    press    Backspace
    Get Element Count    ${IMAGE_BLOCK}    ==    0
    ${nodes}=    Document Nodes In Editor
    ${expected}=    Create List    feature    scenario    given    when    then    and
    Lists Should Be Equal    ${nodes}    ${expected}
    Get Text    ${BLOCK_TYPE}[then]    ==    Before image
    Get Text    ${BLOCK_TYPE}[and]    ==    After image

SC-3.12.4: Backspace removes a selected image — undo restores it
    Build Then Image And
    Select Image
    End Undo Step
    Keyboard Key    press    Backspace
    Get Element Count    ${IMAGE_BLOCK}    ==    0
    Keyboard Key    press    ControlOrMeta+z
    Get Element Count    ${IMAGE_BLOCK}    ==    1
    ${expected}=    Create List    feature    scenario    given    when    then    image    and
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${expected}
    # Undo selects the image again, so typing must not replace it.
    Get Element Count    ${SELECTED_IMAGE}    ==    1
    Keyboard Input    type    x
    ${nodes}=    Document Nodes In Editor
    Lists Should Be Equal    ${nodes}    ${expected}
    Get Text    ${BLOCK_TYPE}[then]    ==    Before image
    Get Text    ${BLOCK_TYPE}[and]    ==    After image
    Click Block    ${BLOCK_TYPE}[and]
    Keyboard Key    press    End
    Wait For Cursor At    6    ${{len("After image")}}
    Keyboard Input    type    ${SPACE}still typing
    Get Text    ${BLOCK_TYPE}[and]    ==    After image still typing
    ${errors}=    Get Page Errors
    Should Be Empty    ${errors}


*** Keywords ***
Typing On Selected Image Changes Nothing
    [Documentation]    Select the image of Then, image, And and type ${key}: the
    ...    image stays, the text is unchanged and the block picker stays shut.
    [Arguments]    ${key}
    Build Then Image And
    ${text_before}=    Get Text    ${EDITOR}
    Select Image
    Keyboard Input    type    ${key}
    Get Element Count    ${IMAGE_BLOCK}    ==    1
    ${nodes}=    Document Nodes In Editor
    ${expected}=    Create List    feature    scenario    given    when    then    image    and
    Lists Should Be Equal    ${nodes}    ${expected}
    Get Text    ${EDITOR}    ==    ${text_before}
    Get Element Count    ${PICKER}    ==    0
