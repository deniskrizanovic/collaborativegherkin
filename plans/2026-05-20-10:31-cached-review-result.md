# Plan: Persist last LLM review result in browser memory

## Context

When the review modal is closed, `reviewResult` is set to `null`, destroying the result. Users want to close the modal, keep editing, then reopen the same result without triggering a new API call. The result only needs to survive within the current page load — no database or localStorage needed.

The fix requires splitting a single state variable into two: the cached result (never cleared on close) and a visibility flag (toggled independently).

**Decisions agreed in grilling session:**
- Scope: within-page-load only (no localStorage, no database)
- Trigger to reopen: new "View last review" button in session header, visible only when a cached result exists
- New review while cache exists: keep the old result until the new one lands; replace on success

## Files to change

### `src/app/sessions/[id]/SessionView.tsx`

**State changes**

Replace:
```ts
const [reviewResult, setReviewResult] = useState<string | null>(null);
```
With:
```ts
const [lastReviewResult, setLastReviewResult] = useState<string | null>(null);
const [reviewOpen, setReviewOpen] = useState(false);
```

**Escape handler** — change dependency and setter:
```ts
useEffect(() => {
  if (!reviewOpen) return;
  const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setReviewOpen(false); };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [reviewOpen]);
```

**`handleReview`** — replace the two `setReviewResult` calls:
- On success/error: `setLastReviewResult(...)` then `setReviewOpen(true)`
- Do NOT clear `lastReviewResult` on click (old result stays until new one lands)

**New "View last review" button** — add to `session-actions` div, after the existing review button, only when `lastReviewResult` is not null:
```tsx
{lastReviewResult !== null && (
  <button
    className="session-view-last-review-btn"
    onClick={() => setReviewOpen(true)}
  >
    View last review
  </button>
)}
```

**Modal render condition** — change `reviewResult !== null` to `reviewOpen && lastReviewResult !== null`:
```tsx
{reviewOpen && lastReviewResult !== null && (
  <div className="session-review-modal" onMouseDown={() => setReviewOpen(false)}>
    ...
      <ReactMarkdown>{lastReviewResult}</ReactMarkdown>
    ...
  </div>
)}
```

All three close paths (✕ button, Escape, backdrop click) call `setReviewOpen(false)` — not `setLastReviewResult(null)`.

### `spec/08-llm-review.md`

Add a new section **8.8 Cached review result** after section 8.7:

```
## 8.8 Cached review result

**Given** a review has completed and the result modal has been closed
**When** the user looks at the session header
**Then** a "View last review" button is visible

**Given** the "View last review" button is visible
**When** the user clicks it
**Then** the result modal reopens showing the same result without a new API call

**Given** no review has been run yet
**When** the user looks at the session header
**Then** the "View last review" button is not visible

**Given** a review result is cached and a new review is triggered
**When** the new review is in flight
**Then** the cached result remains available via "View last review"

**Given** a new review completes
**When** the result arrives
**Then** the cached result is replaced with the new result
```

### `e2e/llm-review.spec.ts`

**Existing tests that need updating:**

- "clicking the ✕ button closes the modal" — after close, assert `session-review-modal` is not visible (no change needed, already asserts this)
- "pressing Escape closes the modal" — same, no change needed
- "clicking outside the modal panel closes the modal" — same

**New tests to add** in a new `describe` block `"LLM review — cached result"`:

1. After closing the modal, "View last review" button appears
2. Clicking "View last review" reopens the modal with the same content
3. "View last review" button is absent before any review has been run
4. Running a new review while a cached result exists replaces the result when the new response arrives (old result visible until then)

## Verification

```bash
npm run test          # Vitest unit tests — should still pass
npx playwright test e2e/llm-review.spec.ts  # All existing + new e2e tests
```

Manual check: open a session, run a review, close the modal — "View last review" button appears. Click it — modal reopens with same content. Run a second review — modal opens with new content. Old button stays visible during in-flight request.
