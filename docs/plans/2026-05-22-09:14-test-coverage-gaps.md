# Plan: Address test coverage gaps identified in test review

**Source:** `docs/2026-05-22-07:47-test-review.md`

---

## Context

The test review document mapped every acceptance criterion in `docs/spec/` against existing tests and found seven gap areas. Business logic is well-covered by unit tests but several HTTP contract paths, UI flows, and editor behaviours have no coverage at all. This plan fills five of the seven gap areas. Two are explicitly excluded (see below).

---

## Excluded from this plan

| Gap | Reason for exclusion |
|-----|----------------------|
| **§3.10 Block indentation** | Purely CSS/visual. No programmatic assertion target without a visual regression tool. A pixel-diff tool is out of scope here. |
| **§5 Data model constraints** | Title-length and CUID format are already rejected by Zod at the route layer — the API contract tests in this plan exercise those paths. DB-level constraints are low-risk and would require a real DB in tests, which adds infrastructure cost disproportionate to value. |

---

## Work items

### 1. Home page e2e — `e2e/home.spec.ts` (new file)

Covers §1.1, §1.2, §1.3 (header title), §1.4 (invite link).

Tests to write:
- Empty state: only creation form shown, no session list items
- Session list rendered after creating sessions (reverse-chronological order, timestamps, links to editor)
- Create form: empty title → submit button disabled
- Create form: title > 200 chars → validation error shown, stays on home page
- Create form: server error → error message shown, stays on home page (use `page.route()` to intercept `POST /api/sessions` and return 500)
- Create form: successful submit → redirects to `/sessions/{id}`
- Session title shown in header on the editor page
- Copy invite link: button present; clicking it changes label to "Copied!" for ~2 s

**Selector audit required:** grep `e2e/` for `.session-list`, `.session-link`, `.session-title`, `.create-form`, `.invite-link`, `.copied` and any related class names before writing. Resolve any existing assertion conflicts.

---

### 2. API HTTP contract tests (§4, §8.5–8.7)

Four new Vitest test files. Pattern: import the route handler, construct a `Request`, call the handler, assert on `response.status` and `await response.json()`. Mock the service layer (not the DB directly) following the **explicit injection preference** — pass mock service objects rather than using `vi.mock` at the module level.

#### `src/app/api/sessions/route.test.ts` (new)
- GET `/api/sessions` → 200 + array shape `[{ id, title, createdAt, userId }]`
- POST `/api/sessions` valid body → 201 + created session shape
- POST `/api/sessions` empty title → 400 + Zod error body
- POST `/api/sessions` title > 200 chars → 400
- POST `/api/sessions` missing `userId` → 400
- POST `/api/sessions` service throws → 500

#### `src/app/api/sessions/[id]/route.test.ts` (new)
- GET `/api/sessions/{id}` existing → 200 + session shape
- GET `/api/sessions/{id}` unknown id → 404
- DELETE `/api/sessions/{id}` existing → 204 No Content
- DELETE `/api/sessions/{id}` unknown id → 404
- DELETE `/api/sessions/{id}` unexpected service error → 500

#### `src/app/api/llm-settings/route.test.ts` (new)
- GET `/api/llm-settings` → 200 + `{ prompt, model, availableModels }`
- PUT `/api/llm-settings` valid body → 200
- PUT `/api/llm-settings` invalid body → 400

#### `src/app/api/llm-review/route.test.ts` (new)
- POST `/api/llm-review` valid body → 200 + `{ result }`
- POST `/api/llm-review` missing `content` → 400
- POST `/api/llm-review` service throws `CoachingConfigError` → correct error response
- POST `/api/llm-review` service throws `RateLimitError` → correct error response

**Note:** Check whether the LLM-settings and LLM-review routes exist at `src/app/api/llm-settings/route.ts` and `src/app/api/llm-review/route.ts` before writing — confirm the exact file paths and handler exports.

---

### 3. Image feature tests (§3.3, §3.4, §3.6, §3.8)

#### Augment `e2e/block-picker.spec.ts`
- Add assertion: Image is always the **final** option in the picker, regardless of which block type is active (test from at least two different contexts, e.g. after Feature and after Then)

#### Augment `e2e/toolbar.spec.ts`
- Add assertion: Image button is always present in the toolbar regardless of context

#### Augment `e2e/export.spec.ts`
- Add test: insert image block with a known src, export as TXT, verify the exported line is the base64/URL value (per `exportToText()` behaviour in `src/lib/gherkin.ts`)

#### New file: `e2e/image.spec.ts`
- Insert image via toolbar file picker (UI flow: click Image button, file input accepts a test PNG)
- Insert image via `/` → select Image from block picker
- Image displayed inline (assert `.gherkin-image` or equivalent selector is visible, has non-zero dimensions)
- Drag-and-drop image onto editor — use `page.dispatchEvent()` with a constructed `DataTransfer` carrying a `File`; mark as best-effort since OS-level file drag is not native in Playwright

**Selector audit required:** grep `e2e/` for `.gherkin-image`, image-related input selectors, and any class names used by the Image block component before writing.

---

### 4. Data table keyboard navigation (§3.11)

#### Augment `e2e/data-table.spec.ts`
- Assert cursor is in the first cell immediately after inserting a 2×2 table (currently insertion is tested but cursor position is not)
- Tab moves focus to the next cell (right); wraps to the first cell of the next row
- Shift+Tab moves focus to the previous cell
- "Table" option appears in the `/` slash-command picker when the active block is a step type

---

### 5. Import edge cases (§7.1)

First, check whether the import parser is a separately callable function (look in `src/lib/` or `src/components/`) or only reachable via the UI.

**If a pure parser function exists:** write unit tests in `src/lib/import.test.ts` (or wherever the parser lives):
- Lines not matching any keyword are skipped
- Keyword matching is case-insensitive (e.g., `GIVEN: something`)
- Colons after keywords are optional (e.g., `Given something`)

**If the parser is only accessible via UI:** add three test cases to `e2e/import.spec.ts`:
- Paste plain text with no Gherkin keywords → no blocks inserted
- Paste `GIVEN: something` → parsed as Given block
- Paste `Given something` (no colon) → parsed as Given block

---

## Critical files to read before implementing

- `src/app/api/sessions/route.ts` — handler export names, Zod schema, error handling shape
- `src/app/api/sessions/[id]/route.ts` — same
- `src/app/api/llm-settings/route.ts` — confirm exists and export names
- `src/app/api/llm-review/route.ts` — confirm exists and export names
- `src/lib/session.test.ts` — reuse the mock-factory pattern for route tests
- `src/lib/coaching.test.ts` — reuse `makeResponse()` helper pattern
- `e2e/helpers.ts` — `createSession`, `openSession`, `editorLocator` are reusable in new specs
- `src/app/page.tsx` and `src/app/HomeClient.tsx` — identify selectors used by home page elements before writing home.spec.ts
- `src/components/GherkinEditor.tsx` — identify image and invite-link selectors

---

## Verification

1. `npm run test` — all Vitest unit/component tests pass, including new API contract tests
2. `npm run test:e2e` — all Playwright tests pass, including new `home.spec.ts` and `image.spec.ts`
3. Cross-check against `docs/2026-05-22-07:47-test-review.md`: every row previously marked **None** or **Gap** in the five in-scope areas now maps to a passing test
4. The two excluded gaps (§3.10, §5) remain documented in this plan as known acknowledged omissions
