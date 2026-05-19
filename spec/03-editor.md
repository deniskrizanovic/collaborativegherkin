# 3. The Editor

## 3.1 Loading

**Given** a user opens a session  
**When** the editor mounts  
**Then** a WebSocket connection is established to `ws://localhost:1234` in the room `session-{sessionId}`  
**And** the Y.js document state is synchronised with the server and any other connected peers  
**And** the editor becomes interactive once the connection is established

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

**Given** the cursor is at the end of a block  
**When** the user presses Enter  
**Then** a new block of the auto-progression type is inserted immediately after the current block  
**And** the cursor is placed at the start of the new block's text

**Given** the cursor is on an image block  
**When** the user presses Enter  
**Then** a new block is inserted after the image using the auto-progression type of the most recent Gherkin block that precedes the image  
**And** the cursor is placed at the start of the new block's text

---

## 3.3 Slash-command block picker

**Given** the cursor is inside a block  
**When** the user types `/`  
**Then** a block picker menu opens  
**And** the menu lists the block types that are valid next blocks for the current block, according to `canFollow()`  
**And** the menu always includes `Image` as the final option, regardless of the current block type

**Given** the block picker menu is open  
**When** the user presses the down arrow key  
**Then** focus moves to the next item in the list

**Given** the block picker menu is open  
**When** the user presses the up arrow key  
**Then** focus moves to the previous item in the list

**Given** the block picker menu is open and an item is focused  
**When** the user presses Enter  
**Then** the focused block type is inserted and the menu closes

**Given** the block picker menu is open and an item is focused  
**When** the user clicks the item  
**Then** the clicked block type is inserted and the menu closes

**Given** the block picker menu is open  
**When** the user presses Escape  
**Then** the menu closes without inserting a block

**Given** the block picker menu is open  
**When** the user clicks outside the menu  
**Then** the menu closes without inserting a block

---

## 3.4 Toolbar block insertion

**Given** the cursor is inside a block  
**When** the editor toolbar renders  
**Then** the toolbar shows the block types that are valid next blocks for the current block, according to `canFollow()`  
**And** the toolbar always shows an Image button, regardless of the current block type

**Given** the toolbar is showing valid block types  
**When** the user clicks a toolbar button  
**Then** a new block of the chosen type is inserted after the current block  
**And** the cursor moves to the new block

---

## 3.5 Real-time collaboration

**Given** two or more users have the same session URL open  
**When** one user types or inserts a block  
**Then** all other connected users see the change reflected in their editors in real time

**Given** two or more users are in the same session  
**When** the editor renders  
**Then** each remote user's cursor position is visible, displayed in a distinct colour

---

## 3.6 Exporting

**Given** a user is in a session editor  
**When** the user clicks the Export button  
**Then** a plain-text file is downloaded  
**And** keyword blocks appear as one line each in the format `Keyword: text`  
**And** image blocks appear as one line each containing the full base64 data-URI  
**And** all lines appear in document order

---

## 3.7 Visual separation between step groups

**Given** a `given` block immediately follows a `then`, `and`, or `but` block  
**Then** a horizontal rule and vertical space are rendered above the `given` block  
**And** this separation is purely visual and does not affect the document structure or export output

**Given** a `scenario` block immediately follows a `then`, `and`, or `but` block  
**Then** a horizontal rule and vertical space are rendered above the `scenario` block  
**And** this separation is purely visual and does not affect the document structure or export output

---

---

## 3.8 Image insertion

**Given** a user is in a session editor  
**When** the user clicks the Image toolbar button  
**Then** a file picker opens  
**And** selecting an image file embeds it as an image block immediately after the current block

**Given** a user is in a session editor  
**When** the user types `/` and selects Image from the block picker  
**Then** a file picker opens  
**And** selecting an image file embeds it as an image block immediately after the current block

**Given** a user is in a session editor  
**When** the user drags an image file onto the editor  
**Then** the image is embedded as an image block at the drop position

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

**Given** a user is in a session editor  
**When** the user clicks the Export MD button  
**Then** a markdown file `gherkin.md` is downloaded  
**And** `feature`, `rule`, `background`, and `scenario` blocks appear as markdown headers  
**And** `given`, `when`, `then`, `and`, and `but` blocks appear as markdown list items  
**And** image blocks appear as inline images using `![alt](src)` syntax  
**And** all blocks appear in document order

---

## 3.10 Block indentation

**Given** the editor contains a `feature` block  
**Then** it is rendered flush with the editor left margin

**Given** the editor contains a `rule`, `background`, or `scenario` block  
**Then** it is visually indented one level from the `feature` block

**Given** the editor contains a `given`, `when`, `then`, `and`, or `but` block  
**Then** it is visually indented two levels from the `feature` block

**And** this indentation is purely visual and does not affect the document
structure or export output
