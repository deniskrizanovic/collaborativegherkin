# Collaborative Gherkin

A real-time collaborative editor for writing Gherkin acceptance criteria.
Multiple people share a URL and edit the same document simultaneously.
Sessions are ephemeral workspaces — the end product is exported Gherkin text or Markdown for tools like Jira, not a permanent record.
An AI Coach performs the hard work of checking things, and improving the quality of the Acceptance Criteria.

Acceptance Criteria are a critical mechanism to transfer the context of a business domain to the minds of the builders.
Acceptance Criteria allow the system users to deepen their own understanding of the information system they are building.
The collaborative wrestling with the acceptance criteria by the users, the builders and the testers helps ensure the system is built correctly.

![Collaborative Gherkin whiteboard](docs/collaborative-gherkin-white-board.png)

---

# What problem does this solve?

Most teams write Acceptance Criteria in Jira or Confluence — plain text editors with no understanding of Gherkin. The result is structurally broken, inconsistently formatted, and painful to review.

Remote sessions make it worse. One person types while everyone else watches. By the time it's done, the Gherkin reflects whoever was at the keyboard, not the room's collective intent.

Quality stays mediocre because there's no guardrail. Good Gherkin takes practice, feedback is rare, and the skill is unevenly spread across the team.

This tool fixes all three: a structured editor that enforces valid Gherkin, real-time multiplayer so the whole team edits simultaneously, and an AI coach that catches weak criteria before they reach Jira.

On top of that, actually getting to gherkin is really hard. But is necessary for AI driven software builds.

![Extracting Gherkin](docs/screenshots/extracting-requirements-into-gherkin.png)

---
# Implementation Notes
This system is about 99.99% written by AI. Including this document, and the video below.
There is a notebookllm podcast of the story of how the AI built this whole thing here ->


[![AI Generated Podcast of Implementation Overview](docs/architecture-review/podcast-frontcover.png)](https://youtu.be/jkzGXqDRDV4)


# Screenshot Overview

The following youtube video is a google notebooklm video summary of the following content. Just click the image to watch it. 
[![AI Generated Overview](docs/screenshots/ai-video-overview-thumbnails.png)](https://youtu.be/wZZKcGN3uAA)

## Home page

The home page lists recent sessions and provides a form to create a new one.

![Home page](docs/screenshots/home.png)

Enter a session title and click **New session** to create a workspace. Each session gets its own URL that can be shared immediately.

![Creating a new session](docs/screenshots/create-session.png)

---

## The session editor

Opening a session lands you in the Gherkin editor. The toolbar across the top surfaces the block types that are valid to insert at the current cursor position. Export and Import buttons sit on the right side of the toolbar.

![Session editor with initial scaffold](docs/screenshots/session-populated.png)

The toolbar always constrains choices to what is structurally valid. The cursor starts on the **Feature** block, so the toolbar offers the next valid options — Rule, Background, and Scenario.

![Toolbar after opening a session — cursor on Feature block](docs/screenshots/toolbar-populated.png)

---

## Writing Gherkin blocks

### Toolbar insertion

Click any toolbar button to insert a block at the cursor. The toolbar re-evaluates after each insertion and shows only the blocks that can legally follow the current one. After inserting a **Then** step, the toolbar offers Rule, Scenario, Given, And, But, Table, and Image — every block type that can follow a Then.

![Full document with toolbar showing valid next blocks](docs/screenshots/editor-full.png)

### Smart Enter progression

Pressing **Enter** at the end of a block auto-inserts the most natural next block type without touching the keyboard shortcut or toolbar:


| Current block | Enter produces |
| ------------- | -------------- |
| Feature       | Scenario       |
| Scenario      | Given          |
| Given         | When           |
| When          | Then           |
| Then          | And            |
| And           | And            |
| But           | And            |
| Background    | Given          |
| Rule          | Scenario       |

![Smart Enter — complete feature/scenario/step sequence](docs/screenshots/smart-enter.png)

### Block picker (`/` key)

Typing `/` on any line opens a keyboard-navigable picker showing every block type valid at that position. Arrow keys move the selection; Enter or a click confirms; Escape dismisses without inserting. Typing `/` on an already-typed block switches to replace mode — the picker shows valid alternatives and selecting one swaps the block type in place without adding a new line.

![Block picker dropdown triggered by / key](docs/screenshots/block-picker.png)

---

## Visual separation between scenarios

Scenario boundaries are rendered with a top border so the eye can scan a multi-scenario feature quickly. The separator is purely visual — it does not appear in exported output.

![Two scenarios with visual separation](docs/screenshots/visual-separation.png)

---

## Data tables

A **Table** button appears in the toolbar whenever the cursor is on a step block (Given, When, Then, And, But). Clicking it inserts an editable inline table beneath the step. Clicking into a cell reveals a floating table management toolbar with buttons to add/delete rows and columns.

![Data table inserted beneath a Given step](docs/screenshots/data-table.png)

---

## Import

The **Import** button opens a modal with a textarea. Paste raw Gherkin text or Markdown-prefixed Gherkin (headings for Feature/Scenario, list items for steps). Clicking **Insert** parses the text and populates the editor; **Cancel** closes the modal without changing anything. Pipe-delimited rows in the pasted text are recognised and inserted as data table blocks.

![Import modal with pasted Gherkin](docs/screenshots/import-modal.png)

---

## Export

Two export buttons are always visible in the toolbar:

- **Export TXT** — downloads `gherkin.txt` in plain `Keyword: text` format, one block per line, with pipe-delimited rows for any data tables.
- **Export MD** — downloads `gherkin.md` using Markdown conventions: `#` headings for Feature, `##` for Scenario, `- list items` for steps, and a GFM pipe table with separator row for data tables.

![Export TXT and Export MD buttons](docs/screenshots/export-buttons.png)

---

## Real-time collaboration

Share the session URL with teammates. Every editor connected to the same session sees changes live. Y.js CRDTs handle concurrent edits without conflicts.
Collaborators' cursors appear with coloured labels so you can see where everyone is working.

Just like Google Docs, edits are real-time replicated between users.
/
To invite someone, click **Copy invite link** next to the session title — it copies the session URL to the clipboard.

![Copy invite link next to the session title](docs/screenshots/collaboration.png)

---

## AI Coaching

The **Get AI Coaching** button sends the current document to an LLM (selectable from the dropdown) and opens a modal with structured feedback rendered as Markdown. Useful for catching vague steps, missing edge cases, or structural issues before exporting to Jira.

![AI Coaching result modal](docs/screenshots/ai-coaching-modal.png)

While a review is in flight, the button is disabled and shows **Reviewing…** so it's clear a request is pending. After closing the modal, a **View last review** button appears to re-open the cached result without re-running the request.

### Editing the prompt

The **Edit prompt** button opens a modal where you can customise the system prompt sent to the LLM. Changes are saved per-session and persist across page refreshes. The Save button is disabled until the prompt is at least 10 characters.

![Edit prompt modal](docs/screenshots/edit-prompt-modal.png)

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Resend](https://resend.com) account for magic link emails (free tier: 3,000 emails/month)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
```

Edit `.env.local` and fill in:


| Variable             | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `AUTH_SECRET`        | Random string — run`openssl rand -base64 32`          |
| `AUTH_RESEND_KEY`    | API key from resend.com                                |
| `OPENROUTER_API_KEY` | API key from openrouter.ai — required for AI Coaching |
| `AUTH_EMAIL_FROM`    | A sender address verified in your Resend account       |
| `DATABASE_URL`       | Already set to`file:./dev.db` for local SQLite         |

```bash
# 3. Run database migrations
npx prisma migrate dev

# 4. Seed the dev database
npm run seed

# 5. Start both servers
npm run dev:all
```

Visit `http://localhost:3000` — you'll be redirected to the sign-in page. Enter your email and click the magic link to authenticate.

### Commands


| Command                  | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm run dev:all`        | Start Next.js + Y.js WebSocket server together |
| `npm run dev`            | Start Next.js dev server only                  |
| `npm run dev:ws`         | Start Y.js WebSocket sync server only          |
| `npm run build`          | Build for production                           |
| `npm run test`           | Run Vitest unit tests                          |
| `npm run test:e2e`       | Run Playwright end-to-end tests                |
| `npm run lint`           | Lint the codebase                              |
| `npx prisma migrate dev` | Apply database migrations                      |
| `npx prisma studio`      | Browse the database in a UI                    |

---

## Docs

- [docs/technical.md](./docs/technical.md) — architecture, design, and test coverage
- [SPEC.md](./SPEC.md) — what the app does and who uses it
- [DECISIONS.md](./DECISIONS.md) — why the stack was chosen
- [TESTING.md](./TESTING.md) — testing strategy
- [CLAUDE.md](./CLAUDE.md) — orientation for AI-assisted development

## Logs

Runtime logs are written to `logs/app.log` and `logs/error.log`. These are not committed to git.
