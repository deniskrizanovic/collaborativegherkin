*** Settings ***
Documentation       Business-language steps for openspec/specs/gherkin-export/spec.md.
...
...                 Each keyword is named after a GIVEN/WHEN/THEN line of that
...                 spec, so a `bdd` test repeats its scenario word for word.
...                 Steps whose text also appears in another capability are in
...                 shared.resource. Title Case keywords at the bottom are
...                 technical helpers that tests never call.
...
...                 The Then steps compare the downloaded file with the editor's
...                 content at the moment of the export, in the format the spec
...                 line states (`Keyword: text`, markdown headers and list
...                 items, `![alt](src)`, padded `| cell |` rows). They never
...                 re-derive which blocks may follow which.
...
...                 Shared variables set by the keywords of this file:
...                 ${EXPORTED_CONTENT}: the editor's top-level nodes when the
...                 export was clicked (`Document Content In Editor`).
...                 ${EXPORT_LINES}: the downloaded file split into lines.
...                 ${EXPORT_FILENAME}: the browser's suggested file name.
...                 ${TABLE_ROWS}: cell texts of the data table a Given step
...                 filled, row by row; the first row is the header.

Library             Collections
Resource            ../session.resource
Resource            ../editor.resource
Resource            ../files.resource
Resource            shared.resource


*** Variables ***
# Block types the markdown export renders as headers and as list items, as
# the two SC-3.9.1 lines name them.
@{HEADER_TYPES}         feature    rule    background    scenario
@{LIST_ITEM_TYPES}      given    when    then    and    but
# Markdown heading marker of each header type, as the technical test
# (export.robot) and exportToMarkdown write it: Feature is the document title,
# the others are sections under it. Test data, so a regression to another
# level or to a flat outline fails here.
&{HEADER_MARKERS}       feature=#    rule=##    background=##    scenario=##
# A data-URI whose payload is complete base64.
${DATA_URI_PATTERN}     ^data:image/[\\w.+-]+;base64,[A-Za-z0-9+/]+=*$


*** Keywords ***
# ---- Given ---------------------------------------------------------------

a user is in a session editor with ${document}
    [Documentation]    Open a fresh session and type ${document}, a dictionary
    ...    of block type to text, into the editor (`Type Document`).
    a user is in a session editor
    Type Document    ${document}

a user is in a session editor with ${document} and an image after the ${type} block
    [Documentation]    As `a user is in a session editor with <document>`, then
    ...    insert a 1×1 PNG image after the last ${type} block. The PNG is
    ...    removed by `Remove Temp Files`.
    a user is in a session editor
    Type Document    ${document}
    Insert Image After Block    ${type.lower()}

a data table block is present with ${rows}
    [Documentation]    Open a fresh session and fill a data table after the
    ...    seeded Given block with ${rows}, a list of rows, each a list of cell
    ...    texts (`Fill Table After Block`).
    ...    Sets: ${TABLE_ROWS}.
    a user is in a session editor
    Fill Table After Block    given    ${rows}
    Set Test Variable    ${TABLE_ROWS}    ${rows}

# ---- When ----------------------------------------------------------------

the user clicks the Export button
    [Documentation]    Sets: ${EXPORTED_CONTENT}, ${EXPORT_LINES}, ${EXPORT_FILENAME}.
    Export Document    ${EXPORT_BUTTON}    txt

the user clicks the Export MD button
    [Documentation]    Sets: ${EXPORTED_CONTENT}, ${EXPORT_LINES}, ${EXPORT_FILENAME}.
    Export Document    ${EXPORT_MD_BUTTON}    md

the user exports as TXT
    [Documentation]    Click the Export button.
    ...    Sets: ${EXPORTED_CONTENT}, ${EXPORT_LINES}, ${EXPORT_FILENAME}.
    the user clicks the Export button

the user exports as MD
    [Documentation]    Click the Export MD button.
    ...    Sets: ${EXPORTED_CONTENT}, ${EXPORT_LINES}, ${EXPORT_FILENAME}.
    the user clicks the Export MD button

# ---- Then ----------------------------------------------------------------

a plain-text file is downloaded
    [Documentation]    The download is named `gherkin.txt` (as the technical
    ...    test asserts) and reads as UTF-8 text.
    ...    Reads: ${EXPORT_FILENAME}.
    Require Step State    EXPORT_FILENAME    the user clicks the Export button
    Should Be Equal    ${EXPORT_FILENAME}    gherkin.txt

keyword blocks appear as one line each in the format Keyword: text
    [Documentation]    For every keyword block exported, the file holds the
    ...    line `<Keyword>: <text>` exactly as often as such blocks exist.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export button
    ${blocks}=    Exported Nodes Of    @{HEADER_TYPES}    @{LIST_ITEM_TYPES}
    ${expected}=    Evaluate    [n["node"].title() + ": " + n["text"] for n in $blocks]
    FOR    ${line}    IN    @{expected}
        ${times}=    Evaluate    $expected.count($line)
        ${found}=    Evaluate    $EXPORT_LINES.count($line)
        Should Be Equal As Integers    ${found}    ${times}
        ...    Expected the line "${line}" ${times} time(s), found ${found}: ${EXPORT_LINES}
    END

image blocks appear as one line each containing the full base64 data-URI
    [Documentation]    Every exported image's src is a complete base64
    ...    data-URI, and it is one whole line of the file.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export button
    ${images}=    Exported Nodes Of    image
    FOR    ${image}    IN    @{images}
        Should Match Regexp    ${image}[src]    ${DATA_URI_PATTERN}
        List Should Contain Value    ${EXPORT_LINES}    ${image}[src]
    END

all lines appear in document order
    [Documentation]    The file has exactly one line per exported node, in the
    ...    editor's order: `<Keyword>: <text>` for a block, the src for an image.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export button
    ${expected}=    Create List
    FOR    ${node}    IN    @{EXPORTED_CONTENT}
        IF    $node["node"] == "image"
            Append To List    ${expected}    ${node}[src]
        ELSE IF    $node["node"] in $HEADER_TYPES + $LIST_ITEM_TYPES
            ${line}=    Evaluate    $node["node"].title() + ": " + $node["text"]
            Append To List    ${expected}    ${line}
        ELSE
            Fail    No plain-text line format written down for a ${node}[node] node
        END
    END
    Lists Should Be Equal    ${EXPORT_LINES}    ${expected}

a markdown file gherkin.md is downloaded
    [Documentation]    Reads: ${EXPORT_FILENAME}.
    Require Step State    EXPORT_FILENAME    the user clicks the Export MD button
    Should Be Equal    ${EXPORT_FILENAME}    gherkin.md

feature, rule, background, and scenario blocks appear as markdown headers
    [Documentation]    Every exported block of these types has a line
    ...    `<marker> <Keyword>: <text>`, the marker its type's heading level
    ...    in &{HEADER_MARKERS}.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export MD button
    ${blocks}=    Exported Nodes Of    @{HEADER_TYPES}
    FOR    ${block}    IN    @{blocks}
        ${pattern}=    Markdown Line Pattern    ${block}
        Should Contain Match    ${EXPORT_LINES}    regexp=${pattern}
    END

given, when, then, and, and but blocks appear as markdown list items
    [Documentation]    Every exported block of these types has a line
    ...    `- <Keyword>: <text>`.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export MD button
    ${blocks}=    Exported Nodes Of    @{LIST_ITEM_TYPES}
    FOR    ${block}    IN    @{blocks}
        ${pattern}=    Markdown Line Pattern    ${block}
        Should Contain Match    ${EXPORT_LINES}    regexp=${pattern}
    END

image blocks appear as inline images using ![alt](src) syntax
    [Documentation]    Every exported image has the line `![<alt>](<src>)`,
    ...    with the image's own alt text and full data-URI.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export MD button
    ${images}=    Exported Nodes Of    image
    FOR    ${image}    IN    @{images}
        Should Match Regexp    ${image}[src]    ${DATA_URI_PATTERN}
        List Should Contain Value    ${EXPORT_LINES}    ![${image}[alt]](${image}[src])
    END

all blocks appear in document order
    [Documentation]    The file's non-empty lines map one to one, in order, to
    ...    the exported nodes: a header or list item for a block, the inline
    ...    image for an image.
    ...    Reads: ${EXPORTED_CONTENT}, ${EXPORT_LINES}.
    Require Step State    EXPORT_LINES    the user clicks the Export MD button
    ${lines}=    Evaluate    [line for line in $EXPORT_LINES if line]
    ${count}=    Get Length    ${EXPORTED_CONTENT}
    Length Should Be    ${lines}    ${count}    One non-empty line per node expected: ${lines}
    FOR    ${line}    ${node}    IN ZIP    ${lines}    ${EXPORTED_CONTENT}
        ${pattern}=    Markdown Line Pattern    ${node}
        Should Match Regexp    ${line}    ${pattern}
    END

each row appears as one line in | cell | cell | format with cells padded to column width
    [Documentation]    The file's `|` lines are the table's rows in order, each
    ...    cell padded with spaces to the width of the widest cell of its column.
    ...    Reads: ${TABLE_ROWS}, ${EXPORT_LINES}.
    Require Step State    TABLE_ROWS    a data table block is present with <rows>
    Require Step State    EXPORT_LINES    the user exports as TXT
    ${widths}=    Evaluate    [max(len(row[c]) for row in $TABLE_ROWS) for c in range(len($TABLE_ROWS[0]))]
    ${expected}=    Evaluate
    ...    ["| " + " | ".join(cell.ljust(w) for cell, w in zip(row, $widths)) + " |" for row in $TABLE_ROWS]
    ${table_lines}=    Exported Table Lines
    Lists Should Be Equal    ${table_lines}    ${expected}

the first row is the header row
    [Documentation]    The table's first `|` line holds the header cells.
    ...    Reads: ${TABLE_ROWS}, ${EXPORT_LINES}.
    Require Step State    TABLE_ROWS    a data table block is present with <rows>
    Require Step State    EXPORT_LINES    the user exports as MD
    ${table_lines}=    Exported Table Lines
    ${cells}=    Cells Of Line    ${table_lines}[0]
    Lists Should Be Equal    ${cells}    ${TABLE_ROWS}[0]

a | --- | --- | separator row follows the header
    [Documentation]    The line right after the header is a separator with one
    ...    `---` (three or more dashes) cell per column.
    ...    Reads: ${TABLE_ROWS}, ${EXPORT_LINES}.
    Require Step State    TABLE_ROWS    a data table block is present with <rows>
    Require Step State    EXPORT_LINES    the user exports as MD
    ${table_lines}=    Exported Table Lines
    ${columns}=    Get Length    ${TABLE_ROWS}[0]
    Should Match Regexp    ${table_lines}[1]    ^\\|( -{3,} \\|){${columns}}$

subsequent rows follow in order
    [Documentation]    After the separator come the remaining rows, in order,
    ...    and nothing else.
    ...    Reads: ${TABLE_ROWS}, ${EXPORT_LINES}.
    Require Step State    TABLE_ROWS    a data table block is present with <rows>
    Require Step State    EXPORT_LINES    the user exports as MD
    ${table_lines}=    Exported Table Lines
    ${rows}=    Create List
    FOR    ${line}    IN    @{table_lines}[2:]
        ${cells}=    Cells Of Line    ${line}
        Append To List    ${rows}    ${cells}
    END
    ${expected}=    Evaluate    $TABLE_ROWS[1:]
    Lists Should Be Equal    ${rows}    ${expected}

# ---- Technical helpers ---------------------------------------------------

Export Document
    [Documentation]    Record the editor's content, click ${button} and save the
    ...    download (`Download Via Button`). The saved file is removed by
    ...    `Remove Temp Files`.
    ...    Sets: ${EXPORTED_CONTENT}, ${EXPORT_LINES}, ${EXPORT_FILENAME}.
    [Arguments]    ${button}    ${extension}
    ${content}=    Document Content In Editor
    Set Test Variable    ${EXPORTED_CONTENT}    ${content}
    ${path}    ${filename}=    Download Via Button    ${button}    ${extension}
    ${lines}=    Read Lines    ${path}
    Set Test Variable    ${EXPORT_LINES}    ${lines}
    Set Test Variable    ${EXPORT_FILENAME}    ${filename}

Exported Nodes Of
    [Documentation]    Return the nodes of ${EXPORTED_CONTENT} whose `node` is
    ...    one of @{kinds}. Fails if there is none, so a Then step never passes
    ...    on a document that holds nothing for it to check.
    [Arguments]    @{kinds}
    ${nodes}=    Evaluate    [n for n in $EXPORTED_CONTENT if n["node"] in $kinds]
    Should Not Be Empty    ${nodes}    The exported document holds no ${kinds} node
    RETURN    ${nodes}

Markdown Line Pattern
    [Documentation]    Return the regular expression the markdown line of
    ...    ${node} must match: `<marker> Keyword: text` for @{HEADER_TYPES}
    ...    (marker from &{HEADER_MARKERS}),
    ...    `- Keyword: text` for @{LIST_ITEM_TYPES}, `![alt](src)` for an image.
    [Arguments]    ${node}
    IF    $node["node"] == "image"
        ${pattern}=    Evaluate    "^" + re.escape("![" + $node["alt"] + "](" + $node["src"] + ")") + "$"    modules=re
        RETURN    ${pattern}
    END
    ${text}=    Evaluate    re.escape($node["node"].title() + ": " + $node["text"])    modules=re
    IF    $node["node"] in $HEADER_TYPES
        ${marker}=    Evaluate    $HEADER_MARKERS[$node["node"]]
        RETURN    ^${marker} ${text}$
    END
    IF    $node["node"] in $LIST_ITEM_TYPES    RETURN    ^- ${text}$
    Fail    No markdown line format written down for a ${node}[node] node

Exported Table Lines
    [Documentation]    Return the lines of ${EXPORT_LINES} that start with `|`.
    ${lines}=    Evaluate    [line for line in $EXPORT_LINES if line.startswith("|")]
    Should Not Be Empty    ${lines}    The export holds no table row: ${EXPORT_LINES}
    RETURN    ${lines}

Cells Of Line
    [Documentation]    Return the trimmed cell texts of a `| cell | cell |` line.
    [Arguments]    ${line}
    ${cells}=    Evaluate    [cell.strip() for cell in $line.strip()[1:-1].split("|")]
    RETURN    ${cells}
