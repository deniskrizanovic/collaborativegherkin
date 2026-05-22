# Project Improvement Recommendations

**Date:** 2026-05-22  
**Status:** Proposed

---

## 1. Single dev command (one-liner) ✅ DONE

**Problem:** Developers must remember to start both `npm run dev` and `npm run dev:ws`. Forgetting the WebSocket server produces silent collaboration failures.

**Fix:** Add a `dev:all` script to `package.json` using the already-installed `npm-run-all2`:

```json
"dev:all": "run-p dev dev:ws"
```

**Files:** `package.json`  
**Effort:** Trivial (one line)

---

## 2. SQLite provider hardcoded in Prisma schema ✅ DONE

**Problem:** `.env.example` implies that setting `DATABASE_URL` to a Postgres connection string is enough for production. It is not — `provider = "sqlite"` in `prisma/schema.prisma` is a compile-time setting. Deploying to Postgres without fixing this will produce incompatible migrations or runtime failures.

**Fix:** Maintain two schema configurations, or introduce a `DATABASE_PROVIDER` env var with `provider = env("DATABASE_PROVIDER")`. The simpler path for this project is a `prisma/schema.prod.prisma` with `provider = "postgresql"` and a documented build step that copies it before running `prisma migrate deploy`.

Implemented via `prisma/postgres/` directory containing the PostgreSQL schema and documented build strategy.

**Files:** `prisma/schema.prisma`, `.env.example`, deployment docs  
**Effort:** Small — schema change + doc update

---

## 3. No per-session authorization check 🟠 DEFERRED — blocked on auth

**Problem:** `GET /api/sessions/[id]` and `DELETE /api/sessions/[id]` do not verify that `session.userId === currentUser.id`. Any authenticated user can read or delete another user's session.

**Blocker:** NextAuth is installed but not wired up — no route handlers, no middleware, no `auth()` calls. The client uses a hardcoded placeholder `userId`. There is no authenticated user to compare against yet.

**Fix (when auth is implemented):** In the route handlers, after fetching the session, compare `session.userId` against the authenticated user's id and return `403` if they differ.

**Files:** `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/route.test.ts`  
**Effort:** Small — guard clause + test cases (prerequisite: NextAuth wired up)

---

## 4. No CI pipeline ✅ DONE

**Problem:** There is no `.github/workflows/` directory. Lint, typecheck, and all three test layers must be run manually. Broken changes can land undetected.

**Fix:** Add a GitHub Actions workflow that runs on pull requests and pushes to `main`:

```yaml
# .github/workflows/ci.yml
- npm ci
- npm run lint
- npm run typecheck
- npm run test -- --run
- npx playwright install --with-deps chromium
- npm run test:e2e
```

**Files:** `.github/workflows/ci.yml` (new file)  
**Effort:** Small — one workflow file

---

## 5. `SessionSummary` and `SessionRecord` are duplicate types

**Problem:** Both interfaces in `src/lib/session.ts` (lines 7–22) declare identical fields (`id`, `title`, `createdAt`, `userId`). They will drift over time and confuse future readers.

**Fix:** Consolidate into a single `SessionRecord` type. If a distinct summary type is needed in future (e.g. omitting `content`), introduce it then.

**Files:** `src/lib/session.ts`, `src/lib/session.test.ts`, any consumers  
**Effort:** Trivial — type consolidation, no logic change

---

## 6. `y-websocket-server.mjs` has no type safety

**Problem:** The WebSocket server is plain untyped JavaScript (`.mjs`), while everything else in the project is TypeScript. Errors in this file are caught only at runtime.

**Fix (incremental):** Add `// @ts-check` with JSDoc annotations as a low-risk immediate improvement. A follow-up can migrate it to `.ts` run via `tsx`, consistent with `prisma/seed.ts`.

**Files:** `y-websocket-server.mjs`  
**Effort:** Small to medium depending on migration depth

---

## 7. Upgrade NextAuth from beta to stable

**Problem:** `next-auth` is pinned to `v5.0.0-beta.25` (late 2024). NextAuth v5 is now stable. Running a beta in production carries bug and security risk; the longer the upgrade is deferred, the larger the diff will be.

**Fix:** Upgrade to the latest stable `next-auth` v5 release. Review the changelog for any breaking changes in auth configuration, then run the full test suite.

**Files:** `package.json`, `src/` (auth config, if any changes required)  
**Effort:** Medium — depends on breaking changes between beta.25 and stable

---

## 8. No pre-commit hooks

**Problem:** Nothing prevents `console.log` statements or type errors from being committed. CLAUDE.md documents the rule but there is no enforcement.

**Fix:** Add `husky` + `lint-staged` to run `tsc --noEmit` and `eslint` on staged TypeScript files before each commit.

**Files:** `package.json`, `.husky/pre-commit` (new), `.lintstagedrc` or inline config  
**Effort:** Small — tooling setup only

---

## 9. Upgrade Prisma from v6 to v7

**Problem:** `prisma` and `@prisma/client` are pinned to `^6.0.0`. Prisma 7 is now current. Running v6 in CI requires using the locally installed binary to avoid `npx` pulling v7 (which has breaking changes). Staying on v6 long-term means missing performance, type safety, and driver improvements.

**Breaking changes in v7 to address:**
- `url` must leave `schema.prisma` and move to a new `prisma.config.ts` at the project root
- SQLite now requires an explicit adapter (`@prisma/adapter-better-sqlite3`)
- Generated client output path changes — all `@prisma/client` imports must update to the new path
- `prisma generate` no longer auto-runs after `migrate dev` — must be explicit

**Files:** `package.json`, `prisma/schema.prisma`, `prisma/postgres/schema.prisma`, new `prisma.config.ts`, `src/lib/db.ts`, `src/lib/session.ts`, `src/lib/coaching.ts`, `.github/workflows/ci.yml`  
**Effort:** Medium — mechanical but touches many files

---

## Implementation order

| Priority | Item | Effort | Risk | Status |
|----------|------|--------|------|--------|
| 1 | #1 Single dev command | Trivial | None | ✅ Done |
| 2 | #2 Prisma/Postgres provider fix | Small | Low | ✅ Done |
| 3 | #4 CI pipeline | Small | None | ✅ Done |
| 4 | #5 Duplicate types | Trivial | None | — |
| 5 | #8 Pre-commit hooks | Small | None | — |
| 6 | #6 WebSocket server types | Small–Medium | Low | — |
| 7 | #7 NextAuth upgrade | Medium | Medium | — |
| 8 | #9 Prisma v6 → v7 upgrade | Medium | Low | — |
| 9 | #3 Per-session authorization | Small | Low | 🟠 Blocked on auth |
