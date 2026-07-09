# Session access control: capability-URL collaboration, owner-only delete

**Status:** Accepted
**Date:** 2026-07-09
**Relates to:** [0003 — Authentication model](0003-auth-model-magic-link-jwt-resend.md) (reaffirms its ownership decision)

## Context

ADR-0003 already established the access model: *any authenticated user may view and
edit any session; ownership gates only the home-page listing and delete.* This ADR
does not change that decision — it records **why it is safe**, because that rationale
was challenged and the challenge will recur.

A compliance/security review flagged `GET` and `PATCH` on `/api/sessions/[id]` as an
IDOR (finding **ENG-001**): the handlers authenticate the caller but do not check that
the caller owns the session, so "any signed-in user can read or modify any other
user's session by guessing or enumerating its id." A first attempt to resolve the
finding added owner-only `403` guards to `GET` and `PATCH`.

That fix broke the product. Collaborative Gherkin is a link-sharing editor:
`SessionView` renders a "Copy invite link" button under the copy *"Share the link
above so others can edit this session with you."* With owner-only guards, every invited
collaborator received `403` on load (settings read as defaults) and on every model or
prompt change. The guard enforced the opposite of the intended feature and contradicted
the standing decision in ADR-0003.

The review's "guess or enumerate the id" premise does not hold here: a session id is an
unguessable `cuid`. Possession of the id is therefore equivalent to holding the invite
link — a **capability URL**. Someone who has the id was, by construction, given access.

## Decision

Reaffirm ADR-0003 and make the per-verb contract explicit:

- **`GET /api/sessions/[id]` — open to any authenticated holder of the id.** No
  ownership gate. Contract: unauthenticated → 401; id not found → 404; otherwise → 200.
- **`PATCH /api/sessions/[id]` — open to any authenticated holder of the id.** No
  ownership gate. Contract: 401; invalid body → 400; id not found → 404; otherwise →
  200.
- **`DELETE /api/sessions/[id]` — owner-only.** Deletion destroys the shared workspace
  for every collaborator, so it is the one verb gated on ownership. Contract: 401; id
  not found → 404; authenticated non-owner → 403; owner → 204.

The session id is treated as a capability. Authorization to read and edit a session is
"you are signed in **and** you hold the id." ENG-001 is resolved as **not a defect**:
open read/write is the intended collaboration model, not an insecure direct object
reference.

## Reasons

**Capability URL, not an IDOR.**
The threat ENG-001 describes — enumerating ids — is not feasible against a `cuid`.
Knowing the id means the id was shared with you, which is exactly how the "Copy invite
link" feature is meant to grant access. Gating on ownership would break link-sharing,
the core use case, to defend against a threat the id space already prevents.

**Consistency with ADR-0003.**
0003 decided sessions are "collaborative workspaces, not private documents" and that
"restricting edit to the owner would break the core use case." Owner-only `GET`/`PATCH`
directly contradicted an Accepted ADR. This record restores conformance and documents
the security reasoning 0003 left implicit, so the same finding is not re-raised.

**Delete is the exception because it is irreversible.**
Ownership matters for the one destructive, non-collaborative action. A collaborator
should not be able to wipe a shared session. This mirrors 0003's "ownership matters for
housekeeping, not access."

## Consequences

- `GET` and `PATCH` in `src/app/api/sessions/[id]/route.ts` keep only the `auth() → 401`
  gate (plus `400` validation on `PATCH` and `404` for a missing id). No `403` path.
- `DELETE` retains its fetch-then-compare ownership guard (`403` for non-owners).
- The OpenSpec change `add-session-ownership-authz` and its `session-access-control`
  spec document this contract as the source of truth for future reviews.
- **Residual exposure (out of scope, tracked separately):** the REST endpoints are not
  the real security boundary. The Gherkin document body syncs over an *unauthenticated*
  Y.js websocket (`y-websocket-server.mjs`, room keyed by session id), and the session
  page renders for any authenticated user with the link. Tightening REST alone would
  give false assurance. Page-level and websocket authorization is a separate hardening
  item, as is the unauthenticated `llm-review` endpoint (ENG-002).
- If a future requirement calls for revocable, per-user access (the Google-Docs model
  0003 named as a future feature), it supersedes this ADR and needs a collaborator ACL
  — not a return to owner-only, which would break sharing.
