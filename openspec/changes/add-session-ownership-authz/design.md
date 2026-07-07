## Context

`src/app/api/sessions/[id]/route.ts` has three handlers. `DELETE` already fetches the
row and enforces `row.userId !== authSession.user.id → 403`. `GET` and `PATCH`
authenticate but skip the ownership check — the IDOR in ENG-001.

- `GET` calls `session.get(id)` (which throws `SessionNotFoundError` → 404) and returns
  the row directly. No ownership gate.
- `PATCH` validates the body with Zod, then calls `session.update(id, patch)`. It never
  fetches the row; the 404 is derived from Prisma's `P2025` surfaced as
  `SessionNotFoundError`. There is no place ownership is checked today.

The `Session` service (`src/lib/session.ts`) already exposes `get(id)` returning a
record with `userId`. Tests mock `db.session` and `auth()` directly
(`route.test.ts`), and `OTHER_USER_ID` / the 403 assertion pattern already exist for
DELETE.

## Goals / Non-Goals

**Goals:**
- `GET` and `PATCH` deny non-owners with 403, matching the DELETE pattern exactly.
- Keep the change minimal and self-consistent: one shared ownership shape across all
  three verbs.
- Add failure-path tests (403) for `GET` and `PATCH` (ENG-006).

**Non-Goals:**
- No change to `list`/`create`, the `Session` service API, or the DB schema.
- No refactor of the ownership check into shared middleware/helper (possible later;
  not required for this unit).
- `llm-review` authentication (ENG-002) is a separate change.

## Decisions

**Decision 1 — Reuse the DELETE fetch-then-compare pattern in GET and PATCH.**
Both handlers fetch the row via `session.get(id)` and compare `row.userId` to
`authSession.user.id`, returning 403 on mismatch. Rationale: identical, already-tested
logic; no new abstraction; reviewer can diff against DELETE. Alternative considered: a
`userId`-scoped query (`findUnique({ where: { id, userId } })` → treat miss as 404).
Rejected for now because it changes the service API and collapses 403 into 404, which
diverges from the DELETE behaviour the report holds up as correct.

**Decision 2 — PATCH fetches the row before updating.**
PATCH currently goes straight to `session.update`. To check ownership it must first
read the row via `session.get(id)`, which also becomes the 404 source (replacing
reliance on `update`'s `P2025→404`). Ordering: `auth (401)` → `Zod parse (400)` →
`get → 404 if missing` → `ownership → 403` → `update → 200`. The existing
`P2025→SessionNotFoundError` handling in `update` stays as a defensive fallback (e.g.
row deleted between get and update).

**Decision 3 — Preserve existing 401 → (400) → 404 → 403 → 200 ordering.**
The 404-before-403 disclosure (a missing id returns 404 even to a non-owner) matches
DELETE and is accepted as-is; changing it is out of scope.

## Risks / Trade-offs

- **Extra DB read on PATCH (get before update)** → Negligible; single indexed lookup on
  primary key, and it matches what DELETE already does.
- **404-before-403 leaks existence of an id to non-owners** → Accepted: consistent with
  the existing DELETE contract the compliance report endorses; revisiting the leak is a
  separate hardening item.
- **Tests mock `db.session`, not a real DB (acknowledged vi.mock debt)** → Follow the
  existing DELETE 403 test shape (`mockAuth(OTHER_USER_ID)` + `findUnique` returns a row
  owned by `VALID_USER_ID`) so the new tests stay consistent with the file.
