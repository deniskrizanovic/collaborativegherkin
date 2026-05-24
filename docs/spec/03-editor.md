# 3. The Editor

## 3.1 Loading

#### SC-3.1.1 Editor establishes WebSocket and becomes interactive
> **Tests:** none (WebSocket connection itself not directly asserted)

**Given** a user opens a session  
**When** the editor mounts  
**Then** a WebSocket connection is established to `ws://localhost:1234` in the room `session-{sessionId}`  
**And** the Y.js document state is synchronised with the server and any other connected peers  
**And** the editor becomes interactive once the connection is established

#### SC-3.1.2 New document seeded with 5 scaffold blocks once
> **Tests:** [`e2e/initial-content.spec.ts`](../../e2e/initial-content.spec.ts) — order · empty text · cursor on Feature  
> [`e2e/collaboration.spec.ts`](../../e2e/collaboration.spec.ts) — second joiner does not re-seed

**Given** the Y.js document is empty after synchronisation  
**When** the first user's editor finishes syncing  
**Then** the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then  
**And** each scaffold block contains no text — only the keyword label is displayed  
**And** the cursor is placed at the start of the Feature block  
**And** the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding

---

## 3.2 Enter-key auto-progression

Pressing Enter at the end of a block creates a new block of a predetermined type:

| Current block | New block created |
|---------------|-------------------|
| feature       | scenario          |
| rule          | scenario          |
| background    | given             |
| scenario      | given             |
| given         | when              |
| when          | then              |
| then          | scenario          |
| and           | and               |
| but           | but               |

#### SC-3.2.1 Enter at end of block inserts auto-progression type
> **Tests:** [`e2e/enter-progression.spec.ts`](../../e2e/enter-progression.spec.ts) — feature→scenario · scenario→given · given→when · when→then · then→and · and→and · but→and · background→given · rule→scenario

**Given** the cursor is at the end of a block  
**When** the user presses Enter  
**Then** a new block of the auto-progression type is inserted immediately after the current block  
**And** the cursor is placed at the start of the new block's text

#### SC-3.2.2 Enter on image block uses prevType context
> **Tests:** [`e2e/enter-progression.spec.ts`](../../e2e/enter-progression.spec.ts)

**Given** the cursor is on an image block  
**When** the user presses Enter  
**Then** a new block is inserted after the image using the auto-progression type of the most recent Gherkin block that precedes the image  
**And** the cursor is placed at the start of the new block's text

---

## 3.3 Slash-command block picker

#### SC-3.3.1 Typing / opens picker with valid next blocks and Image
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts) — opens picker · only valid types shown · Image always last

**Given** the cursor is inside a block  
**When** the user types `/`  
**Then** a block picker menu opens  
**And** the menu lists the block types that are valid next blocks for the current block, according to `canFollow()`  
**And** the menu always includes `Image` as the final option, regardless of the current block type

#### SC-3.3.2 Down arrow moves picker focus to next item
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts)

**Given** the block picker menu is open  
**When** the user presses the down arrow key  
**Then** focus moves to the next item in the list

#### SC-3.3.3 Up arrow moves picker focus to previous item
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts)

**Given** the block picker menu is open  
**When** the user presses the up arrow key  
**Then** focus moves to the previous item in the list

#### SC-3.3.4 Enter on focused picker item inserts type and closes
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts)

**Given** the block picker menu is open and an item is focused  
**When** the user presses Enter  
**Then** the focused block type is inserted and the menu closes

#### SC-3.3.5 Clicking picker item inserts type and closes
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts)

**Given** the block picker menu is open and an item is focused  
**When** the user clicks the item  
**Then** the clicked block type is inserted and the menu closes

#### SC-3.3.6 Escape closes picker without inserting
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts)

**Given** the block picker menu is open  
**When** the user presses Escape  
**Then** the menu closes without inserting a block

#### SC-3.3.7 Clicking outside picker closes without inserting
> **Tests:** [`e2e/block-picker.spec.ts`](../../e2e/block-picker.spec.ts)

**Given** the block picker menu is open  
**When** the user clicks outside the menu  
**Then** the menu closes without inserting a block

---

## 3.4 Toolbar block insertion

#### SC-3.4.1 Toolbar shows valid next blocks and Image
> **Tests:** [`e2e/toolbar.spec.ts`](../../e2e/toolbar.spec.ts) — no Feature shown on Feature block · Rule, Background, Scenario after Feature · Image present on non-Feature block

**Given** the cursor is inside a block  
**When** the editor toolbar renders  
**Then** the toolbar shows the block types that are valid next blocks for the current block, according to `canFollow()`  
**And** the toolbar always shows an Image button, regardless of the current block type

#### SC-3.4.2 Clicking toolbar button inserts block and moves cursor
> **Tests:** [`e2e/toolbar.spec.ts`](../../e2e/toolbar.spec.ts) — node inserted · Scenario after Feature

**Given** the toolbar is showing valid block types  
**When** the user clicks a toolbar button  
**Then** a new block of the chosen type is inserted after the current block  
**And** the cursor moves to the new block

---

## 3.5 Real-time collaboration

#### SC-3.5.1 Change by one user is visible to all in real time
> **Tests:** [`e2e/collaboration.spec.ts`](../../e2e/collaboration.spec.ts)

**Given** two or more users have the same session URL open  
**When** one user types or inserts a block  
**Then** all other connected users see the change reflected in their editors in real time

#### SC-3.5.2 Remote user cursors visible in distinct colour
> **Tests:** [`e2e/collaboration.spec.ts`](../../e2e/collaboration.spec.ts)

**Given** two or more users are in the same session  
**When** the editor renders  
**Then** each remote user's cursor position is visible, displayed in a distinct colour

---

## 3.6 Exporting

#### SC-3.6.1 Export downloads plain-text file in document order
> **Tests:** [`e2e/export.spec.ts`](../../e2e/export.spec.ts) — correct content · block order · image data-URI included

**Given** a user is in a session editor  
**When** the user clicks the Export button  
**Then** a plain-text file is downloaded  
**And** keyword blocks appear as one line each in the format `Keyword: text`  
**And** image blocks appear as one line each containing the full base64 data-URI  
**And** all lines appear in document order

---

## 3.7 Visual separation between step groups

#### SC-3.7.1 Given after then/and/but gets top border (visual only)
> **Tests:** [`e2e/visual-separation.spec.ts`](../../e2e/visual-separation.spec.ts) — after then · after and · after but · first given after scenario has no border · separator not in export

**Given** a `given` block immediately follows a `then`, `and`, or `but` block  
**Then** a horizontal rule and vertical space are rendered above the `given` block  
**And** this separation is purely visual and does not affect the document structure or export output

#### SC-3.7.2 Scenario after then/and/but gets top border (visual only)
> **Tests:** [`e2e/visual-separation.spec.ts`](../../e2e/visual-separation.spec.ts) — after then · after and · after but

**Given** a `scenario` block immediately follows a `then`, `and`, or `but` block  
**Then** a horizontal rule and vertical space are rendered above the `scenario` block  
**And** this separation is purely visual and does not affect the document structure or export output

---

---

## 3.8 Image insertion

#### SC-3.8.1 Image toolbar button opens file picker and embeds image
> **Tests:** [`e2e/image.spec.ts`](../../e2e/image.spec.ts)

**Given** a user is in a session editor  
**When** the user clicks the Image toolbar button  
**Then** a file picker opens  
**And** selecting an image file embeds it as an image block immediately after the current block

#### SC-3.8.2 Slash-command Image selection opens file picker and embeds image
> **Tests:** [`e2e/image.spec.ts`](../../e2e/image.spec.ts)

**Given** a user is in a session editor  
**When** the user types `/` and selects Image from the block picker  
**Then** a file picker opens  
**And** selecting an image file embeds it as an image block immediately after the current block

#### SC-3.8.3 Drag and drop image embeds at drop position
> **Tests:** [`e2e/image.spec.ts`](../../e2e/image.spec.ts)

**Given** a user is in a session editor  
**When** the user drags an image file onto the editor  
**Then** the image is embedded as an image block at the drop position

#### SC-3.8.4 Image block displayed inline at full width
> **Tests:** none

**Given** an image block is in the document  
**Then** the image is displayed inline at full available width  
**And** the image block may appear after any keyword block type

---

**Example export output:**
```
Feature: User login
Scenario: Successful login
Given the user is on the login page
When the user enters valid credentials
Then the user is redirected to the dashboard
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
```

---

## 3.9 Markdown exporting

#### SC-3.9.1 Export MD downloads markdown file in document order
> **Tests:** [`e2e/export.spec.ts`](../../e2e/export.spec.ts)

**Given** a user is in a session editor  
**When** the user clicks the Export MD button  
**Then** a markdown file `gherkin.md` is downloaded  
**And** `feature`, `rule`, `background`, and `scenario` blocks appear as markdown headers  
**And** `given`, `when`, `then`, `and`, and `but` blocks appear as markdown list items  
**And** image blocks appear as inline images using `![alt](src)` syntax  
**And** all blocks appear in document order

---

## 3.10 Block indentation

#### SC-3.10.1 Feature block flush with left margin
> **Tests:** none

**Given** the editor contains a `feature` block  
**Then** it is rendered flush with the editor left margin

#### SC-3.10.2 Rule, background, scenario indented one level
> **Tests:** none

**Given** the editor contains a `rule`, `background`, or `scenario` block  
**Then** it is visually indented one level from the `feature` block

#### SC-3.10.3 Step blocks indented two levels
> **Tests:** none

**Given** the editor contains a `given`, `when`, `then`, `and`, or `but` block  
**Then** it is visually indented two levels from the `feature` block

**And** this indentation is purely visual and does not affect the document
structure or export output

---

## 3.11 Data table insertion

#### SC-3.11.1 Table button shown when cursor is on step or data table
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts) — visible on Given · absent on Feature

**Given** the cursor is on a step block (`given`, `when`, `then`, `and`, or `but`) or on a data table block that follows a step  
**Then** the toolbar shows a "Table" button

#### SC-3.11.2 Clicking Table inserts 2×2 stub with cursor in first cell
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts) — node inserted · first cell interactive

**Given** the toolbar shows a "Table" button  
**When** the user clicks it  
**Then** a 2×2 data table stub with empty cells is inserted immediately after the current block  
**And** the cursor is placed inside the first cell

#### SC-3.11.3 Slash-command picker includes Table when on step block
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts)

**Given** the user types `/` and the current/previous block is a step type  
**Then** the block picker includes "Table" as an option

#### SC-3.11.4 Tab moves focus to next cell
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts)

**Given** a data table is in the document  
**When** the user presses Tab inside a cell  
**Then** focus moves to the next cell (left to right, top to bottom)

#### SC-3.11.5 Shift+Tab moves focus to previous cell
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts)

**Given** a data table is in the document  
**When** the user presses Shift+Tab inside a cell  
**Then** focus moves to the previous cell

#### SC-3.11.6 Add row and Add column controls available
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts)

**Given** a data table is in the document  
**Then** "Add row" and "Add column" controls are available within the table UI

#### SC-3.11.7 TXT export uses pipe-delimited rows padded to column width
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts)

**Given** a data table block is present  
**When** the user exports as TXT  
**Then** each row appears as one line in `| cell | cell |` format with cells padded to column width

#### SC-3.11.8 MD export uses header row with separator
> **Tests:** [`e2e/data-table.spec.ts`](../../e2e/data-table.spec.ts)

**Given** a data table block is present  
**When** the user exports as MD  
**Then** the first row is the header row  
**And** a `| --- | --- |` separator row follows the header  
**And** subsequent rows follow in order
