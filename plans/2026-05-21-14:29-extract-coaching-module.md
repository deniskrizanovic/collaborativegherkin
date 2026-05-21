# Extract Coaching module

## Context

The LLM review feature's logic is spread across two route handlers (`llm-review/route.ts`, `llm-settings/route.ts`) and a client component (`SessionView.tsx`). Each route handler mixes validation, DB access, HTTP client calls, and error formatting — no shared seam, nothing testable without hitting the network.

This plan extracts a `Coaching` module behind a clean seam (ADR-0001: explicit dependency injection). The routes become thin adapters. `Coaching` owns the prompt lookup, the OpenRouter call, rate-limit parsing, and settings persistence. CONTEXT.md already defines the term.

---

## Files to create

### `src/lib/coaching.ts`

The `Coaching` class, typed errors, and settings interface.

```ts
interface CoachingDeps {
  appSetting: PrismaClient["appSetting"]
  fetch: typeof globalThis.fetch
  apiKey: string | undefined
}

export interface CoachingSettings {
  prompt: string
  model: string
  availableModels: readonly string[]
}

export class RateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number | null) { super("rate_limited") }
}
export class CoachingConfigError extends Error {}
export class CoachingRequestError extends Error {}

export class Coaching {
  constructor(private deps: CoachingDeps) {}
  async reviewGherkin(content: string, model: string): Promise<string>
  async getSettings(): Promise<CoachingSettings>
  async updateSettings(patch: { prompt?: string; model?: string }): Promise<void>
}
```

- `reviewGherkin`: loads prompt from `appSetting`, calls OpenRouter, parses 429 JSON into `RateLimitError`, throws `CoachingConfigError` if `apiKey` is undefined, throws `CoachingRequestError` on non-2xx
- `getSettings`: reads `llm_review_prompt` and `llm_review_model` from `appSetting`, falls back to `DEFAULT_PROMPT` / `DEFAULT_MODEL`
- `updateSettings`: upserts whichever keys are present in `patch`

### `src/lib/coaching.test.ts`

Unit tests using inline fakes — no `vi.mock`. Pattern:

```ts
const fakeAppSetting = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() }
const fakeFetch = vi.fn()
const coaching = new Coaching({ appSetting: fakeAppSetting as any, fetch: fakeFetch, apiKey: "key" })
```

Cover:

- `reviewGherkin`: success, RateLimitError with retry-after, RateLimitError without retry-after, CoachingRequestError on non-429 failure, CoachingConfigError when apiKey is undefined
- `getSettings`: returns DB values when present, falls back to defaults when keys missing
- `updateSettings`: upserts prompt only, model only, both

---

## Files to modify

### `src/app/api/llm-review/route.ts`

Construct `Coaching` from live deps, delegate, map typed errors to HTTP:

```ts
const coaching = new Coaching({
  appSetting: db.appSetting,
  fetch: globalThis.fetch,
  apiKey: process.env.OPENROUTER_API_KEY,
})

// POST handler:
// - keep existing Zod validation (content, model)
// - call coaching.reviewGherkin(content, model)
// - catch RateLimitError → 429 with retryAfterSeconds message
// - catch CoachingConfigError → 500 "LLM service not configured"
// - catch CoachingRequestError → 502 "LLM request failed"
// - catch generic → 500 "Internal server error"
```

### `src/app/api/llm-settings/route.ts`

Same construction, delegate GET and PUT:

```ts
// GET: return coaching.getSettings() directly — no manual DB code
// PUT: keep existing Zod validation, call coaching.updateSettings(patch)
```

---

## Files unchanged

- `src/app/sessions/[id]/SessionView.tsx` — still calls routes via HTTP; no change
- `e2e/llm-review.spec.ts` — tests through HTTP routes; no change
- `spec/08-llm-review.md` — behavior unchanged; internal seam is an implementation detail
- `src/lib/llm-constants.ts` — `Coaching` imports from here for defaults and model list

---

## Implementation order

1. `src/lib/coaching.ts` — module and error types
2. `src/lib/coaching.test.ts` — tests pass before touching routes
3. `src/app/api/llm-review/route.ts` — delegate, delete old logickill i
4. `src/app/api/llm-settings/route.ts` — delegate, delete old logic

---

## Verification

```bash
npm run test          # coaching.test.ts passes; existing sessions-api.test.ts still passes
npm run build         # no TypeScript errors
npm run lint          # no lint errors
npm run dev           # manual: open a session, run "Get AI Coaching", confirm result appears
npm run dev           # manual: open "Edit prompt", save a new prompt, re-run review
npm run test:all      # run end2end tests for all the thing
```
