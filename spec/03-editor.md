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

---

## 3.3 Slash-command block picker

**Given** the cursor is inside a block  
**When** the user types `/`  
**Then** a block picker menu opens  
**And** the menu lists only the block types that are valid next blocks for the current block, according to `canFollow()`

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
**Then** the toolbar shows only the block types that are valid next blocks for the current block, according to `canFollow()`

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
**And** the file contains one line per block in the format `Keyword: text`  
**And** lines appear in document order

**Example export output:**
```
Feature: User login
Scenario: Successful login
Given the user is on the login page
When the user enters valid credentials
Then the user is redirected to the dashboard
```
