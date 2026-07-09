## Context

`src/app/api/sessions/[id]/route.ts` has three handlers. A compliance review
(**ENG-001**) reported that `GET` and `PATCH` authenticate but do not check ownership,
calling it an IDOR. On inspection that framing does not hold for this product:

- Collaborative Gherkin is a **link-sharing editor**. `SessionView` shows a "Copy
  invite link" button and the copy "Share the link above so others can edit this
  session with you." The session page (`page.tsx`) renders for any authenticated user
  who has the link, and the document body itself syncs over an **unauthenticated** Y.js
  websocket keyed by session id.
- The session id is an unguessable `cuid`. Possession of the id is the invite — a
  capability URL. So a non-owner reading/editing a session is the *feature*, not an
  attack. "Guessing or enumerating" a cuid is not a realistic threat.

The genuine problems were: (1) the access model was never documented, so the review
misread capability-URL collaboration as an IDOR; and (2) `SessionView` never checked
`res.ok`, so a real failure was silently swallowed (initial load fell back to default
settings; saves reported success even when the write failed).

`DELETE` already fetches the row and enforces `row.userId !== authSession.user.id →
403`. That is correct and stays: deletion destroys the shared workspace for everyone,
so it is the one verb that must be owner-only.

## Goals / Non-Goals

**Goals:**
- Keep `GET` and `PATCH` open to any authenticated holder of the id (the collaboration
  feature). Do **not** add ownership gates to them.
- Keep `DELETE` owner-only (unchanged).
- Document the access-control contract for all three verbs so the "IDOR" is not
  re-reported by future reviews.
- Make `SessionView` surface genuine 404/500 failures instead of swallowing them.

**Non-Goals:**
- No change to `list`/`create`, the `Session` service API, or the DB schema.
- No collaborator ACL / join table. "Anyone with the link" is the chosen model; a
  revocable per-user ACL is a possible future feature, not part of this change.
- `llm-review` authentication (ENG-002) is a separate change.
- Page-level and Y.js websocket authorization is a separate hardening item; the
  document body is currently unauthenticated regardless of the REST contract.

## Decisions

**Decision 1 — GET and PATCH are capability-URL collaborative, not owner-gated.**
Any authenticated caller that holds the id may read (`GET`) and edit settings
(`PATCH`). Rationale: this is the product's core collaboration feature; the id is an
unguessable capability. An earlier attempt added owner-only 403s here and broke every
invited collaborator (403 on load and on any model/prompt change). Rejected. The
handlers keep only the `auth() → 401` gate and the `SessionNotFoundError → 404` path.

**Decision 2 — DELETE stays owner-only.**
Deletion is destructive and removes the shared workspace for all collaborators, so it
retains the fetch-then-compare ownership guard (`row.userId !== authSession.user.id →
403`). Ordering: `auth (401)` → `get → 404 if missing` → `ownership → 403` → `delete →
204`. Unchanged by this work; documented for completeness.

**Decision 3 — PATCH keeps its `P2025 → 404` path; it does not pre-fetch the row.**
Because PATCH no longer checks ownership, it has no reason to read the row first. It
validates the body with Zod, calls `session.update`, and maps Prisma `P2025` (row
missing) to `SessionNotFoundError → 404`. Ordering: `auth (401)` → `Zod (400)` →
`update → 404 if missing / 200 on success`.

**Decision 4 — Harden `SessionView` fetch handling (UI).**
All three `/api/sessions/[id]` fetches check `res.ok`. On load failure, show a
`form-error` banner instead of silently using defaults. On `handleModelChange` failure,
roll back the optimistic `selectedModel`. On `handleSavePrompt` failure, keep the modal
open and show the error instead of falsely reporting success. Collaborators receive 200
from GET/PATCH, so they see no error banner in normal use — the banner now means a real
404/500.

**Decision 5 — Give the e2e harness a second identity to characterise the contract.**
The regression this change reverses passed the entire Playwright suite because the
suite ran as a single user: `global-setup.ts` minted one identity and every context
(including the two-context collaboration test) reused it, so the owner-vs-collaborator
axis was unrepresentable. We add a second user (`user2.json`) in `global-setup.ts` and
a dedicated spec (`e2e/session-access-control.spec.ts`) that drives GET/PATCH/DELETE
from a genuine non-owner — at both the API layer (status contract) and the UI layer
(no error banner, changes persist). Rationale: the contract is defined by *who* may do
*what*, so the test that guards it must have a real "other user"; asserting it with the
owner alone is what let the regression through. The tests are mutation-verified —
re-applying the owner-only guard turns the non-owner GET/PATCH tests red — so they are
load-bearing, not decorative. Alternative considered: assert only at the Vitest route
layer (mocking `auth()` as a different id). Rejected as the *sole* coverage because it
would not catch the UI half of the regression (the silently-swallowed 403 banner); the
route unit tests are kept as the fast, precise contract pin and the e2e spec as the
end-to-end proof.

## Risks / Trade-offs

- **GET/PATCH remain readable/writable by anyone with the id** → Accepted and
  intended: the id is a capability URL and this is the collaboration model. Documented
  so it is not re-flagged as an IDOR.
- **The document body is unauthenticated over Y.js** → Out of scope here; the REST
  contract cannot be stricter than the websocket in any meaningful way, so tightening
  REST alone would give false assurance. Tracked as a separate hardening item.
- **Tests mock `db.session`, not a real DB (acknowledged vi.mock debt)** → Kept
  consistent with the existing file; DELETE's 403 test shape (`mockAuth(OTHER_USER_ID)`
  + `findUnique` returns a row owned by `VALID_USER_ID`) remains the owner-gate pattern.
