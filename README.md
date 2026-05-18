# Collaborative Gherkin

A real-time collaborative editor for writing Gherkin acceptance criteria together.

## Prerequisites

- Node.js 20+

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and fill in your DATABASE_URL and AUTH_SECRET

# 3. Set up the database
npx prisma migrate dev

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:ws` | Start Y.js WebSocket sync server (required for real-time collaboration) |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run lint` | Lint the codebase |
| `npx prisma migrate dev` | Apply database migrations |
| `npx prisma studio` | Browse the database in a UI |

## Project docs

- [SPEC.md](./SPEC.md) — what the app does and who uses it
- [DECISIONS.md](./DECISIONS.md) — why the stack was chosen
- [CLAUDE.md](./CLAUDE.md) — orientation for AI-assisted development

## Logs

Runtime logs are written to `logs/app.log` and `logs/error.log`. These are
not committed to git. Check them when diagnosing issues.
