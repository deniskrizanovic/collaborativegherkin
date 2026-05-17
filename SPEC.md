# Collaborative Gherkin — Behaviour-Driven Specification

## Overview

Collaborative Gherkin is a real-time multi-user editor for writing Gherkin acceptance criteria. Multiple people share a single session URL and edit the same document simultaneously, seeing each other's changes live. Sessions are ephemeral workspaces; users export the finished Gherkin to external tools such as Jira.

---

## 1. Session Management

### 1.1 Listing sessions

**Given** a user visits the home page  
**When** sessions exist in the database  
**Then** the user sees a list of sessions ordered by creation date, newest first  
**And** each entry shows the session title and a human-readable creation timestamp  
**And** each entry is a link that navigates to that session's editor

**Given** a user visits the home page  
**When** no sessions exist in the database  
**Then** the session list is empty and only the creation form is shown

---

### 1.2 Creating a session

**Given** the user is on the home page  
**When** the user enters a title of between 1 and 200 characters and submits the form  
**Then** a new session is created in the database  
**And** the user is redirected to the new session's editor page

**Given** the user is on the home page  
**When** the user submits the form with an empty title  
**Then** a validation error is displayed and no session is created  
**And** the Create button remains disabled while the title field is empty

**Given** the user is on the home page  
**When** the user submits the form with a title exceeding 200 characters  
**Then** a validation error is displayed and no session is created

**Given** the user is on the home page  
**When** the server returns an error during session creation  
**Then** a "Network error" or server error message is shown  
**And** the user remains on the home page

---

### 1.3 Joining a session

**Given** a session exists  
**When** a user navigates directly to `/sessions/{id}`  
**Then** the editor loads for that session  
**And** the session title is displayed in the header

**Given** a session ID does not exist in the database  
**When** a user navigates to `/sessions/{id}`  
**Then** a 404 response is returned and the session page is not rendered

---

### 1.4 Sharing a session

**Given** a user is on a session page  
**When** the user clicks "Copy invite link"  
**Then** the full URL of the current page is copied to the clipboard  
**And** the button label changes to "Copied!" for 2 seconds  
**And** then reverts to "Copy invite link"

---

### 1.5 Deleting a session

**Given** a session exists  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** the session is removed from the database  
**And** a 204 No Content response is returned

---

## 2. The Gherkin Document Model

### 2.1 Block types

A Gherkin document is composed of typed blocks. Each block has a keyword type and free-form text. The valid types are:

| Type       | Keyword prefix |
|------------|----------------|
| feature    | Feature        |
| rule       | Rule           |
| background | Background     |
| scenario   | Scenario       |
| given      | Given          |
| when       | When           |
| then       | Then           |
| and        | And            |
| but        | But            |

---

### 2.2 Document structure rules

These rules govern which block type may follow another. They are enforced by `canFollow()` in `src/lib/gherkin.ts` and apply everywhere in the application — editor toolbar, slash-command menu, and Enter-key auto-progression.

**Given** the document is empty  
**Then** the only valid first block type is `feature`

**Given** the current block is `feature`  
**Then** the valid next block types are: `rule`, `background`, `scenario`

**Given** the current block is `rule`  
**Then** the valid next block types are: `background`, `scenario`

**Given** the current block is `background`  
**Then** the only valid next block type is `given`

**Given** the current block is `scenario`  
**Then** the only valid next block type is `given`

**Given** the current block is `given`  
**Then** the valid next block types are: `given`, `when`, `and`, `but`

**Given** the current block is `when`  
**Then** the valid next block types are: `when`, `then`, `and`, `but`

**Given** the current block is `then`  
**Then** the valid next block types are: `then`, `and`, `but`, `scenario`, `rule`

**Given** the current block is `and`  
**Then** the valid next block types are: `given`, `when`, `then`, `and`, `but`, `scenario`, `rule`

**Given** the current block is `but`  
**Then** the valid next block types are: `given`, `when`, `then`, `and`, `but`, `scenario`, `rule`

---

## 3. The Editor

### 3.1 Loading

**Given** a user opens a session  
**When** the editor mounts  
**Then** a WebSocket connection is established to `ws://localhost:1234` in the room `session-{sessionId}`  
**And** the Y.js document state is synchronised with the server and any other connected peers  
**And** the editor becomes interactive once the connection is established

---

### 3.2 Enter-key auto-progression

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

### 3.3 Slash-command block picker

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

### 3.4 Toolbar block insertion

**Given** the cursor is inside a block  
**When** the editor toolbar renders  
**Then** the toolbar shows only the block types that are valid next blocks for the current block, according to `canFollow()`

**Given** the toolbar is showing valid block types  
**When** the user clicks a toolbar button  
**Then** a new block of the chosen type is inserted after the current block  
**And** the cursor moves to the new block

---

### 3.5 Real-time collaboration

**Given** two or more users have the same session URL open  
**When** one user types or inserts a block  
**Then** all other connected users see the change reflected in their editors in real time

**Given** two or more users are in the same session  
**When** the editor renders  
**Then** each remote user's cursor position is visible, displayed in a distinct colour

---

### 3.6 Exporting

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

---

## 4. API Behaviour

### 4.1 GET /api/sessions

**Given** sessions exist  
**When** a GET request is made to `/api/sessions`  
**Then** a 200 response is returned containing an array of all sessions  
**And** each session includes: `id`, `title`, `createdAt`, `userId`

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to list sessions"`

---

### 4.2 POST /api/sessions

**Given** a valid request body `{ title, userId }`  
**When** a POST request is made to `/api/sessions`  
**Then** a 201 response is returned containing the full created session object

**Given** the request body has a missing or empty title  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** the request body has a title longer than 200 characters  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** the request body has a `userId` that is not a valid CUID  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** a server error occurs during creation  
**When** a POST request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to create session"`

---

### 4.3 GET /api/sessions/[id]

**Given** the session exists  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 200 response is returned containing the full session object

**Given** the session does not exist  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 404 response is returned

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned

---

### 4.4 DELETE /api/sessions/[id]

**Given** the session exists  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** the session is deleted from the database  
**And** a 204 No Content response is returned

**Given** a server error occurs  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned

---

## 5. Data Model Constraints

**Given** a session is created  
**Then** its `id` is a CUID  
**And** its `title` is a non-empty string of at most 200 characters  
**And** its `createdAt` is set automatically at creation time  
**And** its `updatedAt` is updated automatically on every save  
**And** it is associated with exactly one `User` record via `userId`

**Given** a user record exists  
**Then** its `email` is unique across all users  
**And** a user may own zero or more sessions

---

## 6. Out of Scope (Current Version)

The following behaviours are intentionally not implemented and should not be assumed:

- **Authentication** — all requests use a hardcoded placeholder `userId`; no real login flow exists yet
- **Persistent document content** — Y.js document state is held in memory only; restarting the WebSocket server loses all editor content
- **Session deletion from the UI** — the DELETE API exists but there is no delete button in the front end
- **Per-session access control** — anyone with the URL can read and edit any session
