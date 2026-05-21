# Plan: Deepen the Session module

## Context

The three session route handlers (`GET /api/sessions`, `POST /api/sessions`, `GET|DELETE /api/sessions/[id]`) each directly construct Prisma queries. DB coupling leaks into every handler, the Zod schema lives inline in the route, and there is no reusable session logic — it all goes through HTTP. There is also a latent bug: `DELETE /api/sessions/[id]` returns 500 instead of 404 when the session does not exist, because Prisma's P2025 error is not caught.

This follows the same pattern used for the Coaching module (commit `96afdc3`): extract a class behind a dependency-injection seam, make route handlers thin HTTP adapters, replace `vi.mock` in tests with injected fakes.

---

## Decisions (agreed during grilling)

1. **Route owns Zod parse; module receives clean types** — `userId` CUID validation stays in the route (it's a placeholder until auth lands).
2. **Scaffold seeding is out of scope** — already correctly placed in `GherkinEditor.tsx` (Y.js layer).
3. **Tests migrate wholesale** — `sessions-api.test.ts` becomes `src/lib/session.test.ts` with injected fakes; route handlers need no dedicated tests.
4. **Class with deps object** — `new Session({ session: prismaClient.session })`, matching `Coaching`.
5. **`SessionNotFoundError`** — module throws this on `get(id)` when `findUnique` returns null, and on `delete(id)` when Prisma throws P2025. Routes catch it and return 404. Fixes the latent DELETE bug.
6. **No logger in module** — routes log before returning 500, same as today. Module only throws.

---

## Files to create

### `src/lib/session.ts`
```
Session class
  deps: { session: PrismaClient["session"] }
  list(): Promise<SessionSummary[]>
  create(input: { title: string; userId: string }): Promise<SessionRecord>
  get(id: string): Promise<SessionRecord>          // throws SessionNotFoundError if null
  delete(id: string): Promise<void>               // throws SessionNotFoundError on P2025

SessionNotFoundError extends Error
SessionSummary type  { id, title, createdAt, userId }
SessionRecord type   { id, title, createdAt, userId }
```

### `src/lib/session.test.ts`
New test file — replaces `sessions-api.test.ts`.
Uses `fakeSessionTable = { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() }` injected directly. No `vi.mock`. Covers all existing cases plus two new ones:
- `get` throws `SessionNotFoundError` when `findUnique` returns null
- `delete` throws `SessionNotFoundError` when Prisma throws P2025 (`{ code: 'P2025' }`)

---

## Files to modify

### `src/app/api/sessions/route.ts`
- Import `Session` and instantiate with `db.session`
- `GET`: delegate to `session.list()`, keep error → 500
- `POST`: keep Zod schema and parse; on success delegate to `session.create(parsed.data)`; keep error → 500

### `src/app/api/sessions/[id]/route.ts`
- Import `Session`, `SessionNotFoundError`
- `GET`: delegate to `session.get(id)`; catch `SessionNotFoundError` → 404; catch other → 500
- `DELETE`: delegate to `session.delete(id)`; catch `SessionNotFoundError` → 404; catch other → 500

### `src/app/api/sessions/sessions-api.test.ts`
- Delete this file (tests migrate to `src/lib/session.test.ts`)

---

## Verification

```bash
npm run test                  # session.test.ts passes, no regressions
npm run build                 # TypeScript compiles clean
npm run dev + npm run dev:ws  # smoke test: create session navigates to editor
```

E2e contracts preserved: `POST /api/sessions` still returns `{ id, title, createdAt, userId }` with status 201. All existing e2e specs pass unchanged.
