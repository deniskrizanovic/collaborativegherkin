# Architectural decisions

---

## TypeScript for both front end and back end
Alternatives considered: Python (FastAPI) backend + TypeScript frontend.
Reason: Node.js handles many simultaneous WebSocket connections efficiently,
which is a core requirement for real-time collaboration. Same language on
both sides reduces context switching.
Date: 2026-05-16

---

## Next.js as the full-stack framework
Alternatives considered: Vite (frontend only) + Express (separate backend).
Reason: Next.js provides a built-in server alongside the frontend in a single
project, reducing operational complexity. The existing Vite scaffold was
replaced because it had no production code worth keeping.
Date: 2026-05-16

---

## Tiptap as the editor
Alternatives considered: raw Y.js with a custom editor, Slate.js, ProseMirror.
Reason: Tiptap provides a Notion-style block editor with Y.js real-time
collaboration as a first-class feature. Custom Gherkin node types can be
defined without writing low-level editor plumbing from scratch.
Date: 2026-05-16

---

## Gherkin structure is enforced, not warned
Alternatives considered: warn on invalid sequences but allow them.
Reason: the app's core purpose is to produce valid Gherkin. Allowing invalid
sequences degrades the output quality and shifts the burden of correctness
back to the user.
Date: 2026-05-16

---

## PostgreSQL as the database
Alternatives considered: SQLite.
Reason: multiple users write to the same session simultaneously. SQLite
struggles with concurrent writes. PostgreSQL handles this cleanly and is the
standard for team tools.
Date: 2026-05-16

---

## Session data is transient — export is the record of truth
Alternatives considered: treating the app as a permanent archive.
Reason: users confirmed they are happy to export after each session and store
in Jira. This simplifies the database schema and backup requirements.
Date: 2026-05-16

---

## Hosting deferred until local version works
Alternatives considered: Heroku Private Space.
Reason: app is primarily for non-Salesforce users. Hosting choice deferred
until the app runs locally and basic tests pass, as per safety guidelines.
Date: 2026-05-16

---

## Pino for logging
Alternatives considered: winston, console.log.
Reason: Pino is the fastest structured logger for Node.js, widely used, and
its output format is easy to search and read back when diagnosing issues.
Date: 2026-05-16
