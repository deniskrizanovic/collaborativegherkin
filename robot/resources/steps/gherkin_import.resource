*** Settings ***
Documentation       Business-language steps for openspec/specs/gherkin-import/spec.md.
...
...                 Each keyword is named after a GIVEN/WHEN/THEN line of that
...                 spec, so a `bdd` test repeats its scenario word for word.
...                 Steps whose text also appears in another capability are in
...                 shared.resource. Title Case keywords at the bottom are
...                 technical helpers that tests never call.
...
...                 The import text is test data, passed in as `with ${NAME}`.
...                 The blocks a Then step expects are test data too, passed in
...                 after ` — `: a list of `type: text` strings, or of rows for a
...                 data table. No step works out what the parser should make.
...
...                 Shared variables set by the keywords of this file, all
...                 through `Remember Editor` when the Import button is clicked:
...                 ${CONTENT_BEFORE}: the editor's top-level nodes before the
...                 import (`Document Content In Editor`).
...                 ${CURRENT_NODE_INDEX}: index, among those nodes, of the node
...                 the cursor is in when Insert is clicked.
...                 ${TYPES_BEFORE}, ${BLOCKS_BEFORE}: see `Remember Editor`.

Library             Collections
Resource            ../session.resource
Resource            ../editor.resource
Resource            shared.resource


*** Keywords ***
# ---- Given ---------------------------------------------------------------

the user clicks the Import button
    [Documentation]    Open a fresh session and click Import.
    ...    Sets: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    a user is in a session editor
    Remember Editor
    Click    ${IMPORT_BUTTON}

the user clicks Cancel
    [Documentation]    Open the Import modal in a fresh session, type a keyword
    ...    line into the textarea, then click Cancel.
    ...    Sets: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    the user clicks the Import button
    Wait For Elements State    ${IMPORT_MODAL}    visible
    Fill Text    ${IMPORT_TEXTAREA}    Feature: Should not appear
    Click    ${IMPORT_CANCEL}

the user pastes or types Gherkin text into the textarea and clicks Insert with ${text}
    [Documentation]    Open the Import modal in a fresh session (cursor on the
    ...    Feature block), fill the textarea with ${text} and click Insert.
    ...    Sets: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    the user clicks the Import button
    Wait For Elements State    ${IMPORT_TEXTAREA}    visible
    Fill Text    ${IMPORT_TEXTAREA}    ${text}
    Click    ${IMPORT_CONFIRM}

# ---- Then ----------------------------------------------------------------

an "Import" button with class gherkin-import-btn is always visible in the toolbar
    [Documentation]    The button, labelled Import, is in the editor toolbar and
    ...    stays visible whichever block the cursor is in.
    ${button}=    Set Variable    ${TOOLBAR} >> ${IMPORT_BUTTON}
    Wait For Elements State    ${button}    visible
    Get Text    ${button}    ==    Import
    FOR    ${type}    IN    scenario    then
        ${block}=    Block Selector    ${type}
        Click Block    ${block} >> nth=-1
        Wait For Elements State    ${button}    visible
    END

a modal overlay with class gherkin-import-modal opens
    Wait For Elements State    ${IMPORT_MODAL}    visible

the modal contains a textarea with class gherkin-import-textarea
    Wait For Elements State    ${IMPORT_MODAL} >> textarea${IMPORT_TEXTAREA}    visible

the modal contains a confirm button .gherkin-import-confirm ("Insert")
    ${button}=    Set Variable    ${IMPORT_MODAL} >> button${IMPORT_CONFIRM}
    Wait For Elements State    ${button}    visible
    Get Text    ${button}    ==    Insert

the modal contains a cancel button .gherkin-import-cancel ("Cancel")
    ${button}=    Set Variable    ${IMPORT_MODAL} >> button${IMPORT_CANCEL}
    Wait For Elements State    ${button}    visible
    Get Text    ${button}    ==    Cancel

the modal closes without inserting anything
    [Documentation]    The modal closes and the editor's nodes are unchanged.
    ...    Reads: ${CONTENT_BEFORE}.
    Require Step State    CONTENT_BEFORE    the user clicks Cancel
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    ${content}=    Document Content In Editor
    Lists Should Be Equal    ${content}    ${CONTENT_BEFORE}

each recognisable keyword line is inserted as a Gherkin block at the current cursor position — ${expected}
    [Documentation]    The blocks in ${expected} (`type: text` strings) are
    ...    inserted right after the node the cursor was in; nothing else changes.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Require Step State    CONTENT_BEFORE    the user pastes or types Gherkin text into the textarea and clicks Insert with <text>
    Imported Blocks Should Be    ${expected}

pipe-delimited rows (| cell | cell |) are grouped into DataTable blocks — ${rows}
    [Documentation]    Exactly one data table is inserted, holding ${rows} (its
    ...    cells trimmed; the `| --- |` separator row is not a row).
    ...    Reads: ${CONTENT_BEFORE}.
    Require Step State    CONTENT_BEFORE    the user pastes or types Gherkin text into the textarea and clicks Insert with <text>
    ${inserted}=    Inserted Content
    ${tables}=    Evaluate    [n["rows"] for n in $inserted if n["node"] == "table"]
    Length Should Be    ${tables}    1    Expected one inserted data table: ${inserted}
    ${expected}=    Evaluate    [list(row) for row in $rows]
    Lists Should Be Equal    ${tables}[0]    ${expected}

lines that do not match any keyword or table pattern are skipped — ${expected}
    [Documentation]    Only the blocks in ${expected} (`type: text` strings)
    ...    are inserted; the other lines left nothing in the editor.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Require Step State    CONTENT_BEFORE    the user pastes or types Gherkin text into the textarea and clicks Insert with <text>
    Imported Blocks Should Be    ${expected}

blocks are inserted in the order they appear in the text, regardless of canFollow() validity — ${expected}
    [Documentation]    The blocks in ${expected} (`type: text` strings, in text
    ...    order) are inserted in that order, although the test data puts them
    ...    in a sequence the editor would not offer.
    ...    Reads: ${CONTENT_BEFORE}, ${CURRENT_NODE_INDEX}.
    Require Step State    CONTENT_BEFORE    the user pastes or types Gherkin text into the textarea and clicks Insert with <text>
    Imported Blocks Should Be    ${expected}

the modal closes and the textarea is cleared
    [Documentation]    The modal closes; reopened, its textarea is empty.
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    Click    ${IMPORT_BUTTON}
    Wait For Elements State    ${IMPORT_TEXTAREA}    visible
    Get Property    ${IMPORT_TEXTAREA}    value    ==    ${EMPTY}

# ---- Technical helpers ---------------------------------------------------

Inserted Content
    [Documentation]    Wait for the modal to close, check that the nodes before
    ...    the import are all still there, in order, around one run of new nodes
    ...    right after ${CURRENT_NODE_INDEX}, and return that run.
    Wait For Elements State    ${IMPORT_MODAL}    hidden
    ${content}=    Document Content In Editor
    ${split}=    Evaluate    ${CURRENT_NODE_INDEX} + 1
    ${tail}=    Evaluate    len($CONTENT_BEFORE) - $split
    ${head}=    Evaluate    $content[:$split]
    ${rest}=    Evaluate    $content[len($content) - $tail:] if $tail else []
    ${head_before}=    Evaluate    $CONTENT_BEFORE[:$split]
    ${rest_before}=    Evaluate    $CONTENT_BEFORE[$split:]
    Lists Should Be Equal    ${head}    ${head_before}
    Lists Should Be Equal    ${rest}    ${rest_before}
    ${inserted}=    Evaluate    $content[$split:len($content) - $tail]
    RETURN    ${inserted}

Imported Blocks Should Be
    [Documentation]    The nodes inserted right after ${CURRENT_NODE_INDEX} are
    ...    exactly the blocks in ${expected}, `type: text` strings in order.
    [Arguments]    ${expected}
    ${inserted}=    Inserted Content
    ${actual}=    Evaluate
    ...    [n["node"] + ": " + n["text"] if "text" in n else n["node"] for n in $inserted]
    ${expected}=    Evaluate    list($expected)
    Lists Should Be Equal    ${actual}    ${expected}
