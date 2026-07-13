## 1. Preparation

- [ ] 1.1 Create a feature branch off `main` (repo forbids editing on `main`); do not commit until asked.
- [ ] 1.2 Read `src/app/api/llm-review/route.ts`, `src/app/api/sessions/[id]/route.ts` (auth pattern), and `src/app/api/llm-review/route.test.ts` (existing coverage and mocking style).

## 2. Implementation

- [ ] 2.1 Add `import { auth } from "@/auth";` to `src/app/api/llm-review/route.ts`.
- [ ] 2.2 In `POST`, call `auth()` as the first action — before `request.json()` and the session lookup — and return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` when it returns null, mirroring the `sessions/[id]` handlers.
- [ ] 2.3 On the 401 path, emit an AI security log event via the Pino logger (e.g. `logger.warn(...)`) with no request content or secrets (AI-006).
- [ ] 2.4 Confirm no ownership check is added — any authenticated caller holding the id may run a review (ADR-0005 capability-URL model).

## 3. Tests

- [ ] 3.1 Add a unit test: unauthenticated request (`auth()` mocked to return null) → 401, and assert no session lookup and no OpenRouter fetch occur.
- [ ] 3.2 Ensure the authenticated happy path stubs `auth()` to return a session and still asserts 200 with `{ result }`.
- [ ] 3.3 Add/confirm authenticated coverage for the 404 (unknown session) and 400 (empty content) paths cited in the spec's `> **Tests:**` lines.
- [ ] 3.4 Update any existing `route.test.ts` cases that assumed no auth so they stub an authenticated session.

## 4. Verification

- [ ] 4.1 Run `npm run test` — all pass, including the new 401 case.
- [ ] 4.2 Run `npm run lint` — clean.
- [ ] 4.3 Run `npm run lint:specs` and `npm run lint:given` — spec traceability and GIVEN gates pass for the new delta.
- [ ] 4.4 Confirm ENG-002 / AI-006 is closed: unauthenticated `POST /api/llm-review` returns 401 with no LLM call; authenticated callers (owner or collaborator) are unaffected.
