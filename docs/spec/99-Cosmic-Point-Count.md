# COSMIC Function Point Count

**Application:** Collaborative Gherkin
**Method:** ISO/IEC 19761 — COSMIC Functional Size Measurement v5.0
**Date:** 2026-06-04
**Counted by:** Claude (Opus 4.7), interactive walkthrough with project owner

---

## 1. Measurement scope and purpose

| Item | Value |
|------|-------|
| Purpose | Establish baseline functional size of the application as it exists on `main` |
| Scope | Whole application — Next.js front end, Next.js API routes, Y.js WebSocket sync server, Prisma data layer — measured as a single piece of software with one boundary |
| Layer | Application layer (a single layer, no peer software) |
| Granularity | Functional process level |
| Unit | CFP (1 CFP = 1 data movement) |

### Out of scope
- Logging (`logger`, log files) — non-functional
- Test infrastructure (Vitest, Playwright, `TEST_AUTH_SECRET` credentials provider)
- Build tooling, ESLint, TypeScript, package management
- Tiptap intra-editor UI affordances that do not cross the boundary (slash menu, modal open/close, copy-link clipboard write)

---

## 2. Functional users

| User | Role |
|------|------|
| Editor User | Authenticated human who creates sessions, edits Gherkin, manages prompt/model, reviews AI feedback |
| Collaborator User | Additional authenticated humans whose Y.js edits arrive over the WebSocket sync channel |
| Resend (email service) | External service that delivers magic-link emails on behalf of NextAuth |
| OpenRouter (LLM gateway) | External service that returns model output for AI coaching |

Note: Editor User and Collaborator User are distinguished only because their interaction surface differs (the former drives REST + WS; the latter drives WS-only inbound). They share identity semantics.

---

## 3. Persistent storage boundary

Persistent storage in scope is the Prisma-managed relational database (SQLite in dev, PostgreSQL in production). Tables: `User`, `Account`, `VerificationToken`, `Session`.

The Y.js doc state held by `y-websocket-server.mjs` is **in-memory only**. Rooms are created on first connection and discarded once the last client disconnects (`closeRoom` in `y-websocket-server.mjs:59`). No disk or DB persistence. Y.js movements therefore generate Entries (E) and Exits (X) but no Reads (R) or Writes (W).

NextAuth session strategy is `jwt` (`src/auth.ts:41`) — session state is stateless, carried in cookies. Only the `VerificationToken` and `User`/`Account` tables generate persistent storage movements.

---

## 4. Data movement rules applied

For each functional process, COSMIC counts four kinds of data movement:

- **Entry (E):** boundary-crossing input from a functional user
- **Exit (X):** boundary-crossing output to a functional user
- **Read (R):** retrieval from persistent storage
- **Write (W):** persistence to persistent storage

Each unique data group moved counts once per movement type per process. Auth checks that retrieve the same data group are consolidated; an `auth()` call followed by an immediate DB read of the same record is counted once. Error/validation responses are not separately counted (the same Exit can carry success or failure of one data group).

---

## 5. Functional processes

### FP-01 — Request magic link

**Trigger:** Editor User submits email on `/auth/signin`.
**Flow:** NextAuth Resend provider creates a `VerificationToken` and asks Resend to deliver a magic-link email; the user is shown a check-your-email page.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Sign-in form (email) | 1 |
| W | VerificationToken row | 1 |
| X | Outbound email request to Resend (functional user) | 1 |
| X | Check-email response page | 1 |

**Subtotal: 4 CFP**

---

### FP-02 — Verify magic link

**Trigger:** Editor User clicks the link in their inbox; NextAuth callback route handles the token.
**Flow:** Token is read, validated, consumed; user record is upserted; auth cookie issued; redirect to home.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Token from query string | 1 |
| R | VerificationToken | 1 |
| W | User upsert | 1 |
| W | VerificationToken delete | 1 |
| X | Auth cookie + redirect to `/` | 1 |

**Subtotal: 5 CFP**

---

### FP-03 — Sign out

**Trigger:** Editor User clicks "Sign out" in the home header (`HomeClient.tsx:57`).
**Flow:** NextAuth clears the cookie and redirects.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Sign-out request | 1 |
| X | Cleared cookie + redirect | 1 |

**Subtotal: 2 CFP**

---

### FP-04 — List sessions on home page

**Trigger:** Authenticated Editor User loads `/`.
**Flow:** `Home` server component reads sessions for the authenticated user (`src/app/page.tsx:9`) and renders the home view.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Page request (auth context) | 1 |
| R | Session list for user | 1 |
| X | Rendered home page | 1 |

**Subtotal: 3 CFP**

(The `GET /api/sessions` route is functionally equivalent and consolidated into this process — no client currently drives it independently from the home page.)

---

### FP-05 — Create session

**Trigger:** Editor User submits the "New session" form (`HomeClient.tsx:31`) → `POST /api/sessions`.
**Flow:** Validate title with Zod, persist a new Session row, return the created record so the client navigates to it.

| Movement | Data group | Count |
|----------|------------|-------|
| E | New-session payload (title) | 1 |
| W | Session row | 1 |
| X | Created session JSON (id) | 1 |

**Subtotal: 3 CFP**

---

### FP-06 — Get session metadata via API

**Trigger:** `SessionView` client component fetches `/api/sessions/[id]` on mount to populate model and prompt (`SessionView.tsx:32`).
**Flow:** Auth gate, read Session, return metadata JSON.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Session id request | 1 |
| R | Session row | 1 |
| X | Session metadata JSON | 1 |

**Subtotal: 3 CFP**

---

### FP-07 — Render session page

**Trigger:** Editor or Collaborator navigates to `/sessions/[id]`.
**Flow:** Server component reads `Session` (id, title), 404s if missing, renders `SessionView` shell.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Page request with id | 1 |
| R | Session row | 1 |
| X | Rendered session page | 1 |

**Subtotal: 3 CFP**

---

### FP-08 — Update session prompt

**Trigger:** Editor User saves the prompt textarea (`SessionView.tsx:94`) → `PATCH /api/sessions/[id]` with `{ prompt }`.
**Flow:** Auth gate, Zod-validate prompt (≥10 chars), write Session.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Prompt payload | 1 |
| W | Session row (prompt field) | 1 |
| X | Acknowledgement | 1 |

**Subtotal: 3 CFP**

---

### FP-09 — Update session model

**Trigger:** Editor User changes the model `<select>` (`SessionView.tsx:64`) → `PATCH /api/sessions/[id]` with `{ model }`.
**Flow:** Auth gate, Zod-enum check, write Session.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Model payload | 1 |
| W | Session row (model field) | 1 |
| X | Acknowledgement | 1 |

**Subtotal: 3 CFP**

---

### FP-10 — Delete session

**Trigger:** `DELETE /api/sessions/[id]` (currently API-only; no UI path on `main`).
**Flow:** Auth gate, read Session to check ownership, delete row.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Delete request (id) | 1 |
| R | Session (ownership check) | 1 |
| W | Session delete | 1 |
| X | 204 / error response | 1 |

**Subtotal: 4 CFP**

---

### FP-11 — WebSocket connect and initial sync

**Trigger:** Editor or Collaborator opens a session page; `useCollabProvider` opens a WebSocket to the Y.js sync server.
**Flow:** Server registers client in the room, sends `syncStep1` and current awareness state.

| Movement | Data group | Count |
|----------|------------|-------|
| E | WebSocket open + room name | 1 |
| X | syncStep1 frame | 1 |
| X | Initial awareness state frame | 1 |

**Subtotal: 3 CFP**

(No R/W — Y.js doc lives in process memory only.)

---

### FP-12 — Document update broadcast

**Trigger:** Any client emits a Y.js update.
**Flow:** Server applies it to the room ydoc; ydoc `update` listener broadcasts the encoded update to all peers except origin (`y-websocket-server.mjs:32`).

| Movement | Data group | Count |
|----------|------------|-------|
| E | Inbound update frame | 1 |
| X | Outbound update frame to peers | 1 |

**Subtotal: 2 CFP**

---

### FP-13 — Awareness update

**Trigger:** Client sends an awareness (cursor/presence) update.
**Flow:** Server applies it to the room awareness; awareness `update` listener broadcasts to all clients.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Inbound awareness frame | 1 |
| X | Outbound awareness frame | 1 |

**Subtotal: 2 CFP**

---

### FP-14 — WebSocket disconnect

**Trigger:** Client closes the WebSocket.
**Flow:** Server removes the client, removes its awareness state, broadcasts the awareness removal, tears down empty rooms (`y-websocket-server.mjs:131`).

| Movement | Data group | Count |
|----------|------------|-------|
| E | WebSocket close event | 1 |
| X | Awareness-removed frame to remaining peers | 1 |

**Subtotal: 2 CFP**

---

### FP-15 — AI coaching review

**Trigger:** Editor User clicks "Get AI Coaching" (`SessionView.tsx:73`) → `POST /api/llm-review`.
**Flow:** Validate body, read Session for stored `prompt` and `model`, call OpenRouter, return result.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Review request (content + sessionId) | 1 |
| R | Session (prompt, model) | 1 |
| X | Outbound LLM request to OpenRouter | 1 |
| E | LLM response from OpenRouter | 1 |
| X | Review result JSON to Editor User | 1 |

**Subtotal: 5 CFP**

---

### FP-16 — Export Gherkin as plain text

**Trigger:** Editor User clicks "Export TXT" in the editor toolbar (`GherkinEditor.tsx:165`).
**Flow:** Editor serialises current document to text and triggers a browser download.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Export request (button click) | 1 |
| X | Generated `.txt` blob to user | 1 |

**Subtotal: 2 CFP**

---

### FP-17 — Export Gherkin as Markdown

**Trigger:** Editor User clicks "Export MD" (`GherkinEditor.tsx:177`).
**Flow:** Convert blocks via `exportToMarkdown` and trigger a download.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Export request | 1 |
| X | Generated `.md` blob | 1 |

**Subtotal: 2 CFP**

---

### FP-18 — Import Gherkin text

**Trigger:** Editor User pastes Gherkin into the import modal and clicks Insert (`GherkinEditor.tsx:190`).
**Flow:** Parse text via `parseGherkin`, insert resulting nodes into the editor doc.

| Movement | Data group | Count |
|----------|------------|-------|
| E | Imported Gherkin text | 1 |
| X | Rendered editor content reflecting the import | 1 |

**Subtotal: 2 CFP**

---

## 6. Summary

| # | Functional process | E | R | W | X | CFP |
|---|---|---|---|---|---|---|
| FP-01 | Request magic link | 1 | 0 | 1 | 2 | 4 |
| FP-02 | Verify magic link | 1 | 1 | 2 | 1 | 5 |
| FP-03 | Sign out | 1 | 0 | 0 | 1 | 2 |
| FP-04 | List sessions on home | 1 | 1 | 0 | 1 | 3 |
| FP-05 | Create session | 1 | 0 | 1 | 1 | 3 |
| FP-06 | Get session metadata via API | 1 | 1 | 0 | 1 | 3 |
| FP-07 | Render session page | 1 | 1 | 0 | 1 | 3 |
| FP-08 | Update session prompt | 1 | 0 | 1 | 1 | 3 |
| FP-09 | Update session model | 1 | 0 | 1 | 1 | 3 |
| FP-10 | Delete session | 1 | 1 | 1 | 1 | 4 |
| FP-11 | WS connect + initial sync | 1 | 0 | 0 | 2 | 3 |
| FP-12 | Doc update broadcast | 1 | 0 | 0 | 1 | 2 |
| FP-13 | Awareness update | 1 | 0 | 0 | 1 | 2 |
| FP-14 | WS disconnect | 1 | 0 | 0 | 1 | 2 |
| FP-15 | AI coaching review | 2 | 1 | 0 | 2 | 5 |
| FP-16 | Export TXT | 1 | 0 | 0 | 1 | 2 |
| FP-17 | Export MD | 1 | 0 | 0 | 1 | 2 |
| FP-18 | Import Gherkin text | 1 | 0 | 0 | 1 | 2 |
| **Total** | | **19** | **5** | **7** | **22** | **53** |

**Functional size: 53 CFP**

---

## 7. Notes and caveats

- COSMIC produces a functional size, not an effort estimate. Local productivity factors must be applied to convert CFP into hours/cost.
- Several processes are conservatively counted as single processes even though they invoke multiple persistence touches inside NextAuth (e.g. FP-02). If a stricter reading is needed, NextAuth-internal Account-table writes during first sign-in could add 1 W to FP-02 (→ 6 CFP).
- Y.js sync processes (FP-11 to FP-14) crossed the application boundary but did not touch persistent storage on `main`; if a Y.js persistence layer is added later (e.g. `y-leveldb`, snapshot-to-Postgres), each of these processes will gain at least 1 R or 1 W.
- The `GET /api/sessions` REST endpoint is consolidated into FP-04 because no client currently exercises it independently of the server-rendered home page. If a separate client surface starts calling it (mobile, third-party API consumer), it should be split into its own functional process.
- This count reflects the state of `main` as of the date above. Any feature added or removed should trigger an incremental re-count of the affected processes only.
