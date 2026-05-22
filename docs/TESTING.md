# Testing strategy

## Overview

Tests are organised in three layers, each matching a different part of the
application and a different cost/confidence trade-off.


| Layer           | Scope                                         | Tool               | Status |
| --------------- | --------------------------------------------- | ------------------ | ------ |
| 1 — Pure logic | `src/lib/gherkin.ts`                          | Vitest             | Done   |
| 2 — API routes | `src/app/api/sessions/`                       | Vitest (mocked db) | Done   |
| 3 — Editor UI  | Browser interactions, real-time collaboration | Playwright         | Done   |

## Run all layers in sequentially

```bash
npm run test:all
```

---

## Layer 1 — Pure logic

**File:** `src/lib/gherkin.test.ts`

Covers every exported function in `gherkin.ts`:

- `canFollow()` — all transition rules from spec §2.2, including the
  empty-document case
- `NEXT_BLOCK_ON_ENTER` — all entries from the §3.2 table
- `exportToText()` — format, ordering, empty input, text preservation
- `exportToText()` data tables — pipe-delimited rows, column-width padding
- `exportToMarkdown()` data tables — header row, `| --- |` separator, data rows

Runs instantly, no infrastructure needed.

```bash
npm run test
```

---

## Layer 2 — API routes

**File:** `src/app/api/sessions/sessions-api.test.ts`

Calls route handler functions directly with `NextRequest` objects. `db` and
`logger` are mocked with `vi.mock`. Covers all scenarios from spec §4:

- `GET /api/sessions` — returns sessions, empty array, 500 on db error
- `POST /api/sessions` — 201 on valid input; 400 for empty/missing/too-long
  title and invalid CUID; 500 on db error
- `GET /api/sessions/[id]` — 200 when found, 404 when not, 500 on db error
- `DELETE /api/sessions/[id]` — 204 and correct `where` clause, 500 on db error

No test database required.

```bash
npm run test
```

---

## Layer 3 — Editor UI

**Files:** `e2e/*.spec.ts`

Covers browser-level behaviours from spec §3: block picker, toolbar, keyboard
navigation, export, visual separation, and real-time collaboration. Tests run
against the live Next.js and Y.js servers and assert on DOM state and
downloaded files.

Both servers start automatically. If they're already running, Playwright reuses them.

#### All suites

```bash
npm run test:e2e
```

```bash
npx playwright test --ui
```

#### Block picker

```bash
npx playwright test e2e/block-picker.spec.ts
```

```bash
npx playwright test e2e/block-picker.spec.ts --ui
```

#### Toolbar

```bash
npx playwright test e2e/toolbar.spec.ts
```

```bash
npx playwright test e2e/toolbar.spec.ts --ui
```

#### Enter progression

```bash
npx playwright test e2e/enter-progression.spec.ts
```

```bash
npx playwright test e2e/enter-progression.spec.ts --ui
```

#### Export

```bash
npx playwright test e2e/export.spec.ts
```

```bash
npx playwright test e2e/export.spec.ts --ui
```

#### Visual separation

```bash
npx playwright test e2e/visual-separation.spec.ts
```

```bash
npx playwright test e2e/visual-separation.spec.ts --ui
```

#### Collaboration

```bash
npx playwright test e2e/collaboration.spec.ts
```

```bash
npx playwright test e2e/collaboration.spec.ts --ui
```

#### Data table

```bash
npx playwright test e2e/data-table.spec.ts
```

```bash
npx playwright test e2e/data-table.spec.ts --ui
```

#### Import

```bash
npx playwright test e2e/import.spec.ts
```

```bash
npx playwright test e2e/import.spec.ts --ui
```

#### LLM review

```bash
npx playwright test e2e/llm-review.spec.ts
```

```bash
npx playwright test e2e/llm-review.spec.ts --ui
```

Covers spec §8: session page controls (button and model dropdown visibility),
triggering a review, Markdown rendering of results, loading state, all three
modal-dismiss gestures (✕ button, Escape, click-outside), error handling, and
prompt editing (open, save, cancel, persist). OpenRouter is never called —
all `/api/llm-review` requests are intercepted with `page.route()`.
