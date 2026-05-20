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
npm run dev       # start Next.js dev server at http://localhost:3000
npm run dev:ws    # start Y.js WebSocket sync server at ws://localhost:1234
npm run build     # production build
npm run test      # run tests with Vitest
npm run lint      # lint with Next.js ESLint config
npm run seed      # seed dev database with placeholder user
npx prisma migrate dev   # run database migrations in development
npx prisma studio        # open database browser UI
```

Both `dev` and `dev:ws` must be running for real-time collaboration to work.

## Project structure
```
src/
  app/
    page.tsx                    # Home — session list + create form
    HomeClient.tsx              # Client component for home page
    layout.tsx                  # Root layout
    globals.css                 # Global styles
    api/sessions/               # REST API: list/create sessions
    api/sessions/[id]/          # REST API: get/delete a session
    sessions/[id]/page.tsx      # Session page (server component)
    sessions/[id]/SessionView.tsx  # Session page (client shell)
  components/
    GherkinEditor.tsx           # Tiptap + Y.js collaborative editor
  lib/
    gherkin.ts    # Gherkin block types, validation rules, export logic
    logger.ts     # Pino logger — use this everywhere, not console.log
    db.ts         # Prisma client singleton
prisma/
  schema.prisma   # Database schema
  seed.ts         # Dev seed — creates placeholder user
y-websocket-server.mjs  # Standalone Y.js WebSocket sync server
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

## Anti-patterns to avoid
- Do not use `console.log` in server-side code — use the Pino logger.
- Do not allow Gherkin block sequences that fail `canFollow()` in gherkin.ts.
- Do not store secrets in code or committed files — they go in `.env.local`.
- Do not commit the `logs/` directory or any `.env*` file except `.env.example`.
- Do not run database migrations against production without a backup.
- Do not add validation client-side only — validate with Zod on the server too.

## Planning sessions
After every planning session, save the plan to `plans/YYYY-MM-DD-HH:MM-<short-description>.md`
in the project root before exiting plan mode. The HH:MM is to be the created datetime

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
