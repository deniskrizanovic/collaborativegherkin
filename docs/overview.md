# Collaborative Gherkin — Project Overview

A real-time collaborative editor for writing Gherkin acceptance criteria. Multiple people share a URL and edit the same document simultaneously. Sessions are ephemeral workspaces — the end product is exported Gherkin text or Markdown for tools like Jira, not a permanent record.

---

## Home page

The home page lists recent sessions and provides a form to create a new one.

![Home page](screenshots/home.png)

Enter a session title and click **New session** to create a workspace. Each session gets its own URL that can be shared immediately.

![Creating a new session](screenshots/create-session.png)

---

## The session editor

Opening a session lands you in the Gherkin editor. The toolbar across the top surfaces the block types that are valid to insert at the current cursor position. Export and Import buttons sit on the right side of the toolbar.

![Empty session editor](screenshots/session-empty.png)

The toolbar always constrains choices to what is structurally valid. In an empty document the only option is **Feature** — inserting anything else would produce invalid Gherkin.

![Toolbar on empty editor — only Feature is offered](screenshots/toolbar-empty.png)

---

## Writing Gherkin blocks

### Toolbar insertion

Click any toolbar button to insert a block at the cursor. The toolbar re-evaluates after each insertion and shows only the blocks that can legally follow the current one. After inserting a **Then** step, the toolbar offers Rule, Scenario, Given, When, Then, And, But, Table, and Image — every block type that can follow a Then.

![Full document with toolbar showing valid next blocks](screenshots/editor-full.png)

### Smart Enter progression

Pressing **Enter** at the end of a block auto-inserts the most natural next block type without touching the keyboard shortcut or toolbar:

| Current block | Enter produces |
|---|---|
| Feature | Scenario |
| Scenario | Given |
| Given | When |
| When | Then |
| Then | And |
| And | And |
| But | And |
| Background | Given |
| Rule | Scenario |

![Smart Enter — complete feature/scenario/step sequence](screenshots/smart-enter.png)

### Block picker (`/` key)

Typing `/` on any line opens a keyboard-navigable picker showing every block type valid at that position. Arrow keys move the selection; Enter or a click confirms; Escape dismisses without inserting. Typing `/` on an already-typed block switches to replace mode — the picker shows valid alternatives and selecting one swaps the block type in place without adding a new line.

![Block picker dropdown triggered by / key](screenshots/block-picker.png)

---

## Visual separation between scenarios

Scenario boundaries are rendered with a top border so the eye can scan a multi-scenario feature quickly. The separator is purely visual — it does not appear in exported output.

![Two scenarios with visual separation](screenshots/visual-separation.png)

---

## Data tables

A **Table** button appears in the toolbar whenever the cursor is on a step block (Given, When, Then, And, But). Clicking it inserts an editable inline table beneath the step. Clicking into a cell reveals a floating table management toolbar with buttons to add/delete rows and columns.

![Data table inserted beneath a Given step](screenshots/data-table.png)

---

## Import

The **Import** button opens a modal with a textarea. Paste raw Gherkin text or Markdown-prefixed Gherkin (headings for Feature/Scenario, list items for steps). Clicking **Insert** parses the text and populates the editor; **Cancel** closes the modal without changing anything. Pipe-delimited rows in the pasted text are recognised and inserted as data table blocks.

![Import modal with pasted Gherkin](screenshots/import-modal.png)

---

## Export

Two export buttons are always visible in the toolbar:

- **Export TXT** — downloads `gherkin.txt` in plain `Keyword: text` format, one block per line, with pipe-delimited rows for any data tables.
- **Export MD** — downloads `gherkin.md` using Markdown conventions: `#` headings for Feature, `##` for Scenario, `- list items` for steps, and a GFM pipe table with separator row for data tables.

![Export TXT and Export MD buttons](screenshots/export-buttons.png)

---

## Real-time collaboration

Share the session URL with teammates. Every editor connected to the same session sees changes live. Y.js CRDTs handle concurrent edits without conflicts. Collaborators' cursors appear with coloured labels so you can see where everyone is working.

To invite someone, click **Copy invite link** next to the session title — it copies the session URL to the clipboard.

![Copy invite link next to the session title](screenshots/invite-link.png)

---

## AI Coaching

The **Get AI Coaching** button sends the current document to an LLM (selectable from the dropdown) and opens a modal with structured feedback rendered as Markdown. Useful for catching vague steps, missing edge cases, or structural issues before exporting to Jira.

![AI Coaching result modal](screenshots/ai-coaching-modal.png)

While a review is in flight, the button is disabled and shows **Reviewing…** so it's clear a request is pending. After closing the modal, a **View last review** button appears to re-open the cached result without re-running the request.

### Editing the prompt

The **Edit prompt** button opens a modal where you can customise the system prompt sent to the LLM. Changes are saved per-session and persist across page refreshes. The Save button is disabled until the prompt is at least 10 characters.

![Edit prompt modal](screenshots/edit-prompt-modal.png)

---

## Architecture

### Two-server model

The Next.js app server handles HTTP (sessions API, page rendering) while a separate standalone Y.js WebSocket server (`y-websocket-server.mjs`) handles real-time sync. Both must run concurrently:

```bash
npm run dev      # Next.js on http://localhost:3000
npm run dev:ws   # Y.js WebSocket on ws://localhost:1234
```

### Editor (`src/components/GherkinEditor.tsx`)

A single client component built on:

- **Tiptap** — ProseMirror-based rich text editor
- **Y.js + y-websocket** — CRDTs powering real-time multi-user sync
- **CollaborationCursor** — shows other users' carets with coloured labels

Three custom ProseMirror node types:

| Node | Description |
|---|---|
| `GherkinParagraph` | Every text block; carries `data-gherkin-type` driving CSS keyword labels and indentation |
| `GherkinDataTable` | Inline editable table with a floating toolbar (add/delete rows and columns) |
| `GherkinImage` | Images embedded as base64 data URIs via drag-and-drop or file picker |

### Gherkin structure (`src/lib/gherkin.ts`)

All structural rules live here and nowhere else:

- `ALLOWED_AFTER` — adjacency grammar (e.g. `scenario` can only follow `feature`, `rule`, or `then`)
- `canFollow()` — enforced before inserting any block
- `NEXT_BLOCK_ON_ENTER` — what Enter produces after each block type
- `exportToText()` / `exportToMarkdown()` / `parseGherkin()` — import/export logic

### Database

SQLite in dev, PostgreSQL in production, via Prisma. Two models: `User` and `Session`. The session's `content` field stores `{}` by default — actual document state lives in Y.js (in-memory in the WebSocket server), not in the database.

### Auth

NextAuth.js v5 is wired into the schema but not yet hooked up to the UI. Session creation currently uses a hardcoded placeholder `userId`.

---

## Visual design

Gherkin keywords are colour-coded inline via CSS `::before` pseudo-elements:

| Keyword | Colour |
|---|---|
| Feature, Rule, Background | Blue |
| Scenario | Amber |
| Given | Green |
| When | Orange |
| Then | Violet |
| And, But | Muted grey |

Scenario boundaries are visually separated by a top border. Typography: Syne (display headings) + IBM Plex Sans (body) + IBM Plex Mono (editor and keyword labels).

---

## Test coverage

- **Vitest unit tests** — `src/lib/gherkin.test.ts` (structural rules, export/import logic) and `src/app/api/sessions/sessions-api.test.ts`
- **Playwright e2e tests** — 8 spec files covering: block picker, collaboration, data tables, Enter-key progression, export, import, toolbar, and visual separation

---

## Known gaps

- Auth is schema-only — all sessions are created under a single seed user
- Y.js document state is not persisted to the database; restarting the WebSocket server loses in-progress content
- No session deletion UI (the `DELETE /api/sessions/:id` route exists but is not exposed in the UI)
