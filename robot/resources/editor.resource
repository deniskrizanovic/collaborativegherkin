*** Settings ***
Documentation       Editor keywords and selectors: blocks, the toolbar, the
...                 block picker, image insertion, data tables, and the export
...                 and import controls.
...
...                 Every editor selector a suite or step resource needs is a
...                 variable here; no other file redefines one. Keywords are
...                 Title Case technical helpers. Business-language steps live in
...                 steps/*.resource and call these. Sessions, the page API,
...                 contexts and cookies are in session.resource; temp files and
...                 downloads in files.resource.

Library             Collections
Resource            common.resource
Resource            files.resource


*** Variables ***
${EDITOR}           .gherkin-editor
${EDITOR_WRAPPER}    .gherkin-editor-wrapper
${BLOCKS}           .gherkin-editor [data-gherkin-type]
# Every block of one type, by lower-case type: `${BLOCK_TYPE}[given]`.
# `Block Selector` returns the same for a type held in a variable.
&{BLOCK_TYPE}       feature=[data-gherkin-type="feature"]
...                 rule=[data-gherkin-type="rule"]
...                 background=[data-gherkin-type="background"]
...                 scenario=[data-gherkin-type="scenario"]
...                 given=[data-gherkin-type="given"]
...                 when=[data-gherkin-type="when"]
...                 then=[data-gherkin-type="then"]
...                 and=[data-gherkin-type="and"]
...                 but=[data-gherkin-type="but"]
# The block picker is the only fixed-position element the editor renders.
${PICKER}           [style*="position: fixed"]
# Background of the focused picker item.
${FOCUSED_BG}       rgba(0, 38, 100, 0.06)
${IMAGE_BLOCK}      .gherkin-image-block
${TABLE}            [data-gherkin-table]
${CELL_0_0}         ${TABLE} [data-cell='0-0']
${CELL_0_1}         ${TABLE} [data-cell='0-1']
${TOOLBAR_BUTTON}    .gherkin-toolbar-btn
${TABLE_TOOLBAR}     .gherkin-table-toolbar
${TABLE_TOOLBAR_BUTTON}    .gherkin-table-toolbar-btn
${FILE_INPUT}       input[type="file"]
${TOOLBAR}          .gherkin-toolbar
${EXPORT_BUTTON}    .gherkin-export-btn
${EXPORT_MD_BUTTON}    .gherkin-export-md-btn
${IMPORT_BUTTON}    .gherkin-import-btn
${IMPORT_MODAL}     .gherkin-import-modal
${IMPORT_TEXTAREA}    .gherkin-import-textarea
${IMPORT_CONFIRM}    .gherkin-import-confirm
${IMPORT_CANCEL}    .gherkin-import-cancel


*** Keywords ***
# ---- Blocks --------------------------------------------------------------

Block Selector
    [Documentation]    Return the selector of every block of ${type}
    ...    (its entry in &{BLOCK_TYPE}). ${type} is the lower-case type.
    [Arguments]    ${type}
    RETURN    ${BLOCK_TYPE}[${type}]

Click Block
    [Documentation]    Click ${selector} and wait until the editor's selection
    ...    is inside it. ProseMirror reads the selection a click makes on the
    ...    asynchronous `selectionchange` event, so a key pressed straight after
    ...    a plain `Click` can still act on the block selected before. Reads the
    ...    selection through the handle Tiptap puts on the editor's DOM node
    ...    (`.ProseMirror`.editor). No helpers.ts counterpart.
    [Arguments]    ${selector}
    Click    ${selector}
    ${js}=    Catenate
    ...    (el) => { const editor = el.closest(".ProseMirror").editor;
    ...    const start = editor.view.posAtDOM(el, 0); const { from } = editor.state.selection;
    ...    return from >= start && from <= start + el.textContent.length; }
    Wait For Function    ${js}    selector=${selector}

Press Enter And Wait For Block
    [Documentation]    Press Enter, wait until one more block of ${type} exists,
    ...    then click the last one. Port of helpers.ts `pressEnterAndWait`:
    ...    never assume a keypress has taken effect.
    [Arguments]    ${type}
    ${selector}=    Block Selector    ${type}
    ${before}=    Get Element Count    ${selector}
    Keyboard Key    press    Enter
    Get Element Count    ${selector}    >    ${before}
    Click    ${selector} >> nth=-1

Type Into Block
    [Documentation]    Click the first block of ${type} and type ${text}. Port
    ...    of the `editor.locator(...).first().click()` + `keyboard.type` pairs
    ...    in the e2e specs (no helpers.ts function).
    [Arguments]    ${type}    ${text}
    ${selector}=    Block Selector    ${type}
    Click    ${selector} >> nth=0
    Keyboard Input    type    ${text}

Click Editor
    [Documentation]    Click the editor surface. Port of helpers.ts `clickEditor`.
    Click    ${EDITOR}

Block Types In Editor
    [Documentation]    Return the `data-gherkin-type` of every block in the
    ...    editor, in document order. Port of the `evaluateAll` calls on
    ...    helpers.ts `editorLocator` in the e2e specs.
    ${types}=    Evaluate JavaScript    ${BLOCKS}
    ...    (els) => els.map((el) => el.getAttribute("data-gherkin-type"))
    ...    all_elements=True
    RETURN    ${types}

Document Content In Editor
    [Documentation]    Return every top-level node of the editor in document
    ...    order as a dictionary. `node` is the `data-gherkin-type` of a block,
    ...    `image` for an image block, `table` for a data table, else the tag
    ...    name. A block also has `text`, an image `src` and `alt`, a data
    ...    table `rows` (cell texts, row by row). No helpers.ts counterpart.
    ${js}=    Catenate
    ...    (el) => [...el.children].map((child) => {
    ...    const type = child.getAttribute("data-gherkin-type");
    ...    if (type) return { node: type, text: child.textContent };
    ...    if (child.classList.contains("gherkin-image-block")) {
    ...    const img = child.querySelector("img");
    ...    return { node: "image", src: img.getAttribute("src"), alt: img.getAttribute("alt") }; }
    ...    if (child.hasAttribute("data-gherkin-table")) return { node: "table",
    ...    rows: [...child.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("[data-cell]")].map((cell) => cell.textContent)) };
    ...    return { node: child.tagName.toLowerCase() }; })
    ${content}=    Evaluate JavaScript    ${EDITOR}    ${js}
    RETURN    ${content}

Document Nodes In Editor
    [Documentation]    Return the `node` of every top-level node of the editor,
    ...    in document order (`Document Content In Editor`). Unlike `Block
    ...    Types In Editor` it shows where images and tables sit. No helpers.ts
    ...    counterpart.
    ${content}=    Document Content In Editor
    ${nodes}=    Evaluate    [n["node"] for n in $content]
    RETURN    ${nodes}

Cursor Position
    [Documentation]    Return where the editor's selection starts, as a
    ...    dictionary: `index`, among `Document Nodes In Editor`, of the
    ...    top-level node it is in; `offset`, its offset in the text of the
    ...    block holding it; `empty`, true for a bare cursor. Reads the
    ...    selection through the handle Tiptap puts on the editor's DOM node,
    ...    like `Click Block`. No helpers.ts counterpart.
    ${js}=    Catenate
    ...    (el) => { const { $from, empty } = el.editor.state.selection;
    ...    return { index: $from.index(0), offset: $from.parentOffset, empty }; }
    ${position}=    Evaluate JavaScript    ${EDITOR}    ${js}
    RETURN    ${position}

Current Node Index
    [Documentation]    Return the index, among `Document Nodes In Editor`, of
    ...    the top-level node the editor's selection is in (`Cursor Position`).
    ...    No helpers.ts counterpart.
    ${position}=    Cursor Position
    RETURN    ${position}[index]

Last Index Of
    [Documentation]    Return the index of the last ${value} in ${list}
    ...    (JavaScript `lastIndexOf`, as the e2e specs use it), or -1 when absent.
    [Arguments]    ${list}    ${value}
    ${index}=    Evaluate    len($list) - 1 - $list[::-1].index($value) if $value in $list else -1
    RETURN    ${index}

Texts Of All
    [Documentation]    Return the textContent of every element matching
    ...    ${selector}. Port of Playwright `allTextContents` in the e2e specs.
    [Arguments]    ${selector}
    ${texts}=    Evaluate JavaScript    ${selector}
    ...    (els) => els.map((el) => el.textContent ?? "")
    ...    all_elements=True
    RETURN    ${texts}

Put Cursor At End Of Block
    [Documentation]    Put the cursor at the end of the last block of ${type}.
    ...    The seed holds feature, scenario, given, when and then, so those are
    ...    clicked. A missing and / but is first inserted through the toolbar
    ...    after the last then, and or but block, and a missing background /
    ...    rule after the last feature, rule or background block. Inserting
    ...    after the last of the group keeps types inserted one after another
    ...    in the order they were asked for. Fails when the toolbar does not
    ...    offer ${type} there (e.g. a rule after a background). No helpers.ts
    ...    counterpart.
    [Arguments]    ${type}
    ${selector}=    Block Selector    ${type}
    ${count}=    Get Element Count    ${selector}
    IF    ${count} == 0
        IF    "${type}" in ("and", "but")
            ${anchor}=    Set Variable    ${BLOCK_TYPE}[then], ${BLOCK_TYPE}[and], ${BLOCK_TYPE}[but]
        ELSE
            ${anchor}=    Set Variable    ${BLOCK_TYPE}[feature], ${BLOCK_TYPE}[rule], ${BLOCK_TYPE}[background]
        END
        Click Block    ${anchor} >> nth=-1
        Click Toolbar Button    ${type.title()}
        Get Element Count    ${selector}    >    0
    END
    Click Block    ${selector} >> nth=-1
    Keyboard Key    press    End

Type Document
    [Documentation]    Type each text of ${document}, a dictionary of block
    ...    type to text, at the end of the last block of that type, in the
    ...    dictionary's order. Types the seed lacks are inserted as they come
    ...    (see `Put Cursor At End Of Block`), so `rule` before `background`
    ...    gives feature, rule, background, and `and` before `but` gives then,
    ...    and, but. No helpers.ts counterpart.
    [Arguments]    ${document}
    FOR    ${type}    ${text}    IN    &{document}
        Put Cursor At End Of Block    ${type}
        Keyboard Input    type    ${text}
    END

Build Scaffold To Then
    [Documentation]    From the seed with the cursor on Feature, press Enter
    ...    four times (feature → scenario → given → when → then), waiting for
    ...    each new block. Ends with the cursor on the last then block.
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    Press Enter And Wait For Block    when
    Press Enter And Wait For Block    then

Remember Editor
    [Documentation]    Record the editor before an action, so a later check
    ...    can compare. One snapshot for every step that needs a before-state.
    ...    Sets: ${CONTENT_BEFORE} (top-level nodes, `Document Content In
    ...    Editor`), ${TYPES_BEFORE} (the blocks' types in document order),
    ...    ${BLOCKS_BEFORE} (block count), ${CURRENT_NODE_INDEX} (index, among
    ...    the top-level nodes, of the one the cursor is in).
    ${content}=    Document Content In Editor
    ${types}=    Evaluate    [n["node"] for n in $content if "text" in n]
    ${index}=    Current Node Index
    Set Test Variable    ${CONTENT_BEFORE}    ${content}
    Set Test Variable    ${TYPES_BEFORE}    ${types}
    Set Test Variable    ${BLOCKS_BEFORE}    ${{len($types)}}
    Set Test Variable    ${CURRENT_NODE_INDEX}    ${index}

# ---- Toolbar -------------------------------------------------------------

Toolbar Button Texts
    [Documentation]    Return the label of every toolbar button. Port of the
    ...    `.gherkin-toolbar-btn` `allTextContents` calls in the e2e specs.
    ${texts}=    Texts Of All    ${TOOLBAR_BUTTON}
    RETURN    ${texts}

Toolbar Button
    [Documentation]    Return the selector for the toolbar button labelled
    ...    ${label}. Port of the `.gherkin-toolbar-btn` `filter({ hasText })`
    ...    locators in the e2e specs.
    [Arguments]    ${label}
    RETURN    ${TOOLBAR_BUTTON}:has-text("${label}")

Click Toolbar Button
    [Documentation]    Click the toolbar button labelled ${label}.
    [Arguments]    ${label}
    ${button}=    Toolbar Button    ${label}
    Click    ${button}

# ---- Block picker --------------------------------------------------------

Close Picker If Open
    [Documentation]    Press Escape and wait for the block picker to close, if
    ...    it is open. Lets a test visit several picker contexts in a row.
    ${open}=    Get Element Count    ${PICKER}
    IF    ${open} > 0
        Keyboard Key    press    Escape
        Wait For Elements State    ${PICKER}    hidden
    END

# ---- Images --------------------------------------------------------------

Insert Image After Block
    [Documentation]    Put the cursor on the last block of ${type}, click the
    ...    toolbar Image button, feed the file picker a 1×1 PNG and wait for the
    ...    new image block to render. The PNG is removed by `Remove Temp Files`,
    ...    so a test that uses this needs that teardown. Port of the
    ...    `setInputFiles` sequences in the e2e specs.
    [Arguments]    ${type}
    ${png}=    Write Tiny PNG
    ${before}=    Get Element Count    ${IMAGE_BLOCK}
    ${selector}=    Block Selector    ${type}
    Click Block    ${selector} >> nth=-1
    Click Toolbar Button    Image
    Upload File By Selector    ${FILE_INPUT}    ${png}
    Get Element Count    ${IMAGE_BLOCK}    >    ${before}
    Wait For Elements State    ${IMAGE_BLOCK} >> nth=-1    visible

# ---- Data tables ---------------------------------------------------------

Insert Table After Block
    [Documentation]    Put the cursor on the last block of ${type}, click the
    ...    toolbar Table button and wait for the table. Port of the
    ...    `Table` toolbar clicks in e2e/data-table.spec.ts.
    [Arguments]    ${type}
    ${selector}=    Block Selector    ${type}
    Click Block    ${selector} >> nth=-1
    Click Toolbar Button    Table
    Wait For Elements State    ${TABLE}    visible

Cell Selector
    [Documentation]    Return the selector of the cell in ${row}, ${column}
    ...    (1-based, as a reader counts) of the data table.
    [Arguments]    ${row}    ${column}
    RETURN    ${TABLE} [data-cell='${{int($row) - 1}}-${{int($column) - 1}}']

Click Table Toolbar Button
    [Documentation]    Click the cell in ${row}, ${column} (from 1), which shows
    ...    the table toolbar, then the toolbar button for ${action} (its
    ...    `data-action`, e.g. `insert-row-below`).
    [Arguments]    ${row}    ${column}    ${action}
    ${cell}=    Cell Selector    ${row}    ${column}
    Click    ${cell}
    ${button}=    Set Variable    ${TABLE_TOOLBAR} [data-action="${action}"]
    Wait For Elements State    ${button}    visible
    Click    ${button}

Fill Table After Block
    [Documentation]    Insert a data table after the last block of ${type},
    ...    grow it to the size of ${rows} (a list of rows, each a list of cell
    ...    texts) through the table toolbar, fill every cell, then click the
    ...    Feature block so the last cell commits on blur. Waits until the table
    ...    holds ${rows}. Port of the `fill` sequences in e2e/data-table.spec.ts.
    [Arguments]    ${type}    ${rows}
    Insert Table After Block    ${type}
    ${row_count}=    Get Element Count    ${TABLE} tr
    WHILE    ${row_count} < len($rows)
        Click Table Toolbar Button    ${row_count}    1    insert-row-below
        Get Element Count    ${TABLE} tr    ==    ${row_count + 1}
        ${row_count}=    Evaluate    ${row_count} + 1
    END
    ${column_count}=    Get Element Count    ${TABLE} tr >> nth=0 >> [data-cell]
    WHILE    ${column_count} < len($rows[0])
        Click Table Toolbar Button    1    ${column_count}    insert-col-after
        Get Element Count    ${TABLE} tr >> nth=0 >> [data-cell]    ==    ${column_count + 1}
        ${column_count}=    Evaluate    ${column_count} + 1
    END
    FOR    ${r}    ${row}    IN ENUMERATE    @{rows}    start=1
        FOR    ${c}    ${text}    IN ENUMERATE    @{row}    start=1
            ${cell}=    Cell Selector    ${r}    ${c}
            Click    ${cell}
            Fill Text    ${cell}    ${text}
        END
    END
    Click    ${BLOCKS} >> nth=0
    ${expected}=    Evaluate    json.dumps($rows)    modules=json
    ${js}=    Catenate
    ...    (el) => JSON.stringify([...el.querySelectorAll("tr")].map((tr) =>
    ...    [...tr.querySelectorAll("[data-cell]")].map((cell) => cell.textContent))) === JSON.stringify(${expected})
    Wait For Function    ${js}    selector=${TABLE}

