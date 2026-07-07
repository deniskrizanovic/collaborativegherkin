## 1. GET ownership guard (ENG-001)

- [ ] 1.1 In `src/app/api/sessions/[id]/route.ts` GET, after `session.get(id)` returns the row, add `if (found.userId !== authSession.user.id) return 403` before returning the body — mirroring the DELETE pattern.
- [ ] 1.2 Confirm ordering holds: 401 (unauth) → 404 (SessionNotFoundError) → 403 (non-owner) → 200 (owner).

## 2. PATCH ownership guard (ENG-001)

- [ ] 2.1 In PATCH, after Zod validation succeeds, fetch the row with `session.get(id)` (throws `SessionNotFoundError` → 404) before updating.
- [ ] 2.2 Add `if (row.userId !== authSession.user.id) return 403` before calling `session.update(id, parsed.data)`.
- [ ] 2.3 Keep the existing `P2025 → SessionNotFoundError → 404` handling as a defensive fallback for a row deleted between get and update.
- [ ] 2.4 Confirm ordering: 401 → 400 (invalid body) → 404 (missing) → 403 (non-owner) → 200 (owner).

## 3. Failure-path tests (ENG-006 / TEST-001)

- [ ] 3.1 In `src/app/api/sessions/[id]/route.test.ts`, add a GET test: `mockAuth(OTHER_USER_ID)`, `findUnique` returns `baseRow` (owned by `VALID_USER_ID`), assert 403.
- [ ] 3.2 Add a PATCH test: `mockAuth(OTHER_USER_ID)`, `findUnique` returns `baseRow`, send a valid body, assert 403 and that `update` was not called.
- [ ] 3.3 Verify existing GET/PATCH owner (200) and 404 tests still pass with the added `findUnique` fetch in PATCH (update the PATCH 200 and 404 tests to mock `findUnique` as needed).

## 4. Verify

- [ ] 4.1 Run `npm run test -- src/app/api/sessions/\[id\]/route.test.ts` — all GET/PATCH/DELETE cases green.
- [ ] 4.2 Run `npm run lint` and typecheck; report any rejection rather than working around it.
