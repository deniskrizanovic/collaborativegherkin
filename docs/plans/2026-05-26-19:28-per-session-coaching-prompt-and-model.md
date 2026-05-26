# Plan: Per-Session Coaching Prompt and Model

## Context

Coaching settings (prompt and model) are currently stored globally in the `AppSetting` table, shared across all sessions. Any user editing the prompt changes it for everyone. The goal is to move prompt and model to the `Session` record so each session has its own coaching configuration. If no prompt/model is set on the session, fall back to the hardcoded `DEFAULT_PROMPT` / `DEFAULT_MODEL` constants. `AppSetting` becomes unused and is removed entirely.

Decisions reached in the grilling session:
- Two levels only: session → constant (no global AppSetting middle tier)
- Both prompt and model move to session
- Any authenticated user can edit (no owner restriction)
- `/api/llm-review` receives `sessionId`, server resolves prompt+model itself
- Route handler resolves the session; `Coaching` stays a pure OpenRouter caller
- `AVAILABLE_MODELS` imported directly in `SessionView` — not served via API

---

## Files to Change

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `prompt String?` and `model String?` to `Session` model; delete `AppSetting` model |
| `prisma/migrations/` | New migration: ALTER TABLE Session, DROP TABLE AppSetting |
| `src/lib/session.ts` | Add `prompt`/`model` to `SessionRecord`; add `update()` method |
| `src/lib/session.test.ts` | Tests for `update()` |
| `src/lib/coaching.ts` | Remove `appSetting` dep; `reviewGherkin(content, prompt, model)` takes resolved values directly; delete `getSettings()`/`updateSettings()` |
| `src/lib/coaching.test.ts` | Rewrite tests — no AppSetting mock; prompt/model passed directly |
| `src/app/api/sessions/[id]/route.ts` | Extend `GET` to return `prompt`/`model`; add `PATCH` for `{ prompt?, model? }` |
| `src/app/api/sessions/[id]/route.test.ts` | Tests for updated GET + new PATCH |
| `src/app/api/llm-review/route.ts` | Accept `{ content, sessionId }`; look up session; resolve prompt+model; call `coaching.reviewGherkin(content, prompt, model)` |
| `src/app/api/llm-review/route.test.ts` | Update mocks — remove appSetting, add session lookup, test fallback to defaults |
| `src/app/api/llm-settings/route.ts` | **Delete** |
| `src/app/api/llm-settings/route.test.ts` | **Delete** |
| `src/app/sessions/[id]/SessionView.tsx` | Load prompt+model from `GET /api/sessions/[id]` on mount; save via `PATCH /api/sessions/[id]`; import `AVAILABLE_MODELS` from `@/lib/llm-constants`; send `sessionId` to `/api/llm-review` |
| `docs/CONTEXT.md` | No change needed — Coaching term already correct |

---

## Implementation Steps

### 1. Schema + migration

In `prisma/schema.prisma`:
- Add to `Session`: `prompt String?` and `model String?`
- Delete `AppSetting` model entirely

Run `npx prisma migrate dev --name per-session-coaching` — this generates the migration automatically.

### 2. `src/lib/session.ts`

- Extend `SessionRecord` interface: `prompt: string | null`, `model: string | null`
- Fix `get()` select to include `prompt` and `model`
- Add `update(id, patch: { prompt?: string; model?: string })` method using `prisma.session.update()`; re-throw `SessionNotFoundError` on P2025

### 3. `src/lib/coaching.ts`

- Remove `appSetting` from `CoachingDeps`
- Change signature: `reviewGherkin(content: string, prompt: string, model: string)`
- Remove `getSettings()` and `updateSettings()` entirely
- `reviewGherkin` uses the passed-in `prompt` directly (no DB read)

### 4. `src/app/api/sessions/[id]/route.ts`

- `GET`: Change the `session.get()` call to return `prompt` and `model` in the response (they come through automatically once `SessionRecord` includes them)
- Add `PATCH` handler:
  ```
  Auth check → parse body with Zod ({ prompt: z.string().min(10).optional(), model: z.enum(AVAILABLE_MODELS).optional() }) → session.update(id, patch) → 200 { ok: true }
  ```
  Returns 401 (no auth), 400 (invalid body), 404 (not found), 500 (unexpected).
  No ownership check — any authenticated user can update.

### 5. `src/app/api/llm-review/route.ts`

- Change `PostSchema`: replace `model: z.enum(AVAILABLE_MODELS)` with `sessionId: z.string()`; keep `content`
- Look up session: `await session.get(sessionId)` — 404 if not found
- Resolve: `prompt = session.prompt ?? DEFAULT_PROMPT`, `model = session.model ?? DEFAULT_MODEL`
- Validate model is still in AVAILABLE_MODELS (defensive — reject with 400 if stored value is stale)
- Construct `Coaching` without `appSetting`; call `coaching.reviewGherkin(content, prompt, model)`

### 6. `src/app/sessions/[id]/SessionView.tsx`

- Remove `fetch("/api/llm-settings")` calls everywhere
- On mount: `fetch("/api/sessions/${sessionId}")` → seed `selectedModel` (fallback `DEFAULT_MODEL`) and `promptText` (fallback `DEFAULT_PROMPT`)
- Import `AVAILABLE_MODELS` and `DEFAULT_MODEL`, `DEFAULT_PROMPT` from `@/lib/llm-constants`
- `handleModelChange`: call `PATCH /api/sessions/${sessionId}` with `{ model }`
- `handleSavePrompt`: call `PATCH /api/sessions/${sessionId}` with `{ prompt: promptText }`
- `handleReview`: send `{ content, sessionId }` instead of `{ content, model }`

### 7. Delete files

- `src/app/api/llm-settings/route.ts`
- `src/app/api/llm-settings/route.test.ts`

---

### 8. E2E tests (`e2e/llm-review.spec.ts`)

All existing selectors remain unchanged — no selector edits needed:
- `.session-edit-prompt-btn`, `.session-prompt-modal`, `.session-prompt-textarea`, `.session-prompt-save`, `.session-prompt-cancel`
- `.session-model-select`, `.session-review-btn`, `.session-review-modal`, `.session-review-modal-body`, `.session-review-modal-close`

The `/api/llm-review` intercept in `interceptReview()` still targets the same URL — no change needed there.

The one affected behaviour is model dropdown pre-selection (SC-8.3.1): it currently assumes `/api/llm-settings` loads the model. After this change the model comes from `GET /api/sessions/[id]`. Because `openSession()` navigates to the session page and the UI falls back to `DEFAULT_MODEL` when the session has no stored model, the dropdown will still be pre-selected. No test edits required — run the suite to confirm all specs still pass after the implementation.

---

## Verification

```bash
npx prisma migrate dev --name per-session-coaching   # migration runs clean
npm run test                                          # all unit tests pass
npm run build                                         # no TypeScript errors
npx playwright test                                   # all e2e tests pass
npm run dev && npm run dev:ws                         # manual: open session, edit prompt, reload — prompt persists; default loads when null
```
