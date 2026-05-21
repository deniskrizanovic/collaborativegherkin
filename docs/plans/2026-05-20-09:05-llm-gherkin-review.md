# Plan: LLM Gherkin Review Feature

## Context

Users want to get AI critique and improvement suggestions for the Gherkin scenarios they're editing. A button on the session page will send the current session content to an LLM via the OpenRouter gateway, using a free model chosen from a dropdown. The system prompt is stored in the database so it can be shared across users and updated without a redeploy. The selected model is also persisted to the database. Results are displayed in a Markdown-rendered modal — one result at a time from the selected model.

---

## Decisions made

| Decision | Choice |
|---|---|
| LLM job | Critique Gherkin and suggest improvements |
| Prompt storage | Database (shared, persistent) |
| Model storage | Database (shared, persistent) — key `llm_review_model` in `AppSetting` |
| Prompt editing UI | Inline on session page — "Edit prompt" button near the LLM button opens a modal |
| Model selection UI | Dropdown next to the "Review with AI" button; persisted to DB on change |
| Results display | Markdown-rendered in a modal (one result per review, from the selected model) |
| Button placement | `SessionView.tsx` (session-level action, alongside "Copy invite link") |
| Content extraction | `useImperativeHandle` ref on `GherkinEditor` exposes `getContent()` |
| LLM gateway | OpenRouter (free models only) |

---

## Critical files

- `src/app/sessions/[id]/SessionView.tsx` — add buttons, dropdown, and wire up ref
- `src/components/GherkinEditor.tsx` — expose `getContent()` via `useImperativeHandle`
- `src/app/api/llm-settings/route.ts` — **new** API route: GET and PUT for prompt + model settings
- `src/app/api/llm-review/route.ts` — **new** API route: fetches prompt from DB, calls OpenRouter with selected model, returns result
- `prisma/schema.prisma` — add `AppSetting` model for key/value settings storage
- `prisma/migrations/` — new migration for `AppSetting` table

---

## Implementation steps

### 1. Database: add `AppSetting` model

Add to `prisma/schema.prisma`:

```prisma
model AppSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

Run `npx prisma migrate dev --name add-app-setting`.

Seed two default settings:
- `llm_review_prompt` — `"You are an expert in Behaviour-Driven Development. Review the following Gherkin scenarios and suggest concrete improvements. Focus on: clarity of steps, missing edge cases, ambiguous language, and structural issues. Format your response in Markdown."`
- `llm_review_model` — `"meta-llama/llama-3.2-3b-instruct:free"`

### 2. API route: settings CRUD (`/api/llm-settings`)

`src/app/api/llm-settings/route.ts`
- `GET` — read both `llm_review_prompt` and `llm_review_model` from `AppSetting`, return `{ prompt: string, model: string, availableModels: string[] }`; missing keys fall back to defaults
- `PUT` — accepts `{ prompt?: string, model?: string }`, validates with Zod, upserts whichever keys are present

The `availableModels` list is a hard-coded constant in the route (not in DB):
```ts
const AVAILABLE_MODELS = [
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-3-4b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen3-8b:free",
]
```

Use the Pino logger. Wrap DB calls in try/catch.

### 3. API route: LLM review (`/api/llm-review`)

`src/app/api/llm-review/route.ts`
- `POST` — accepts `{ content: string, model: string }` (the exported Gherkin text + selected model)
- Fetches the prompt from DB (`llm_review_prompt`)
- Validates `model` is in `AVAILABLE_MODELS` (imported from a shared constant)
- Calls OpenRouter API: `https://openrouter.ai/api/v1/chat/completions`
  - Model: the `model` from the request body
  - Messages: `[{ role: "system", content: <prompt> }, { role: "user", content: <gherkin content> }]`
  - Auth header: `Authorization: Bearer ${process.env.OPENROUTER_API_KEY}`
- Returns `{ result: string }` (the LLM's message content)
- Use Pino logger. Wrap fetch in try/catch. Return 500 on failure.

`OPENROUTER_API_KEY` goes in `.env.local` and `.env.example`.

### 4. `GherkinEditor.tsx`: expose `getContent()` via ref

- Convert component to use `forwardRef` and `useImperativeHandle`
- Expose `getContent(): string` — reuses `getAllBlocks()` + existing text serialisation logic, but returns the string instead of downloading it
- Export a `GherkinEditorHandle` type for use in `SessionView`

### 5. `SessionView.tsx`: wire up buttons, dropdown, and modals

Add session-level actions next to "Copy invite link":

**"Edit prompt" button** (`.session-edit-prompt-btn`):
- Opens a prompt-edit modal (`.session-prompt-modal` / `.session-prompt-modal-inner`)
- Modal contains: a `<textarea>` pre-filled from `GET /api/llm-settings`, Save and Cancel buttons
- On Save: `PUT /api/llm-settings` with `{ prompt }`, close modal

**Model dropdown** (`.session-model-select`):
- Rendered as a `<select>` immediately before the "Review with AI" button
- Options populated from `availableModels` returned by `GET /api/llm-settings`
- Selected value initialised from the `model` setting; on change, fires `PUT /api/llm-settings` with `{ model }`

**"Review with AI" button** (`.session-review-btn`):
- On click: calls `editorRef.current.getContent()`, POSTs to `/api/llm-review` with `{ content, model }` (current dropdown value)
- While waiting: button and dropdown show a loading/disabled state
- On response: opens results modal

**Results modal** (`.session-review-modal` / `.session-review-modal-inner`):
- Renders the LLM Markdown response using `react-markdown` (add if not already installed)
- Close button + Escape to dismiss + click-outside to dismiss

Modal CSS follows the existing import modal pattern (fixed overlay, `rgba(0,0,0,0.5)` background, centred inner box, `min(640px, 90vw)`).

---

## E2E selector audit

New selectors introduced — none conflict with existing specs:
- `.session-review-btn` — not present anywhere in `e2e/`
- `.session-edit-prompt-btn` — not present anywhere in `e2e/`
- `.session-model-select` — not present anywhere in `e2e/`
- `.session-review-modal` — not present anywhere in `e2e/`
- `.session-prompt-modal` — not present anywhere in `e2e/`

Existing `.gherkin-toolbar-btn` tests are unaffected (editor-internal toolbar, separate DOM subtree).

---

## Verification

1. `npx prisma migrate dev` runs clean, `AppSetting` table exists in Prisma Studio
2. `GET /api/llm-settings` returns default prompt and model on a fresh DB
3. `PUT /api/llm-settings` with a new model → subsequent GET returns updated value
4. Add `OPENROUTER_API_KEY` to `.env.local`, start `npm run dev` + `npm run dev:ws`
5. Open a session, add some Gherkin scenarios
6. Select a model from the dropdown — selection persists on page reload
7. Click "Review with AI" → loading state shows → modal opens with Markdown critique from the selected model
8. Switch model in dropdown, re-review — different model's output appears
9. Click "Edit prompt" → modal opens with current prompt → edit and save → re-review reflects new prompt
10. Run `npm run test` — all Vitest unit tests pass
11. Run `npx playwright test` — all existing e2e specs pass (no regressions)
