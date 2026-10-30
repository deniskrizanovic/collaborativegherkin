*** Comments ***
Step inventory (openspec/changes/add-bdd-robot-editor-suites, task 2.3).
Every spec line of every scenario in scope, with the steps/*.resource file
whose keyword implements it. A keyword is named after its spec line;
`the user presses ${key:Escape|Enter}` covers both keys. [shared] marks a
line that appears in scenarios of more than one capability (counted over
all of openspec/specs, so `the editor renders` counts SC-3.5.2, which is
excluded); its keyword lives in this file. Out of scope (design D9):
SC-3.5.2, SC-8.4.2, the app bugs SC-3.2.2 (#53), SC-3.8.3 (#54) and
SC-3.11.2 (#55), and every scenario not listed.

SC-3.1.2  New document seeded with 5 scaffold blocks once  (gherkin-editor)
    given  the Y.js document is empty after synchronisation  -> gherkin_editor
    when   the first user's editor finishes syncing  -> gherkin_editor
    then   the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then  -> gherkin_editor
    then   each scaffold block contains no text — only the keyword label is displayed  -> gherkin_editor
    then   the cursor is placed at the start of the Feature block  -> gherkin_editor
    then   the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding  -> gherkin_editor

SC-3.2.1  Enter at end of block inserts auto-progression type  (gherkin-editor)
    given  the cursor is at the end of a block  -> gherkin_editor
    when   the user presses Enter  -> shared (key keyword)
    then   a new block of the auto-progression type is inserted immediately after the current block  -> gherkin_editor
    then   the cursor is placed at the start of the new block's text  -> gherkin_editor

SC-3.3.1  Typing / opens picker with valid next blocks and Image  (gherkin-editor)
    given  the cursor is inside a block  -> gherkin_editor
    when   the user types `/`  -> gherkin_editor
    then   a block picker menu opens  -> gherkin_editor
    then   the menu lists the block types that are valid next blocks for the current block, according to `canFollow()`  -> gherkin_editor
    then   the menu always includes `Image` as the final option, regardless of the current block type  -> gherkin_editor

SC-3.3.2  Down arrow moves picker focus to next item  (gherkin-editor)
    given  the block picker menu is open  -> gherkin_editor
    when   the user presses the down arrow key  -> gherkin_editor
    then   focus moves to the next item in the list  -> gherkin_editor

SC-3.3.3  Up arrow moves picker focus to previous item  (gherkin-editor)
    given  the block picker menu is open  -> gherkin_editor
    when   the user presses the up arrow key  -> gherkin_editor
    then   focus moves to the previous item in the list  -> gherkin_editor

SC-3.3.4  Enter on focused picker item inserts type and closes  (gherkin-editor)
    given  the block picker menu is open and an item is focused  -> gherkin_editor
    when   the user presses Enter  -> shared (key keyword)
    then   the focused block type is inserted and the menu closes  -> gherkin_editor

SC-3.3.5  Clicking picker item inserts type and closes  (gherkin-editor)
    given  the block picker menu is open and an item is focused  -> gherkin_editor
    when   the user clicks the item  -> gherkin_editor
    then   the clicked block type is inserted and the menu closes  -> gherkin_editor

SC-3.3.6  Escape closes picker without inserting  (gherkin-editor)
    given  the block picker menu is open  -> gherkin_editor
    when   the user presses Escape  -> shared [shared]
    then   the menu closes without inserting a block  -> gherkin_editor

SC-3.3.7  Clicking outside picker closes without inserting  (gherkin-editor)
    given  the block picker menu is open  -> gherkin_editor
    when   the user clicks outside the menu  -> gherkin_editor
    then   the menu closes without inserting a block  -> gherkin_editor

SC-3.4.1  Toolbar shows valid next blocks and Image  (gherkin-editor)
    given  the cursor is inside a block  -> gherkin_editor
    when   the editor toolbar renders  -> gherkin_editor
    then   the toolbar shows the block types that are valid next blocks for the current block, according to `canFollow()`  -> gherkin_editor
    then   the toolbar always shows an Image button, regardless of the current block type  -> gherkin_editor

SC-3.4.2  Clicking toolbar button inserts block and moves cursor  (gherkin-editor)
    given  the toolbar is showing valid block types  -> gherkin_editor
    when   the user clicks a toolbar button  -> gherkin_editor
    then   a new block of the chosen type is inserted after the current block  -> gherkin_editor
    then   the cursor moves to the new block  -> gherkin_editor

SC-3.5.1  Change by one user is visible to all in real time  (realtime-collaboration)
    given  two or more users have the same session URL open  -> realtime_collaboration
    when   one user types or inserts a block  -> realtime_collaboration
    then   all other connected users see the change reflected in their editors in real time  -> realtime_collaboration

SC-3.6.1  Export downloads plain-text file in document order  (gherkin-export)
    given  a user is in a session editor  -> shared [shared]
    when   the user clicks the Export button  -> gherkin_export
    then   a plain-text file is downloaded  -> gherkin_export
    then   keyword blocks appear as one line each in the format `Keyword: text`  -> gherkin_export
    then   image blocks appear as one line each containing the full base64 data-URI  -> gherkin_export
    then   all lines appear in document order  -> gherkin_export

SC-3.7.1  Given after then/and/but gets top border (visual only)  (gherkin-editor)
    given  a `given` block immediately follows a `then`, `and`, or `but` block  -> gherkin_editor
    then   a horizontal rule and vertical space are rendered above the `given` block  -> gherkin_editor
    then   this separation is purely visual and does not affect the document structure or export output  -> gherkin_editor

SC-3.7.2  Scenario after then/and/but gets top border (visual only)  (gherkin-editor)
    given  a `scenario` block immediately follows a `then`, `and`, or `but` block  -> gherkin_editor
    then   a horizontal rule and vertical space are rendered above the `scenario` block  -> gherkin_editor
    then   this separation is purely visual and does not affect the document structure or export output  -> gherkin_editor

SC-3.8.1  Image toolbar button opens file picker and embeds image  (gherkin-editor)
    given  a user is in a session editor  -> shared [shared]
    when   the user clicks the Image toolbar button  -> gherkin_editor
    then   a file picker opens  -> gherkin_editor
    then   selecting an image file embeds it as an image block immediately after the current block  -> gherkin_editor

SC-3.8.2  Slash-command Image selection opens file picker and embeds image  (gherkin-editor)
    given  a user is in a session editor  -> shared [shared]
    when   the user types `/` and selects Image from the block picker  -> gherkin_editor
    then   a file picker opens  -> gherkin_editor
    then   selecting an image file embeds it as an image block immediately after the current block  -> gherkin_editor

SC-3.9.1  Export MD downloads markdown file in document order  (gherkin-export)
    given  a user is in a session editor  -> shared [shared]
    when   the user clicks the Export MD button  -> gherkin_export
    then   a markdown file `gherkin.md` is downloaded  -> gherkin_export
    then   `feature`, `rule`, `background`, and `scenario` blocks appear as markdown headers  -> gherkin_export
    then   `given`, `when`, `then`, `and`, and `but` blocks appear as markdown list items  -> gherkin_export
    then   image blocks appear as inline images using `![alt](src)` syntax  -> gherkin_export
    then   all blocks appear in document order  -> gherkin_export

SC-3.11.1  Table button shown when cursor is on step or data table  (gherkin-editor)
    given  the cursor is on a step block (`given`, `when`, `then`, `and`, or `but`) or on a data table block that follows a step  -> gherkin_editor
    then   the toolbar shows a "Table" button  -> gherkin_editor

SC-3.11.3  Slash-command picker includes Table when on step block  (gherkin-editor)
    given  the user types `/` and the current/previous block is a step type  -> gherkin_editor
    then   the block picker includes "Table" as an option  -> gherkin_editor

SC-3.11.4  Tab moves focus to next cell  (gherkin-editor)
    given  a data table is in the document  -> gherkin_editor
    when   the user presses Tab inside a cell  -> gherkin_editor
    then   focus moves to the next cell (left to right, top to bottom)  -> gherkin_editor

SC-3.11.5  Shift+Tab moves focus to previous cell  (gherkin-editor)
    given  a data table is in the document  -> gherkin_editor
    when   the user presses Shift+Tab inside a cell  -> gherkin_editor
    then   focus moves to the previous cell  -> gherkin_editor

SC-3.11.6  Add row and Add column controls available  (gherkin-editor)
    given  a data table is in the document  -> gherkin_editor
    then   "Add row" and "Add column" controls are available within the table UI  -> gherkin_editor

SC-3.11.7  TXT export uses pipe-delimited rows padded to column width  (gherkin-export)
    given  a data table block is present  -> gherkin_export
    when   the user exports as TXT  -> gherkin_export
    then   each row appears as one line in `| cell | cell |` format with cells padded to column width  -> gherkin_export

SC-3.11.8  MD export uses header row with separator  (gherkin-export)
    given  a data table block is present  -> gherkin_export
    when   the user exports as MD  -> gherkin_export
    then   the first row is the header row  -> gherkin_export
    then   a `| --- | --- |` separator row follows the header  -> gherkin_export
    then   subsequent rows follow in order  -> gherkin_export

SC-7.1.1  Import button always visible in toolbar  (gherkin-import)
    given  a user is in a session editor  -> shared [shared]
    when   the editor renders  -> shared [shared]
    then   an "Import" button with class `gherkin-import-btn` is always visible in the toolbar  -> gherkin_import

SC-7.1.2  Clicking Import opens modal with textarea and buttons  (gherkin-import)
    given  the user clicks the Import button  -> gherkin_import
    then   a modal overlay with class `gherkin-import-modal` opens  -> gherkin_import
    then   the modal contains a textarea with class `gherkin-import-textarea`  -> gherkin_import
    then   the modal contains a confirm button `.gherkin-import-confirm` ("Insert")  -> gherkin_import
    then   the modal contains a cancel button `.gherkin-import-cancel` ("Cancel")  -> gherkin_import

SC-7.1.3  Inserting Gherkin creates blocks, skips non-matching, clears modal  (gherkin-import)
    given  the user pastes or types Gherkin text into the textarea and clicks Insert  -> gherkin_import
    then   each recognisable keyword line is inserted as a Gherkin block at the current cursor position  -> gherkin_import
    then   pipe-delimited rows (`| cell | cell |`) are grouped into DataTable blocks  -> gherkin_import
    then   lines that do not match any keyword or table pattern are skipped  -> gherkin_import
    then   blocks are inserted in the order they appear in the text, regardless of `canFollow()` validity  -> gherkin_import
    then   the modal closes and the textarea is cleared  -> gherkin_import

SC-7.1.4  Cancel closes modal without inserting  (gherkin-import)
    given  the user clicks Cancel  -> gherkin_import
    then   the modal closes without inserting anything  -> gherkin_import

SC-8.1.1  Clicking Get AI Coaching sends content and disables controls  (llm-review)
    given  a user is on a session page  -> llm_review
    when   the user clicks "Get AI Coaching"  -> llm_review
    then   the current Gherkin content is sent to the resolved model via the OpenRouter gateway  -> llm_review
    then   the "Get AI Coaching" button is disabled and shows "Reviewing…" while the request is in flight  -> llm_review
    then   the model dropdown is disabled while the request is in flight  -> llm_review

SC-8.1.2  Successful LLM response displayed as Markdown in modal  (llm-review)
    given  the LLM returns a response  -> llm_review
    when   the review completes  -> llm_review
    then   the result is displayed in a modal  -> llm_review
    then   the result is rendered as Markdown  -> llm_review
    then   the modal header shows the name of the model that produced the result  -> llm_review

SC-8.1.3  LLM failure shows error in modal and resets button  (llm-review)
    given  the LLM request fails  -> llm_review
    when   the review completes with an error  -> llm_review
    then   an error message is displayed in the modal  -> llm_review
    then   the button returns to its normal state  -> llm_review

SC-8.2.1  Escape closes results modal  (llm-review)
    given  the results modal is open  -> llm_review
    when   the user presses Escape  -> shared [shared]
    then   the modal closes  -> llm_review

SC-8.2.2  Clicking outside panel closes results modal  (llm-review)
    given  the results modal is open  -> llm_review
    when   the user clicks outside the modal inner panel  -> llm_review
    then   the modal closes  -> llm_review

SC-8.2.3  X button closes results modal  (llm-review)
    given  the results modal is open  -> llm_review
    when   the user clicks the ✕ button  -> llm_review
    then   the modal closes  -> llm_review

SC-8.3.1  Model dropdown shown pre-selected to session model or default  (llm-review)
    given  a user is on a session page  -> llm_review
    when   the page loads  -> llm_review
    then   a model dropdown is shown alongside the "Get AI Coaching" button  -> llm_review
    then   the dropdown is pre-selected to the session's stored model, or the default model if none is set  -> llm_review

SC-8.3.4  Model dropdown is disabled until session settings have loaded  (llm-review)
    given  a user has opened a session page and its settings have not finished loading  -> llm_review
    when   the user looks at the model dropdown  -> llm_review
    then   the dropdown is disabled  -> llm_review
    then   it becomes enabled, showing the session's stored model, once the settings have loaded  -> llm_review

SC-8.4.1  Edit prompt button opens modal with pre-filled textarea  (llm-review)
    given  a user is on a session page  -> llm_review
    when   the user clicks "Edit prompt"  -> llm_review
    then   a modal opens containing a textarea pre-filled with the current prompt  -> llm_review

SC-8.4.3  Cancel, Escape, or outside click closes prompt modal without saving  (llm-review)
    given  the prompt edit modal is open  -> llm_review
    when   the user clicks "Cancel" or presses Escape or clicks outside the panel  -> llm_review
    then   the modal closes without saving  -> llm_review

SC-8.4.4  Save disabled when textarea has fewer than 10 chars  (llm-review)
    given  the user has cleared the textarea or entered fewer than 10 characters  -> llm_review
    when   the prompt edit modal is open  -> llm_review
    then   the "Save" button is disabled  -> llm_review

SC-8.4.6  A prompt edited after a slow settings load is the one saved  (llm-review)
    given  a user has opened a session page and its settings are slow to load  -> llm_review
    when   the settings finish loading and the user then edits the prompt and saves it  -> llm_review
    then   "Edit prompt" was disabled until the settings had loaded  -> llm_review
    then   reopening the prompt after a reload shows the user's edited prompt, not the default  -> llm_review

SC-8.4.7  Failed settings load leaves the default prompt editable  (llm-review)
    given  a user has opened a session page and its settings fail to load  -> llm_review
    when   the user clicks "Edit prompt"  -> llm_review
    then   the "Couldn't load this session's AI settings." banner is shown  -> llm_review
    then   the prompt modal opens with the default prompt pre-filled  -> llm_review

SC-8.8.1  View last review button visible after review is closed  (llm-review)
    given  a review has completed and the result modal has been closed  -> llm_review
    when   the user looks at the session header  -> llm_review
    then   a "View last review" button is visible  -> llm_review

SC-8.8.2  View last review reopens modal without new API call  (llm-review)
    given  the "View last review" button is visible  -> llm_review
    when   the user clicks it  -> shared [shared]
    then   the result modal reopens showing the same result without a new API call  -> llm_review

SC-8.8.3  View last review button absent before first review  (llm-review)
    given  no review has been run yet  -> llm_review
    when   the user looks at the session header  -> llm_review
    then   the "View last review" button is not visible  -> llm_review

SC-8.8.4  Cached result remains available while new review in flight  (llm-review)
    given  a review result is cached and a new review is triggered  -> llm_review
    when   the new review is in flight  -> llm_review
    then   the cached result remains available via "View last review"  -> llm_review

SC-8.8.5  New review result replaces cached result  (llm-review)
    given  a new review completes  -> llm_review
    when   the result arrives  -> llm_review
    then   the cached result is replaced with the new result  -> llm_review


*** Settings ***
Documentation       Business-language steps whose text appears in scenarios of
...                 more than one spec capability, plus the step-state helper
...                 every steps/*.resource uses.
...
...                 Robot drops a leading Given/When/Then/And/But when it looks
...                 a keyword up, so `When the user presses Escape` calls
...                 `the user presses ${key}`. Steps are lower-case sentences
...                 copied from the spec line; Title Case keywords are technical
...                 helpers that a `bdd` test never calls.
...
...                 Shared variables set by the keywords of this file:
...                 ${IT_SELECTOR}: the control the word "it" refers to in the
...                 next step (set by the step that names the control).
...                 ${SESSION_ID}: id of the session the test opened.

Resource            ../session.resource
Resource            ../editor.resource


*** Keywords ***
# ---- Given ---------------------------------------------------------------

a user is in a session editor
    [Documentation]    Open a fresh session. `Open Session` ends with a click
    ...    on the Feature block, so the cursor is inside it.
    ...    Sets: ${SESSION_ID}.
    ${id}=    Open Session
    Set Test Variable    ${SESSION_ID}    ${id}

# ---- When ----------------------------------------------------------------

the user presses ${key:Escape|Enter}
    Keyboard Key    press    ${key}

the user clicks it
    [Documentation]    Click the control that the previous step named.
    ...    Reads: ${IT_SELECTOR}.
    Require Step State    IT_SELECTOR
    ...    the "View last review" button is visible
    Click    ${IT_SELECTOR}

the editor renders
    [Documentation]    The editor surface is rendered and visible.
    Wait For Elements State    ${EDITOR}    visible

# ---- Technical helpers ---------------------------------------------------

Require Step State
    [Documentation]    Fail unless the test variable named ${name} (without
    ...    `${}`) is set, with a message naming ${setter}, the step that sets
    ...    it. Call it first in every step that reads shared state, so a
    ...    missing Given step is reported by name instead of with Robot's
    ...    generic "variable not found".
    [Arguments]    ${name}    ${setter}
    ${value}=    Get Variable Value    $${name}    ${None}
    IF    $value is None
        Fail    "${setter}" must run before this step (\${${name}} is not set)
    END
