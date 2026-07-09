## 1. GET stays open to any authenticated holder of the id

- [x] 1.1 In `src/app/api/sessions/[id]/route.ts` GET, keep only the `auth() → 401` gate and return `session.get(id)` (which throws `SessionNotFoundError → 404`). Do **not** add an ownership check — non-owner read is the collaboration feature.
- [x] 1.2 Confirm ordering: 401 (unauth) → 404 (not found) → 200 (any authenticated holder).

## 2. PATCH stays open to any authenticated holder of the id

- [x] 2.1 In PATCH, keep only the `auth() → 401` gate and Zod validation (`→ 400`); do **not** fetch the row for an ownership check.
- [x] 2.2 Keep the `session.update` → `P2025 → SessionNotFoundError → 404` path as the not-found source.
- [x] 2.3 Confirm ordering: 401 → 400 (invalid body) → 404 (missing) → 200 (any authenticated holder).

## 3. DELETE stays owner-only (unchanged, documented)

- [x] 3.1 Confirm DELETE keeps the fetch-then-compare guard: `session.get(id)` (→ 404) then `row.userId !== authSession.user.id → 403`, then `session.delete → 204`.
- [x] 3.2 Confirm ordering: 401 → 404 (missing) → 403 (non-owner) → 204 (owner).

## 4. UI: surface real failures in SessionView

- [x] 4.1 In `src/app/sessions/[id]/SessionView.tsx`, check `res.ok` on the load fetch; on failure set a `form-error` message instead of falling back to defaults silently.
- [x] 4.2 In `handleModelChange`, capture the previous model, apply optimistically, and roll back + show `form-error` if `!res.ok`.
- [x] 4.3 In `handleSavePrompt`, keep the modal open and show `form-error` if `!res.ok`; only close on success.

## 5. Unit tests

- [x] 5.1 GET: 401 (unauth), 200 (authenticated caller, incl. `prompt`/`model`), 404 (missing). No 403 case — GET is not owner-gated.
- [x] 5.2 PATCH: 401, 200 (model), 200 (prompt), 400 (short prompt), 400 (invalid model), 404 (missing via P2025). No 403 case — PATCH is not owner-gated.
- [x] 5.3 DELETE: 401, 403 (non-owner), 204 (owner), 404 (missing), 500 (service error).

## 6. E2E characterisation tests (second identity)

- [x] 6.1 In `e2e/global-setup.ts`, mint a **second** distinct user and write `e2e/.auth/user2.json` alongside `user.json`, so tests can exercise the owner-vs-collaborator axis. (The suite previously ran as one user and could never trip a non-owner path.)
- [x] 6.2 Add `e2e/session-access-control.spec.ts` — API layer: non-owner GET → 200, non-owner PATCH → 200, non-owner DELETE → 403 (owner can still read afterwards).
- [x] 6.3 Same spec — collaborator UX layer: a second user opens the shared link (no `form-error` banner, settings load), changes the model (PATCH 200, persists across reload), and saves a prompt (200, modal closes, no banner).
- [x] 6.4 Mutation-verify the spec is load-bearing: temporarily re-apply the owner-only guard to GET/PATCH and confirm the non-owner tests go red (5/6 failed, DELETE test stayed green), then restore.

## 7. Verify

- [x] 7.1 Run `npm run test -- src/app/api/sessions/\[id\]/route.test.ts` — all GET/PATCH/DELETE cases green (14 passing).
- [x] 7.2 Run the full `npm run test` (201 passing), `npm run test:e2e` (102 passing, 1 pre-existing skip), `npm run lint`, and typecheck — all clean.
