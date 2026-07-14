# Collaborative Gherkin — orientation for Claude

## What this project is
A real-time collaborative Gherkin editor. Multiple people share one central
web app and edit the same Gherkin acceptance criteria simultaneously, seeing
each other's changes live. Sessions produce Gherkin that users export to
tools like Jira. The app is a workspace, not a permanent archive.

## Stack
- **Framework:** Next.js 15 (App Router) — TypeScript front end and back end
- **Editor:** Tiptap with Y.js for real-time collaboration
- **Database:** SQLite (dev) / PostgreSQL (production) via Prisma
- **Auth:** NextAuth.js v5
- **Validation:** Zod
- **Logging:** Pino → logs/app.log and logs/error.log
- **Testing:** Vitest, playwright

## Key commands
```bash
npm run dev       # start the server (Next.js HTTP + Y.js sync WebSocket) at http://localhost:3000
npm run build     # production build
npm run test      # run tests with Vitest
npm run lint      # lint with Next.js ESLint config
npm run seed      # seed dev database with placeholder user
npx prisma migrate dev   # run database migrations in development
npx prisma studio        # open database browser UI
```

`npm run dev` runs one process serving both HTTP and the real-time sync
WebSocket on the same origin (`http://localhost:3000`). The WebSocket upgrade is
authenticated by the same-origin NextAuth session cookie (see `server.js`).

## Project structure
```
src/
  app/
    page.tsx                    # Home — session list + create form
    HomeClient.tsx              # Client component for home page
    layout.tsx                  # Root layout
    globals.css                 # Global styles
    api/auth/[...nextauth]/     # NextAuth route handler
    api/sessions/               # REST API: list/create sessions (auth required)
    api/sessions/[id]/          # REST API: get/delete a session (auth required)
    sessions/[id]/page.tsx      # Session page (server component)
    sessions/[id]/SessionView.tsx  # Session page (client shell)
  auth.ts                       # NextAuth v5 config — Resend magic link, JWT strategy
  middleware.ts                 # Auth gate — all routes require sign-in
  components/
    GherkinEditor.tsx           # Tiptap + Y.js collaborative editor
  lib/
    gherkin.ts    # Gherkin block types, validation rules, export logic
    logger.ts     # Pino logger — use this everywhere, not console.log
    db.ts         # Prisma client singleton
prisma/
  schema.prisma   # Database schema
  seed.ts         # Dev seed — creates dev@example.com user
server.js               # Custom Node server — Next.js HTTP + authenticated Y.js WebSocket
logs/             # Written at runtime — never commit
```

## Architectural decisions
- All Gherkin structure rules live in `src/lib/gherkin.ts`. Do not
  duplicate them elsewhere.
- Real-time collaboration is handled by Tiptap's built-in Y.js integration.
  The sync layer should not be modified without careful testing.
- Use the logger from `src/lib/logger.ts` instead of `console.log` everywhere
  in server-side code.
- Wrap all database calls, network calls, and file system operations in
  try/catch and log errors before re-throwing.

## Git commits
Do not create git commits unless the user explicitly asks. Implement, verify,
and report — then wait for a commit instruction.

## Git Workflow

The "## Git commits" gate above still applies: never commit, push, or merge
unless the user explicitly asks. The steps below describe *how* to carry out
Git work once the user has asked for it — they are not license to act
autonomously.

- Check branch before any edit: `git branch --show-current`
- **Never edit on `main` or `master`** — tell user to create feature branch first
- When asked to commit: feature branch → commit → push → merge to main → push main → delete branch
- Conventional commits: `type[scope]: description` (feat/fix/docs/refactor/chore/etc.)
- Never use `--no-verify` unless user explicitly asks

## OpenSpec change standard: every change must link an open GitHub issue

Every active OpenSpec change (`openspec/changes/<name>/`, excluding `archive/`)
MUST have a `## GitHub Issue` section at the top of its `proposal.md` containing
the full URL of a **real, open** issue on this repository:

```
https://github.com/deniskrizanovic/collaborativegherkin/issues/N
```

The `lint:issue-link` gate (`npm run lint:issue-link`) enforces this. Because it
calls the GitHub API (network + `gh` auth), it runs in the Claude Code
`PreToolUse` commit hook and in CI (`.github/workflows/ci.yml`) — **not** in the
git/husky pre-commit hook, which stays offline-safe. A commit that includes an
active change with no valid open-issue link is blocked by the Claude hook; CI is
the authoritative catch-all for commits made outside the agent.

Spec traceability is a separate gate: `lint:specs` (`npm run lint:specs`) is a
pure filesystem check, so it runs in the husky pre-commit hook (whole spec tree,
every commit) **and** in CI.

**Host-pinning convention** — the `gh` CLI must always target `github.com`, not
the Salesforce enterprise account:
- For `gh api` calls: `--hostname github.com`
- For `gh issue create`: `GH_HOST=github.com gh issue create ...`

The `/opsx:propose` flow auto-creates the issue before finalising artifacts, so
the gate almost never fires in practice — it is a safety net.

## Anti-patterns to avoid
- Do not use `console.log` in server-side code — use the Pino logger.
- Do not allow Gherkin block sequences that fail `canFollow()` in gherkin.ts.
- Do not store secrets in code or committed files — they go in `.env.local`.
- Do not commit the `logs/` directory or any `.env*` file except `.env.example`.
- Do not run database migrations against production without a backup.
- Do not add validation client-side only — validate with Zod on the server too.

## Planning sessions
After every planning session, save the plan to `docs/plans/YYYY-MM-DD-HH:MM-<short-description>.md`
before exiting plan mode. The HH:MM is to be the created datetime

When in plan mode, do not ask for approval via text. Write the plan, then call ExitPlanMode directly — let the UI handle approval.

## Planning UI changes
Before finalising a plan that adds or changes a UI element, grep `e2e/` for
every selector or class name the element will use. Read each matching spec and
note which assertions (count, text, visibility) are affected. Resolve any
conflict in the plan — distinct class, updated test, or design adjustment —
before writing any code.

## Do Not Touch (without explicit permission)
1. `src/lib/gherkin.ts` — the Gherkin block structure and validation rules
2. Tiptap + Y.js collaboration configuration once real-time sync is working
3. NextAuth.js configuration once real users are logging in
4. Any Prisma migration that has run against real data
5. The export logic once people are relying on it for Jira exports
