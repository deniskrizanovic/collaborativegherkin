# Collaborative Gherkin — orientation for Claude

## What this project is
A real-time collaborative Gherkin editor. Multiple people share one central
web app and edit the same Gherkin acceptance criteria simultaneously, seeing
each other's changes live. Sessions produce Gherkin that users export to
tools like Jira. The app is a workspace, not a permanent archive.

## Stack
- **Framework:** Next.js 15 (App Router) — TypeScript front end and back end
- **Editor:** Tiptap with Y.js for real-time collaboration
- **Database:** SQLite (dev, CI) / PostgreSQL (production) via Drizzle ORM
- **Auth:** NextAuth.js v5
- **Validation:** Zod
- **Formatting:** Biome (formatter + import sorting only; linter off, oxlint lints)
- **Linting:** oxlint (`.oxlintrc.json`, parity with the former Next.js ESLint preset; any warning fails)
- **Logging:** Pino → logs/app.log and logs/error.log
- **Testing:** Vitest (unit); Robot Framework (`robot/`) is the e2e suite
  that runs in CI and `test:all`; Playwright (`e2e/`) is kept as Robot's
  parity reference, run by hand and weekly in CI

## Key commands
```bash
pnpm dev       # start the server (Next.js HTTP + Y.js sync WebSocket) at http://localhost:3000
pnpm build     # production build
pnpm test      # run tests with Vitest
pnpm exec vitest run <path>   # one test file (`pnpm test -- <path>` ignores the path and runs everything)
pnpm lint      # lint with oxlint
pnpm format       # Biome format + import sort, written to the whole tree
pnpm lint:format  # Biome format/import-order check on the whole tree (pre-commit formats staged files)
pnpm test:robot       # Robot e2e suite — the e2e suite CI and test:all run
pnpm test:e2e         # Playwright e2e — parity reference, manual (CI runs it weekly)
pnpm test:mutation    # Stryker mutation run over src/lib (~1 min); manual, CI runs it weekly; fails below the break threshold
pnpm test:mutation:staged  # Stryker on each staged in-scope src/lib file (whole file); runs in the pre-commit hook; fails below break
pnpm lint:e2e-parity  # every Playwright test has a robot/PARITY.md row + same-named Robot test
pnpm lint:crap        # CRAP score (complexity × unit-test coverage) per src/ function; fails above 30
pnpm lint:openspec    # openspec validate --all --strict on specs + active changes; any warning fails
pnpm lint:unarchived  # fails when an active change has every task checked but is not archived (runs on merge and branch delete, not pre-commit/CI)
pnpm seed      # seed dev database with placeholder user
pnpm db:migrate       # apply SQLite migrations (drizzle/sqlite/) to DATABASE_URL
pnpm db:generate      # after editing src/db/schema.*.ts: new migration for both engines
pnpm db:migrate:prod  # apply PostgreSQL migrations (drizzle/pg/) to DATABASE_URL
pnpm db:studio        # open Drizzle Studio on the local database
```

`pnpm dev` runs one process serving both HTTP and the real-time sync
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
    db.ts         # Drizzle db singleton — engine picked from DATABASE_URL
  db/
    schema.sqlite.ts  # SQLite schema (dev, CI) — parity with schema.pg.ts
    schema.pg.ts      # PostgreSQL schema (production)
    testing.ts        # createTestDb("sqlite" | "pg") for unit tests
drizzle/
  sqlite/         # SQLite migrations (drizzle-kit)
  pg/             # PostgreSQL migrations (drizzle-kit)
scripts/
  seed.ts         # Dev seed — creates dev@example.com user
server.js               # Custom Node server — Next.js HTTP + authenticated Y.js WebSocket
logs/             # Written at runtime — never commit
```

## Architectural decisions
- All Gherkin structure rules live in `src/lib/gherkin.ts`. Do not
  duplicate them elsewhere.
- Real-time collaboration is handled by Tiptap's built-in Y.js integration.
  The sync layer should not be modified without careful testing.
- Review rules (error handling, server-side Zod, test style) live in
  `CODING_STANDARDS.md`; the `reviewer` agent applies them to the diff.

## Git Workflow

Commit, push or merge only when the user explicitly asks. Implement, verify,
and report — then wait for a commit instruction. The steps below describe
*how* to carry out Git work once asked.

- Check branch before any edit: `git branch --show-current`
- **Never edit on `main` or `master`** — tell user to create feature branch first
- When asked to commit: feature branch → `reviewer` agent on the diff (fix or report its findings) → archive the finished OpenSpec change (on the feature branch, not a later `chore-archive-*` branch) → commit → push → merge to main → push main → delete branch
- Conventional commits: `type[scope]: description` (feat/fix/docs/refactor/chore/etc.)
- Never use `--no-verify` unless user explicitly asks

## OpenSpec change standard: every change must link an open GitHub issue

Every active OpenSpec change (`openspec/changes/<name>/`, excluding `archive/`)
MUST have a `## GitHub Issue` section at the top of its `proposal.md` containing
the full URL of a **real, open** issue on this repository:

```
https://github.com/deniskrizanovic/collaborativegherkin/issues/N
```

The `lint:issue-link` gate (`pnpm lint:issue-link`) enforces this. Because it
calls the GitHub API (network + `gh` auth), it runs in the Claude Code
`PreToolUse` commit hook and in CI (`.github/workflows/ci.yml`) — **not** in the
git/husky pre-commit hook, which stays offline-safe. A commit that includes an
active change with no valid open-issue link is blocked by the Claude hook; CI is
the authoritative catch-all for commits made outside the agent.

Spec traceability is a separate gate: `lint:specs` (`pnpm lint:specs`) is a
pure filesystem check, so it runs in the husky pre-commit hook (whole spec tree,
every commit) **and** in CI.

Specs live under category folders — `openspec/specs/{product/gherkin,product/sessions,quality,process}/<capability>/`, so spec ids are paths like `product/gherkin/gherkin-editor` — and `> **Tests:**` links use repo-root targets (`/scripts/x.test.ts`); `lint:spec-layout` enforces both.

**Host-pinning convention** — the `gh` CLI must always target `github.com`, not
the Salesforce enterprise account:
- For `gh api` calls: `--hostname github.com`
- For `gh issue create`: `GH_HOST=github.com gh issue create ...`

The `/opsx:propose` flow auto-creates the issue before finalising artifacts, so
the gate almost never fires in practice — it is a safety net.

## Guardrails
- Secrets go in `.env.local`. Commit no `logs/` directory and no `.env*` file except `.env.example`.
- Back up production before running a database migration against it.

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
4. Any database migration that has run against real data
5. The export logic once people are relying on it for Jira exports
