## Context

`POST /api/llm-review` is the only session-touching API route without an
`auth()` gate. `src/app/api/sessions/[id]/route.ts` calls `auth()` at the top of
`GET`, `PATCH`, and `DELETE`; `llm-review` skips it and immediately parses the
body, loads the session by id, and forwards content to OpenRouter. This is
finding ENG-002 / AI-006 (High, Block) and step 3 of the remediation roadmap.

ADR-0005 fixed the access model for the sibling routes: a session id is an
unguessable `cuid` acting as a capability URL, so `GET`/`PATCH` are open to any
authenticated holder of the id and only `DELETE` is owner-gated. `llm-review`
reads the same per-session settings and must inherit the same contract.

## Goals / Non-Goals

**Goals:**
- Reject unauthenticated `POST /api/llm-review` requests with 401 before any
  session lookup or OpenRouter call.
- Preserve the existing behaviour and status contract for authenticated callers
  (200 / 404 / 400 / 500 / 502).
- Emit an observable AI security log event on rejection (AI-006), with no
  request content or secrets.
- Add unit coverage for the 401 path and confirm the authenticated contract is
  unchanged.

**Non-Goals:**
- Ownership gating on `llm-review` — explicitly excluded by ADR-0005; invited
  collaborators must still be able to run coaching.
- Y.js WebSocket authentication (ENG-005), prompt-injection input filtering
  (AI-005 / ENG-010), rate limiting, or model supply-chain work (AI-002/003).
  These are separate roadmap items.
- Any change to the request/response shape for authenticated callers.

## Decisions

- **Gate with the existing `auth()` helper, mirroring `sessions/[id]`.** Import
  `{ auth }` from `@/auth` and call it as the first statement in `POST`, before
  `request.json()`. Return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`
  on a null session — byte-identical to the sibling routes for consistency.
  Alternative considered: enforcing auth in `middleware`/proxy only. Rejected —
  the codebase gates each route handler explicitly, and defence-in-depth at the
  handler is the established pattern; the spec and tests pin the handler contract.
- **Order the 401 check before body parsing and the session lookup.** This
  prevents an anonymous caller from probing session existence (404 vs other) or
  reaching the paid LLM provider. Alternative (parse first, then auth) leaks a
  timing/existence signal and wastes work — rejected.
- **No ownership check.** Consistent with ADR-0005; `llm-review` operates on the
  same capability-URL session. Adding an owner guard would break invited
  collaborators running coaching — the exact regression ADR-0005 documents.
- **Log the rejection through the Pino logger** (`logger.warn`), no content or
  secrets, satisfying AI-006's centralised-security-event obligation without a
  new logging subsystem. Alternative (silent 401) leaves AI security events
  unobservable — rejected.

## Risks / Trade-offs

- **A logged-in non-collaborator could still call the endpoint if they obtain a
  session id** → Accepted and intended: possession of the `cuid` is the
  capability (ADR-0005). Ownership gating is explicitly out of scope.
- **Existing tests may assume no auth** → Mitigation: audit
  `route.test.ts`; add/adjust mocks so the authenticated happy path stubs
  `auth()` to return a session, and add a dedicated unauthenticated (`auth()` →
  null) case asserting no session lookup and no OpenRouter fetch occur.
- **Client callers must be authenticated** → No risk in practice: the entire app
  is behind the auth gate (middleware) and the only caller is the signed-in
  session page.

## Migration Plan

1. Implement on a feature branch (repo forbids editing on `main`).
2. Add the `auth()` gate and logging; update/extend `route.test.ts`.
3. Run `npm run test` and `npm run lint`; verify the 401 path and unchanged
   authenticated contract.
4. Rollback is trivial: the change is additive to one handler and one test file;
   reverting the commit restores prior behaviour with no data or schema impact.
