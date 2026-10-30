*** Settings ***
Documentation       Port of e2e/data-table.spec.ts — spec §3.11 data tables:
...                 Table button visibility, the 2×2 stub, cell focus with
...                 Tab/Shift+Tab, the table toolbar, the slash-command option,
...                 and TXT/MD export of table content.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           chunk3    data-table


*** Test Cases ***
SC-3.11.1: Table button shown when cursor is on step or data table — visible on Given
    Open Session
    Click    ${BLOCK_TYPE}[given] >> nth=0
    ${table_button}=    Toolbar Button    Table
    Wait For Elements State    ${table_button}    visible

SC-3.11.1: Table button shown when cursor is on step or data table — absent on Feature
    Open Session
    Click    ${BLOCK_TYPE}[feature]
    ${table_button}=    Toolbar Button    Table
    Wait For Elements State    ${table_button}    hidden

SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell — node inserted
    Open Session
    Insert Table On First Given
    Wait For Elements State    ${TABLE}    visible

SC-3.11.6: Add row and Add column controls available
    Open Session
    Insert Table On First Given
    # Click into a cell to trigger focus-within, which shows the toolbar.
    Click    ${TABLE} td >> nth=0
    Wait For Elements State    ${TABLE_TOOLBAR}    visible
    Wait For Elements State    ${TABLE_TOOLBAR_BUTTON}\[data-action="insert-row-below"]    visible
    Wait For Elements State    ${TABLE_TOOLBAR_BUTTON}\[data-action="insert-col-after"]    visible

SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell — first cell interactive
    Open Session
    Insert Table On First Given
    Click    ${CELL_0_0}
    Wait For Elements State    ${CELL_0_0}    focused
    Fill Text    ${CELL_0_0}    header
    Get Text    ${CELL_0_0}    ==    header

SC-3.11.4: Tab moves focus to next cell
    Open Session
    Insert Table On First Given
    Click    ${CELL_0_0}
    Keyboard Key    press    Tab
    Wait For Elements State    ${CELL_0_1}    focused

SC-3.11.5: Shift+Tab moves focus to previous cell
    Open Session
    Insert Table On First Given
    Click    ${CELL_0_1}
    Keyboard Key    press    Shift+Tab
    Wait For Elements State    ${CELL_0_0}    focused

SC-3.11.3: Slash-command picker includes Table when on step block
    Open Session
    # After given, Enter creates a when block; on it prevType=given (a step
    # type), so getValidNextTypes("given") includes "data_table".
    Press Enter And Wait For Block    scenario
    Press Enter And Wait For Block    given
    Press Enter And Wait For Block    when
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Wait For Elements State    ${PICKER} >> button:has-text("Table")    visible
    Keyboard Key    press    Escape

SC-3.11.7: TXT export uses pipe-delimited rows padded to column width
    Open Session
    Type Into Block    feature    Login
    Type Into Block    scenario    Table test
    Type Into Block    given    a step with data
    Click Toolbar Button    Table
    # Row 0 renders as <th>.
    Click    ${CELL_0_0}
    Fill Text    ${CELL_0_0}    name
    Click    ${CELL_0_1}
    Fill Text    ${CELL_0_1}    age
    # Blur commits the cell content.
    Click Editor
    ${path}    ${filename}=    Download Via Button    ${EXPORT_BUTTON}
    ${content}=    Get File    ${path}    encoding=UTF-8
    Should Contain    ${content}    | name
    Should Contain    ${content}    | age

SC-3.11.8: MD export uses header row with separator
    Open Session
    Type Into Block    feature    MD Table
    Type Into Block    scenario    export scenario
    Type Into Block    given    a step
    Click Toolbar Button    Table
    Click    ${CELL_0_0}
    Fill Text    ${CELL_0_0}    col
    Click Editor
    ${path}    ${filename}=    Download Via Button    ${EXPORT_MD_BUTTON}    md
    ${content}=    Get File    ${path}    encoding=UTF-8
    Should Contain    ${content}    | col
    Should Match Regexp    ${content}    \\| -+


*** Keywords ***
Insert Table On First Given
    [Documentation]    Put the cursor on the first given and click Table.
    ${given}=    Block Selector    given
    Click    ${given} >> nth=0
    Click Toolbar Button    Table
