# Plan: Sync implementation with spec change — `given` allowed after `then`

**Date:** 2026-05-18  
**Spec change:** `spec/02-gherkin-document-model.md` §2.2

## Context

The spec was updated to add `given` as a valid next block after `then`. Previously, `given` could not follow `then` directly — you had to go through `and` or `but` first. The implementation, unit tests, and two E2E test comments all reflect the old rule and must be updated to match.

---

## Changes

### 1. `src/lib/gherkin.ts` — line 38
Add `"given"` to `ALLOWED_AFTER["then"]`.

```ts
// Before
then: ["and", "but", "scenario", "rule"],

// After
then: ["and", "but", "given", "scenario", "rule"],
```

### 2. `src/lib/gherkin.test.ts` — lines 94–104
Update the "after then" `canFollow` test block to include `"given"` in the allowed list (and exclude it from the rejects).

```ts
// Before
it.each(["and", "but", "scenario", "rule"] as GherkinBlockType[])(

// After
it.each(["and", "but", "given", "scenario", "rule"] as GherkinBlockType[])(
```

The complementary `GHERKIN_BLOCK_TYPES.filter(...)` reject list derives from the same array, so it is correct automatically once the allowed list is updated.

### 3. `e2e/visual-separation.spec.ts` — lines 24 and 171
Two comments are now stale. Update them:

- Line 24: `// Insert And after then, then insert Given after And (given cannot follow then directly)`  
  → `// Insert And after then, then insert Given after And`

- Line 171: `// Insert And after then, then Given after And (given cannot follow then directly)`  
  → `// Insert And after then, then Given after And`

The test logic still uses a valid sequence (Then → And → Given), so no behavior change is needed — only the incorrect comments are removed.

---

## Verification

```bash
npm run test        # unit tests — gherkin.test.ts "after then" cases must pass
npm run lint        # no regressions
```

E2E tests require both dev servers; run manually if needed:

```bash
npm run dev & npm run dev:ws &
npx playwright test e2e/visual-separation.spec.ts
```
