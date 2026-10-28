*** Settings ***
Documentation       File keywords: temp images, downloads, and their cleanup.
...
...                 Every temp file a test creates is registered on a test-level
...                 list, and `Remove Temp Files` (used as the test teardown)
...                 deletes them, pass or fail. That is the Robot equivalent of
...                 the Playwright suite's `fs.unlinkSync` calls, but it also runs
...                 when an assertion fails half way through.

Library             Collections
Library             OperatingSystem
Resource            common.resource


*** Variables ***
# The same 1×1 PNG bytes the Playwright suite writes (hex).
${TINY_PNG_HEX}     89504e470d0a1a0a0000000d494844520000000100000001080200000090012e00000000c4944415478016360f8cfc00000000200016c3455300000000049454e44ae426082


*** Keywords ***
Unique Temp Path
    [Documentation]    Return a fresh path in the OS temp dir, e.g.
    ...    `/tmp/gherkin-download-<uuid>.txt`, and register it for cleanup.
    [Arguments]    ${prefix}    ${extension}
    ${uuid}=    Evaluate    uuid.uuid4().hex    modules=uuid
    ${path}=    Normalize Path    ${TEMPDIR}/${prefix}-${uuid}.${extension}
    Register Temp File    ${path}
    RETURN    ${path}

Register Temp File
    [Documentation]    Add ${path} to the files `Remove Temp Files` deletes.
    [Arguments]    ${path}
    ${files}=    Get Variable Value    ${TEMP_FILES}    ${{[]}}
    Append To List    ${files}    ${path}
    Set Test Variable    ${TEMP_FILES}    ${files}

Remove Temp Files
    [Documentation]    Test Teardown: run `Finish Test`, then delete every file
    ...    registered by this test. Missing files are ignored.
    Finish Test
    ${files}=    Get Variable Value    ${TEMP_FILES}    ${{[]}}
    FOR    ${path}    IN    @{files}
        Remove File    ${path}
    END

Tiny PNG Bytes
    [Documentation]    Return the 1×1 PNG as bytes. The hex string has an odd
    ...    length; Node's `Buffer.from(hex, "hex")` drops the trailing nibble,
    ...    so it is dropped here too to produce the very same bytes.
    ${bytes}=    Evaluate    bytes.fromhex($TINY_PNG_HEX[:len($TINY_PNG_HEX) // 2 * 2])
    RETURN    ${bytes}

Write Tiny PNG
    [Documentation]    Write the 1×1 PNG to a unique temp path and return it.
    ...    The file is removed by `Remove Temp Files`.
    ${path}=    Unique Temp Path    test-img    png
    ${bytes}=    Tiny PNG Bytes
    Create Binary File    ${path}    ${bytes}
    RETURN    ${path}

Download Via Button
    [Documentation]    Click ${selector}, wait for the download it triggers and
    ...    save it to a temp file. Returns the saved path and the browser's
    ...    suggested filename. Port of `page.waitForEvent("download")` + click +
    ...    `download.saveAs`: the promise is armed before the click.
    [Arguments]    ${selector}    ${extension}=txt
    ${path}=    Unique Temp Path    gherkin-download    ${extension}
    ${promise}=    Promise To Wait For Download    ${path}
    Click    ${selector}
    ${download}=    Wait For    ${promise}
    RETURN    ${download}[saveAs]    ${download}[suggestedFilename]

Read Lines
    [Documentation]    Return the UTF-8 content of ${path} split on "\\n"
    ...    (JavaScript `split("\\n")`: a trailing newline gives a final "").
    [Arguments]    ${path}
    ${content}=    Get File    ${path}    encoding=UTF-8
    ${lines}=    Evaluate    $content.split("\\n")
    RETURN    ${lines}
