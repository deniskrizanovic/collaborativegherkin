# Collaborative Gherkin (Denis) - Compliance Remediation Plan

Date: 2026-06-26
Reviewer: AppGenie standards review (automated, human review required before use as evidence)
Source state: working tree is WIPED; all findings taken from git HEAD. Restore the tree before remediating.

## 1. Overlay reference (control bundle)

Per `standards/compliance-profiles/README.md`, a profile only ADDS obligations on top of the baseline and the control bundle is: base standards + applicable profile(s) + supporting standards + framework control mapping + unresolved gaps. The bundle applied here:

| Profile | Type | Inherits | Why it applies |
|---|---|---|---|
| `baseline-commercial` | floor | - | Default floor for all delivery; requires artefact identity, versioning, traceability, evidence collection, register linkage, change control. |
| `ai-controlled` | assurance_overlay | baseline-commercial | The app ships a third-party LLM "coaching" feature that generates and refines acceptance criteria (delivery-support AI). |
| `au-privacy` | assurance_overlay | baseline-commercial, iso-27701 | App stores user emails and session content in a NSW social-housing maintenance domain (personal information, Privacy Act 1988 / APPs). |
| `essential-eight` | assurance_overlay | baseline-commercial | Internet-facing web application; ACSC Essential Eight relevant (MFA, patching, backups). |

Framework controls in scope: ISO/IEC 42001:2023 {4.1, 5.2, 6.1, 8.4, 9.1, 10.2}; NIST AI RMF 1.0 {GOVERN 1/2/4, MAP 1/2/5, MEASURE 1/2/4, MANAGE 1/2/4}; Australian Privacy Act 1988 {APP 1-13, NDB}; ISO/IEC 27701; ACSC Essential Eight {E8.2, E8.4, E8.5, E8.7, E8.8}; plus baseline ISO 27001/27002 and NIST 800-53 mappings inherited from the engineering controls.

### Caveat on authority
The AppGenie Compliance MCP server is NOT connected in this session, so this is NOT the authoritative customer-scoped control bundle. The overlay was reconstructed from the standards repo. The applicability of `au-privacy` and `essential-eight` is inferred from the NSW social-housing/AU context and must be confirmed via `query_appgenie_compliance` or the engagement contract. The AI-governance standards and the commit standard are `customer_safe: false` (visibility: internal); cite them as internal evidence only, not in a customer-facing pack. Access-control obligations are cited from STD-ENTERPRISE-ACCESS-CONTROL because `std-security-access-control.md` is Superseded.

### Legend
- Severity: H (high), M (medium), L (low).
- Enforcement (where the profile defines one): Block = must not deploy/proceed; Flag = escalate before release.
- "Baseline" = engineering control non-compliance; "Profile gap" = obligation added by an overlay and not satisfied by general engineering evidence (ai-controlled profile lines 144-148).

---

## 2. Baseline engineering defects (code)

### A. Authorisation and access control

| ID | Finding | File / location | Standard | Sev | Action |
|---|---|---|---|---|---|
| ENG-001 | IDOR: `GET` and `PATCH` check authentication (401) but not ownership; any signed-in user can read or modify any session by id. Only `DELETE` enforces `row.userId !== user.id`. ✅ **Resolved — see §2.A.1.** | `src/app/api/sessions/[id]/route.ts` (GET, PATCH) | STD-ENTERPRISE-ACCESS-CONTROL 3.4 (deny by default, object-level), 3.1 (least privilege); ENG-CTRL-08 6.1 | H | Block |
| ENG-002 | `llm-review` has no `auth()` call and no ownership check; it loads any session's stored prompt by id. ✅ **Resolved — see §2.A.2.** | `src/app/api/llm-review/route.ts` | STD-ENTERPRISE-ACCESS-CONTROL 3.4; STD-AI-SYSTEM-SECURITY 4.1 (AI inference endpoints MUST be authenticated) | H | Block |
| ENG-003 | Test-only `CredentialsProvider` bypass is compiled into every build, gated only by presence of `process.env.TEST_AUTH_SECRET`. ✅ **Resolved — see §2.A.3.** | `src/auth.ts` | STD-ENTERPRISE-ACCESS-CONTROL 3.3/3.4; ENG-CTRL-08 6.1/6.3 | H | Block |
| ENG-004 | `signin/page.tsx` passes `process.env.TEST_AUTH_SECRET` into the client `SignInForm` as `testAuthSecret`. If ever set in production the bypass button renders and the secret ships in client HTML. ✅ **Resolved — see §2.A.3.** | `src/app/auth/signin/page.tsx` | STD-AI-SYSTEM-SECURITY 4.2 (secrets MUST NOT be in client-side code); ENG-CTRL-08 6.1 | H | Block |
| ENG-005 | Y.js WebSocket server has no authentication, no origin check, and no authorisation. Room name is taken from the raw request URL, so any client can join `session-<id>` for any session and read/write the live document, bypassing the Next.js auth gate entirely. ✅ **Resolved — see §2.A.4.** | `y-websocket-server.mjs` | STD-ENTERPRISE-ACCESS-CONTROL 3.4; STD-AI-SYSTEM-SECURITY 4.1; APP 11 (security of personal information) | H | Block |
| ENG-006 | Ownership is tested only for `DELETE` (route test ~line 191). The IDOR `GET`/`PATCH` paths have no 403 test, which is why ENG-001 slipped through. ✅ **Resolved — see §2.A.1.** | `src/app/api/sessions/[id]/route.test.ts`, `e2e/session-access-control.spec.ts` | ENG-CTRL-04 3.2 (must test failure paths), 3.6 (traceable to AC) | H | Flag |

Note (compliant, keep): session `list` is scoped by `where: { userId }` and `create` injects `userId` - correct.

#### A.1 Resolutions (2026-07-09)

Refs: [#22](https://github.com/deniskrizanovic/collaborativegherkin/issues/22) · [ADR-0005](../adr/0005-session-access-control-capability-url.md) · [ADR-0003](../adr/0003-auth-model-magic-link-jwt-resend.md)

| ID | Original finding | Disposition | Resolution |
|---|---|---|---|
| ENG-001 | IDOR: `GET`/`PATCH` authenticate but don't check ownership; any signed-in user can read/modify any session by id. | ✅ **Not a defect** | The "guess or enumerate the id" premise fails against an unguessable `cuid`: the id is a **capability URL** (invite link), so open read/edit is the intended collaboration feature (reaffirms ADR-0003). Owner-only guards were added (`b40d4d2`) then **reverted** (`659f8e0`) because they broke link-sharing (collaborators got 403 on load and on every settings change). `DELETE` stays owner-only. Documented in ADR-0005. ⚠️ This narrows the REST surface only — the unauthenticated Y.js WebSocket (ENG-005) is the real boundary and is **still open**. |
| ENG-006 | Ownership tested only for `DELETE`; no 403 test on `GET`/`PATCH`, which is why ENG-001 slipped through. | ✅ **Fixed** | Root cause was that the whole e2e suite ran as a **single user**, so no non-owner path was ever exercised. Added a second identity (`e2e/global-setup.ts`) and multi-user characterisation tests (`e2e/session-access-control.spec.ts`) pinning the access contract at API and UX layers. Mutation-verified load-bearing: re-applying the owner-only guard turns 5/6 tests red (DELETE correctly stays green). |

#### A.2 Resolutions (2026-07-13)

Refs: [#27](https://github.com/deniskrizanovic/collaborativegherkin/issues/27) · commit `7f7608b` · [ADR-0005](../adr/0005-session-access-control-capability-url.md)

| ID | Original finding | Disposition | Resolution |
|---|---|---|---|
| ENG-002 / AI-006 | `llm-review` has no `auth()` call; it loads any session's stored prompt by id, and the AI inference endpoint is not independently authenticated. | ✅ **Fixed** | `POST /api/llm-review` now calls `auth()` as its **first action** — before body parse or session lookup — and returns **401** with no session lookup and no OpenRouter call when unauthenticated; the 401 path emits a content-free AI security log event via the Pino logger (`logger.warn`). Consistent with the ENG-001 resolution and ADR-0005, **no ownership check was added**: the session id is an unguessable `cuid` capability URL, so any signed-in caller holding the id (owner or invited collaborator) may run a review. Unit test asserts 401 short-circuits before any `Session` lookup or `reviewGherkin` call; existing tests updated to stub an authenticated session. Delta synced to `openspec/specs/llm-review/spec.md`. ⚠️ This authenticates the REST inference endpoint only — the unauthenticated Y.js WebSocket (ENG-005) remains the open boundary. |

#### A.3 Resolutions (2026-07-13)

Refs: [#29](https://github.com/deniskrizanovic/collaborativegherkin/issues/29) · [ADR-0003](../adr/0003-auth-model-magic-link-jwt-resend.md)

| ID | Original finding | Disposition | Resolution |
|---|---|---|---|
| ENG-003 | Test-only `CredentialsProvider` bypass compiled into every build, gated only by `TEST_AUTH_SECRET` presence. | ✅ **Fixed** | The `test-bypass` provider is now gated on a static `process.env.NODE_ENV !== "production"` literal (combined with the existing secret check), so a production bundler dead-code-eliminates the entire block — it is **absent from the production build**, not merely inert. A Vitest guard test (`src/auth.test.ts`) pins the failure path: no `test-bypass` provider under `NODE_ENV=production` even with the secret set (the untested-failure-path root cause behind ENG-006). |
| ENG-004 | `signin/page.tsx` passed the raw `TEST_AUTH_SECRET` into the client `SignInForm`; if set in production the button rendered and the secret shipped in client HTML. | ✅ **Fixed** | The server component now computes a boolean `devLoginEnabled` (`NODE_ENV !== "production"` AND secret present) and passes **only that boolean** to the client — the secret no longer has a code path to the browser. The dev-login button submits a fixed non-secret sentinel; `authorize` verifies against the server-side `TEST_AUTH_SECRET` (and still rejects an explicitly-supplied wrong secret, defense in depth). A `renderToStaticMarkup` test (`src/app/auth/signin/signin-page.test.tsx`) asserts the secret string appears nowhere in the rendered payload and that the dev-login control's presence tracks `devLoginEnabled`. |

Out of scope (deliberate): the vestigial CI `TEST_AUTH_SECRET` env var (GIT-005 tidy). The e2e suite authenticates via directly-minted JWTs (`e2e/global-setup.ts`), not this provider, so it is unaffected.

#### A.4 Resolutions (2026-07-15)

Refs: [#32](https://github.com/deniskrizanovic/collaborativegherkin/issues/32) · PR [#33](https://github.com/deniskrizanovic/collaborativegherkin/pull/33) · [ADR-0005](../adr/0005-session-access-control-capability-url.md)

| ID | Original finding | Disposition | Resolution |
|---|---|---|---|
| ENG-005 | Y.js WebSocket has no authentication/origin/authorisation; the room name comes from the raw request URL, so any client can join any `session-<id>` and read/write the live document, bypassing the Next.js auth gate. | ✅ **Fixed** | The sync socket now shares the Next.js app's origin/port via a single custom `server.js`, so the browser sends the httpOnly `authjs.session-token` cookie on the `upgrade` request. The server verifies the session JWT against `AUTH_SECRET` and validates the `session-{sessionId}` room name (`src/lib/wsAuth.ts`) **before** joining any room; unauthenticated or malformed-room upgrades are refused with **401** before any document or awareness state is sent, and both accept and reject decisions emit content-free security log events via Pino. Per ADR-0005 **no ownership lookup is performed** — an authenticated holder of the capability id is authorised, mirroring the REST contract. The standalone unauthenticated `y-websocket-server.mjs` was deleted (also closing MIN-003). Covered by `src/lib/wsAuth.test.ts` (unit) and `e2e/websocket-auth.spec.ts` (anonymous, valid, malformed-room paths). This closed the primary access-control boundary that the ENG-001 resolution had elevated. |

### B. Input validation and injection safety

| ID | Finding | File / location | Standard | Sev | Action |
|---|---|---|---|---|---|
| ENG-010 | User editor content is passed straight into the LLM user message with no sanitisation, length cap, or structural separation guard. | `src/lib/coaching.ts`, `src/app/api/llm-review/route.ts` | STD-AI-SYSTEM-SECURITY 3.1, 5.1 | M | Flag |
| ENG-011 | Image insert (`readAsDataURL`) embeds base64 into the document and `content` with no size limit and no MIME validation on the file-input/paste path (only the drop handler checks `image/`). Unbounded growth of DB rows and WebSocket payloads (storage and DoS risk). | `src/components/useGherkinKeyboard.ts` (~insertImageFromFile) | STD-AI-SYSTEM-SECURITY 5.1 (DoS input); ENG-CTRL-01 5.4 | M | Flag |
| ENG-012 | `JSON.parse(node.attrs.rows)` has no try/catch; corrupt table attributes throw an unhandled error. | `src/components/useGherkinKeyboard.ts` (~line 60) | ENG-CTRL-01 5.5 (no silent or unhandled failure) | L | Flag |

Note (compliant, keep): Zod validates all REST bodies server-side; `SessionView` renders markdown via `react-markdown` + `remark-gfm` with no `rehype-raw`, so raw HTML in model output is escaped (no XSS via that path).

### C. Configuration, secrets, error handling

| ID | Finding | File / location | Standard | Sev | Action |
|---|---|---|---|---|---|
| ENG-020 | `createPrismaClient` defaults `DATABASE_URL` to `""` then routes to the Postgres adapter; a missing connection string fails late and opaquely instead of fast. | `src/lib/db.ts` | ENG-CTRL-01 5.5 (deliberate failure handling) | M | Flag |
| ENG-021 | `CoachingRequestError` interpolates the raw OpenRouter response body (`${response.status} ${text}`), which is then logged. Provider-side detail (and potentially echoed content) reaches logs. | `src/lib/coaching.ts` | ENG-CTRL-01 5.6; ENG-CTRL-07 10 (logs must not include secrets/data) | M | Flag |
| ENG-022 | `DEFAULT_PROMPT` hardcodes the "Social Housing Maintenance domain" and references a "company specific checklist" that does not exist in the repo. Domain configuration embedded in code. | `src/lib/llm-constants.ts` | ENG-CTRL-01 5.4 (configuration must be injected) | M | Flag |
| ENG-023 | Secrets are sourced from `process.env` (`AUTH_RESEND_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`). See section 7 for the platform-overlay caveat. | `src/auth.ts`, `src/lib/db.ts`, `src/lib/coaching.ts` | ENG-CTRL-01 5.4; ENG-CTRL-07 5.4/8 (repositories must receive injected credentials, not read env directly) | M | Flag (context-dependent) |
| ENG-024 | `next.config.ts` sets no security response headers: no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. | `next.config.ts` | APP 11; Essential Eight E8.4 (application hardening) | M | Flag |

### D. Data layer (Prisma) - schema drift and integrity

| ID | Finding | File / location | Standard | Sev | Action |
|---|---|---|---|---|---|
| ENG-030 | Schema drift: the Postgres `Session` model is MISSING the `prompt` and `model` fields that exist in the SQLite schema. `PATCH /api/sessions/[id]` writing `prompt`/`model` will fail in production. | `prisma/postgres/schema.prisma` vs `prisma/schema.prisma` | ENG-CTRL-09 (config isolation / parity); ENG-CTRL-06 3.1 (reproducible) | H | Block |
| ENG-031 | Two hand-maintained schema files have diverged (`AppSetting` exists only in Postgres; `prompt`/`model` only in SQLite). No single source of truth. | `prisma/*` | ENG-CTRL-02 3.5; ENG-CTRL-09 9 (traceability) | H | Flag |
| ENG-032 | `Session.createdBy` relation has no `onDelete: Cascade` (Account does). Deleting a User with sessions errors or orphans rows. | `prisma/schema.prisma` | ENG-CTRL-07 (data integrity) | M | Flag |
| ENG-033 | No `@@index([userId])` on `Session` though `list` filters by `userId`. | `prisma/schema.prisma` | ENG-CTRL-01 5.9 (runtime behaviour) | L | Flag |

### E. Data access abstraction (ENG-CTRL-02 / ENG-CTRL-07)

| ID | Finding | File / location | Standard | Sev | Action |
|---|---|---|---|---|---|
| ENG-040 | `coaching.ts` makes an inline `fetch` to OpenRouter directly from the service rather than behind a repository/integration abstraction; raw provider response shape is parsed in-line. | `src/lib/coaching.ts` | ENG-CTRL-07 5.2 (no inline HTTP in business logic), 5.5 (no transport leakage); ENG-CTRL-02 3.4 | M | Flag |
| ENG-041 | API route handlers construct `new Session({ session: db.session })` and touch `db` directly. Acceptable DI, but the OpenRouter and Y.js integrations are not abstracted behind interfaces (ENG-CTRL-02 Level 3 applies once external identity/persistence/messaging is involved). | `src/app/api/**` | ENG-CTRL-02 5 (full abstraction at external boundaries) | L | Flag |

Note (compliant, keep): the `Session` and `Coaching` classes use constructor dependency injection and do not mutate injected dependencies - aligned to ENG-CTRL-02 4 and ADR 0001.

---

## 3. AI-controlled profile gaps (overlay)

These are obligations ADDED by `profile-ai-controlled`. Per the profile, they MUST NOT be treated as satisfied by general software testing evidence (profile lines 146-148). Enforcement column uses the profile's internal action table.

| ID | Gap | Capability / supporting standard | Framework | Sev | Action |
|---|---|---|---|---|---|
| AI-001 | No AI risk classification recorded for the coaching feature. | `ai_risk_classification`; STD-AI-GOVERNANCE-POLICY | NIST MAP-1/2; ISO 42001 6.1 | H | Block ("AI system deployed without risk classification") |
| AI-002 | OpenRouter (third-party model provider and platform) not evaluated: no provenance check, no provider security assessment, no AI-BOM, no model card. | STD-AI-SUPPLY-CHAIN 3, 4.1, 4.2, 6.1, 8 | NIST MAP-5, SR-3/5 | H | Block ("third-party AI component without supply chain evaluation") |
| AI-003 | Floating, unpinned model identifiers (`...:free`); production must reference a pinned version. Several IDs also appear fabricated (`deepseek-v4-flash`, `gemma-4-31b-it`, `minimax-m2.5`, `nvidia/nemotron-3-super`), a data-validity risk. | `src/lib/llm-constants.ts`; STD-AI-MODEL-LIFECYCLE 216-217; STD-AI-SUPPLY-CHAIN 4.3 | ISO 42001 8.4 | H | Block (lifecycle "prohibited") |
| AI-004 | No output validation tier assigned, output not labelled AI-generated, no human-oversight record. The coaching output feeds acceptance-criteria authoring. | STD-AI-OUTPUT-VALIDATION 3, 4.1, 4.2; `human_oversight_and_intervention` | NIST MEASURE-1, MANAGE-1; ISO 42001 8.4 | H | Block until tier assigned |
| AI-005 | No prompt-injection control: user content is concatenated into the model call with system prompt; no input filtering for override/extraction/DoS. | STD-AI-SYSTEM-SECURITY 3.1, 5.1 | NIST MEASURE-2 | M | Flag |
| AI-006 | AI inference endpoint (`llm-review`) is not independently authenticated and AI security events are not emitted to centralised logging. ✅ **Authentication resolved — see §2.A.2.** Endpoint now requires `auth()` and emits a content-free security log event on 401. Centralised log aggregation remains a gap (Pino still writes to local files only — see OPS-003). | STD-AI-SYSTEM-SECURITY 4.1, 8 | NIST SA-8 | H | Block (ties to ENG-002) |
| AI-007 | No AI technical documentation (purpose, intended use, limitations, known risks, oversight). | `ai_technical_documentation` | ISO 42001 8.4 | M | Flag |
| AI-008 | No bias / fairness assessment of the coaching output. | `ai_bias_and_fairness_testing` | NIST MEASURE-2 | M | Flag |
| AI-009 | No drift monitoring and no AI-incident-to-problem-management linkage. | `ai_system_monitoring_and_drift_detection`, `ai_incident_response_linkage` | NIST MANAGE-2/4 | M | Flag |
| AI-010 | Output validation failures are not logged or reviewed; high-risk content (versions, dates, quotes) not independently verified. | STD-AI-OUTPUT-VALIDATION 6.1, 7 | NIST SI-3 | L | Flag |

Unresolved supporting-standard gaps required by the profile but absent from the repo: STD-AI-GOVERNANCE-POLICY, STD-AI-LIFECYCLE, STD-AI-OUTPUT-VALIDATION, STD-AI-DATA-PRIVACY, STD-AI-SYSTEM-SECURITY, STD-AI-SUPPLY-CHAIN, DELIVERY-STD-DELIVERY-REGISTERS, DELIVERY-STD-DELIVERY-EVIDENCE-COLLECTION, STD-GOVERNANCE-AUDIT-EVIDENCE, STD-ENTERPRISE-DATA-RETENTION-DISPOSAL (for AI record retention).

---

## 4. Privacy gaps (au-privacy / STD-AI-DATA-PRIVACY)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| PRIV-001 | No privacy policy / open and transparent management of personal information. | APP 1 | H | Flag |
| PRIV-002 | No lawful-basis or necessity assessment for personal data (user email, session content) processed by the app or sent to the LLM. | APP 3-6; STD-AI-DATA-PRIVACY 3.2 | H | Flag |
| PRIV-003 | Session Gherkin content (which may contain real social-housing case detail) is sent to OpenRouter and onward to arbitrary free model providers with no cross-border disclosure governance, no data-residency confirmation, no DPA. | APP 8; STD-AI-DATA-PRIVACY 8 (residency), 4.1/4.2 (minimisation) | H | Block (above-ceiling/residency unconfirmed = not approved) |
| PRIV-004 | No defined maximum data-classification ceiling for the AI system in any register. | STD-AI-DATA-PRIVACY 3.1 | H | Flag |
| PRIV-005 | No PII inventory, no data classification, no DPIA/PIA despite AI influencing requirements decisions and processing personal data. | STD-AI-DATA-PRIVACY 9; APP 1 | H | Flag |
| PRIV-006 | No retention or disposal policy. CLAUDE.md/DECISIONS.md call the data "transient" but nothing enforces or documents retention. | STD-ENTERPRISE-DATA-RETENTION-DISPOSAL; APP 11 | M | Flag |
| PRIV-007 | No data-subject access or correction handling, and no eligible-data-breach (NDB) assessment/notification process. | APP 12-13; NDB scheme | M | Flag |
| PRIV-008 | AI output that becomes a record is not classified by content nor labelled AI-generated. | STD-AI-DATA-PRIVACY 7; STD-AI-OUTPUT-VALIDATION 4.1 | M | Flag |

---

## 5. Security gaps (threat model, headers, MFA, backups)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| SEC-001 | No threat model for the production AI system (prompt injection, poisoning, model inversion/extraction, DoS, supply chain). | STD-AI-SYSTEM-SECURITY 9 | H | Flag |
| SEC-002 | No application threat model / trust-boundary or data-flow diagram. The unauthenticated WebSocket trust boundary (ENG-005) is the clearest example. | ENG-CTRL-08; Essential Eight E8 | H | Flag |
| SEC-003 | No MFA on authentication. Magic-link is single-factor; Essential Eight requires MFA for customer-facing services. | Essential Eight E8.7; STD-ENTERPRISE-ACCESS-CONTROL 4.2 | M | Flag |
| SEC-004 | No documented backup / restore procedure and no RPO/RTO, despite CLAUDE.md instructing "do not migrate prod without a backup". | Essential Eight E8.8; ITSM backup-restore | M | Flag |
| SEC-005 | No dependency vulnerability scanning gate, no SBOM, no SAST/secret-scanning in CI (see DEP section). | Essential Eight E8.2; ENG-CTRL-06 4.4/4.5 | M | Flag |
| SEC-006 | Missing security response headers (CSP/HSTS/etc.) - see ENG-024. | APP 11; E8.4 | M | Flag |
| SEC-007 | No `SECURITY.md` / vulnerability-disclosure policy at repo root. | ENG-CTRL-10 (general) | L | Flag |

---

## 6. Testing standards (ENG-CTRL-04)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| TEST-001 | Failure-path coverage incomplete: ownership/403 asserted only for DELETE; GET/PATCH IDOR and the llm-review auth path are untested (ENG-006, ENG-002). ✅ **Partially resolved:** GET/PATCH access contract now covered by multi-user e2e tests (§2.A.1) and the llm-review 401 path has a unit test asserting no session lookup / no OpenRouter call (§2.A.2). | ENG-CTRL-04 3.2 | H | Flag |
| TEST-002 | Pervasive "Tests: none" in the spec traceability lines - all of spec section 2 (structure rules), section 4 (REST contract), section 8.5/8.6 (LLM API + PATCH) are marked untested. The REST contract and AI feature are not traced to tests. | ENG-CTRL-04 3.6; baseline-commercial requirements_traceability | H | Flag |
| TEST-003 | No coverage roll-up / "X of Y scenarios traced" evidence; test evidence not structured or linked as machine-readable artefacts. | ENG-CTRL-04 4.2 | M | Flag |
| TEST-004 | No AI system testing/validation against accuracy/reliability/safety/fairness/security acceptance criteria linked to model version. | ENG-CTRL-04; ai-controlled `ai_system_testing_and_validation` | M | Flag |
| TEST-005 | Test evidence retention (2 years; 7 years if security-incident-linked) not established. | ENG-CTRL-04 10 | L | Flag |

---

## 7. Dependency governance (ENG-CTRL-06)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| DEP-001 | `package.json` uses caret ranges (`^`) throughout - floating versions; build is not reproducibly pinned (lockfile present but manifest permits drift). | ENG-CTRL-06 3.1, 4.2 | M | Flag |
| DEP-002 | No SBOM generated or maintained. | ENG-CTRL-06 4.4 | M | Flag |
| DEP-003 | No dependency vulnerability scan in CI; no build-fail gate on unpinned deps, critical vulns, or unapproved sources. Dependabot config exists but is not an enforced gate. | ENG-CTRL-06 4.5, 5.1 | M | Flag |
| DEP-004 | No Dependency Register (name, version, owner, lifecycle, licence, security status) and no named owner per dependency. | ENG-CTRL-06 4.1, 3.3 | M | Flag |
| DEP-005 | AI framework/model dependencies (OpenRouter models) not in the dependency-scanning and pinning regime. | ENG-CTRL-06 6.2 (via STD-AI-SUPPLY-CHAIN) | M | Flag |
| DEP-006 | Several pinned LLM model IDs appear to come from unverified/fabricated sources (no provenance). | ENG-CTRL-06 4.3; STD-AI-SUPPLY-CHAIN 4.1 | M | Flag |

---

## 8. Documentation governance and drift (ENG-CTRL-10)

| ID | Finding | Standard | Sev | Action |
|---|---|---|---|---|
| DOC-001 | Doc-vs-code drift: CLAUDE.md says "Next.js 15"; code is Next 16. CLAUDE.md and technical.md reference `src/middleware.ts`; the actual file is `src/proxy.ts`. | ENG-CTRL-10 5.3 (accuracy verified against controlled artefacts) | M | Flag |
| DOC-002 | `docs/spec/06-out-of-scope.md` still states auth and per-session access control do not exist, but auth shipped (ADR 0003, `src/auth.ts`). Material inaccuracy in a controlled doc. | ENG-CTRL-10 5.3 | M | Flag |
| DOC-003 | `docs/TESTING.md` references non-existent test paths (`sessions-api.test.ts`) and omits coaching/session/data-table/llm-review tests; technical.md says "8 e2e specs" but there are 13. | ENG-CTRL-10 5.3, 7 | M | Flag |
| DOC-004 | Project-structure listings in CLAUDE.md/technical.md omit `BlockPicker`, `GherkinDataTable`, `useCollabProvider`, `useGherkinKeyboard`, `coaching.ts`, `session.ts`, `llm-constants.ts`. | ENG-CTRL-10 5.3 | L | Flag |
| DOC-005 | No document owner recorded on docs; no review evidence (date, reviewer, version, scope, findings, approval). | ENG-CTRL-10 5.1, 5.2 | M | Flag |
| DOC-006 | ADR 0001 has no Status/Date header (0002-0004 do); no ADR index/README; no ADRs for OpenRouter/model selection, Y.js-not-persisted, WebSocket auth, or NSW Design System adoption. | ENG-CTRL-10 7; baseline traceability | L | Flag |
| DOC-007 | `docs/2026-05-25-story.md` (podcast script) overstates maturity ("production-ready") in ways these gaps contradict; risk of being mistaken for status reporting. | ENG-CTRL-10 5.3 | L | Flag |
| DOC-008 | 28 `docs/plans/*.md` use `HH:MM` colon filenames invalid on Windows/NTFS and are not indexed to delivered features or ADRs. | ENG-CTRL-10 7 | L | Flag |

---

## 9. Delivery artefacts missing (baseline-commercial)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| DEL-001 | No formal user stories ("As a role, I want, so that"), no story IDs distinct from test-scenario IDs, no backlog/register, no INVEST assessment, no Definition of Ready / Done. | baseline-commercial work_management_traceability; ISO 9001 | H | Flag |
| DEL-002 | No personas / roles. CONTEXT.md defines "Owner" and "Participant" as data terms only; the NSW social-housing end user is never characterised. | baseline-commercial | M | Flag |
| DEL-003 | No numbered, atomic, testable requirements register separate from acceptance criteria (scenarios conflate requirement and test); no requirement attributes (priority, source, owner, status, verification method). | baseline-commercial requirements_traceability | H | Flag |
| DEL-004 | No non-functional requirements at all: performance/latency, concurrent-editor ceiling, availability/uptime, scalability, security, privacy, accessibility, browser support, data volume. Notable for a real-time collaborative tool. | baseline-commercial; ISO 9001 | H | Flag |
| DEL-005 | No end-to-end traceability matrix (requirement to design to test to evidence); existing scenario-to-test links are mostly "none". | baseline-commercial requirements_traceability + testing_evidence_linkage | H | Flag |
| DEL-006 | No delivery registers (change, evidence, decision, risk) as required by baseline supporting standards. | DELIVERY-STD-DELIVERY-REGISTERS, EVIDENCE-COLLECTION | M | Flag |
| DEL-007 | No CHANGELOG/release notes/versioning policy; no LICENCE file; no CONTRIBUTING; no domain glossary of social-housing-maintenance terms. | baseline artefact identity/versioning; ENG-CTRL-10 | L | Flag |
| DEL-008 | No consolidated environment/config reference classifying which env vars are secrets (`AUTH_SECRET`, `AUTH_RESEND_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`, `TEST_AUTH_SECRET`). | ENG-CTRL-09 4; ENG-CTRL-10 | M | Flag |

---

## 10. Accessibility (NSW Government - WCAG 2.1 AA)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| A11Y-001 | No WCAG 2.1 AA conformance statement, no accessibility testing, no conformance report - mandatory under the NSW Digital Service Standard for a NSW Gov context using nsw-design-system. | WCAG 2.1 AA; NSW DSS; APP-adjacent | H | Flag |
| A11Y-002 | Bespoke widgets are not keyboard/AT accessible: BlockPicker items use `onMouseDown` only, with no `onKeyDown`, `role`, `aria`, or `tabIndex` (not exposed as a listbox); the data-table uses `contentEditable` cells with no ARIA; floating toolbar buttons unlabelled. | WCAG 2.1 (2.1.1 Keyboard, 4.1.2 Name/Role/Value) | H | Flag |
| A11Y-003 | No colour-contrast statement for the colour-coded Gherkin keyword scheme. | WCAG 1.4.3 | M | Flag |
| A11Y-004 | `<img>` used with eslint-disable and no `next/image`; alt handling for inserted images not verified. | WCAG 1.1.1 | L | Flag |

---

## 11. Operations and release model (ENG-CTRL-09, ISO 20000)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| OPS-001 | Known data-durability gap: Y.js document state is not persisted; restarting the WebSocket server loses in-progress content. Unmanaged availability/data-loss risk with no mitigation. | ENG-CTRL-09 13; APP 11 | H | Flag |
| OPS-002 | No environment register, no recorded environment owners, no documented release flow/approvals; promotion is not the defined progression mechanism. | ENG-CTRL-09 4.1-4.3, 6, 7 | M | Flag |
| OPS-003 | No runbook, incident/problem-management process, SLO/SLA/error budget, monitoring/alerting design (Pino writes to local files only), on-call/escalation, capacity or DR plan. | ISO 20000; ai-controlled `ai_incident_response_linkage` | M | Flag |
| OPS-004 | CI seeds and migrates with `migrate deploy` against the same path used everywhere; no separation of build/package/promotion/deploy evidence; risk of real-vs-test data isolation gaps. | ENG-CTRL-09 8, 19 | M | Flag |

---

## 12. Commit and release hygiene (ENG-CTRL-01-COMMIT, internal)

| ID | Gap | Standard | Sev | Action |
|---|---|---|---|---|
| GIT-001 | Recent commit subjects are not Conventional Commits format. | commit 3.1, 3.4 | L | Flag |
| GIT-002 | No commit-msg hook or CI check enforcing the commit standard; `--no-verify` not prohibited. | commit 8 | L | Flag |
| GIT-003 | AI-generated changes must carry a `Co-Authored-By` attribution footer and must have human review (does not transfer accountability). README claims the project is "99.99% AI-written" - attribution and review evidence required. | commit 5.1, 5.2; STD-AI-OUTPUT-VALIDATION 5.1 | M | Flag |
| GIT-004 | Default-branch commits should be signed (GPG/SSH) and verified. | commit 6.1 | L | Flag |
| GIT-005 | CI workflow commits plaintext test secrets (`AUTH_SECRET`, `TEST_AUTH_SECRET`) into the repo rather than GitHub Secrets. | commit 4.2; ENG-CTRL-10 8 | L | Flag |

---

## 13. House-rules and minor items (no matter how small)

| ID | Item | Sev |
|---|---|---|
| MIN-001 | Ellipsis characters used in UI strings ("Sending...", "Connecting...") via the Unicode ellipsis; house rule requires ASCII punctuation. | L |
| MIN-002 | Controlled unsafe casts: `provider as unknown as {...}` in `GherkinEditor.tsx`, `globalThis as unknown as` in `db.ts`. Acceptable but document the invariant. | L |
| MIN-003 | `y-websocket-server.mjs` hardcodes `localhost:1234` and uses `console.*` instead of the Pino logger. | L |
| MIN-004 | No `@@index`, no cascade (see ENG-032/033) - repeated here for the data-model checklist. | L |
| MIN-005 | `.env.example` prod-DB comment points at the drifted `prisma/postgres/schema.prisma`. | L |

---

## 14. Env-var / secrets - platform overlay caveat

Denis reads secrets from `process.env`. ENG-CTRL-01 5.4 bans hardcoding (which Denis does not do), and ENG-CTRL-07 5.4/8 requires data-access components to receive injected credentials rather than read env directly. The stricter AppGenie position - environment variables are deployment-binding only and never a secret/config store, with runtime secrets sourced through the AccessBroker/KMS path - is a platform control tied to AppGenie AWS infrastructure that this Next.js/Node stack does not have. Therefore:

- Against the AppGenie platform overlay, `process.env` secret sourcing is non-compliant, but the prescribed AccessBroker/KMS remediation does not map to this stack as written.
- Decision required: is Denis to be governed as an AppGenie product? If yes, a secrets-management design decision (managed secret store, injected credential provider per ENG-CTRL-07 8) is needed and ENG-023/ENG-040 become Block. If no, the project's own `.env.local` convention stands and ENG-023 remains a documentation-and-injection improvement only.

This is flagged honestly rather than asserted as a fix, because pretending KMS applies here would be incorrect.

---

## 15. Remediation roadmap

Phase 0 - restore and stop the bleeding
1. Restore the working tree (`git restore --staged . && git restore .`) so the code exists on disk. Confirm before committing the mass deletion.

Phase 1 - blocking baseline defects (smallest, highest value first)

> **Progress marker (2026-07-15): Phase 1 complete → next is step 7 (Phase 2).** Step 2 is complete (closed as "not a defect"), step 3 is done (ENG-002 / AI-006, [#27](https://github.com/deniskrizanovic/collaborativegherkin/issues/27), commit `7f7608b`), step 4 is done (ENG-030 / ENG-031, [#28](https://github.com/deniskrizanovic/collaborativegherkin/issues/28)), step 5 is done (ENG-003 / ENG-004, [#29](https://github.com/deniskrizanovic/collaborativegherkin/issues/29) — see §2.A.3), and step 6 is done (ENG-005, [#32](https://github.com/deniskrizanovic/collaborativegherkin/issues/32), PR [#33](https://github.com/deniskrizanovic/collaborativegherkin/pull/33)). All Phase 1 blocking baseline defects are resolved.

2. ✅ **DONE** — ENG-001 / ENG-006 ([#22](https://github.com/deniskrizanovic/collaborativegherkin/issues/22), [ADR-0005](../adr/0005-session-access-control-capability-url.md)). Resolved **not** by adding an ownership guard: the session id is an unguessable `cuid` used as a capability URL, so open `GET`/`PATCH` is the intended collaboration model (owner-only guards were added then reverted). `DELETE` stays owner-only. Test gap closed with a second e2e identity + multi-user characterisation tests (mutation-verified). ⚠️ Note: this narrows the REST surface only — the unauthenticated Y.js WebSocket (ENG-005) is the real boundary and is **still open**.
3. ✅ **DONE** — ENG-002 / AI-006 ([#27](https://github.com/deniskrizanovic/collaborativegherkin/issues/27), commit `7f7608b`, [ADR-0005](../adr/0005-session-access-control-capability-url.md)). `POST /api/llm-review` now calls `auth()` as its first action and returns 401 (with a content-free security log event) before any session lookup or OpenRouter call. Per ADR-0005 **no ownership guard was added** — the id is a capability URL, so any authenticated holder may run a review. ⚠️ Authenticates the REST endpoint only; the unauthenticated Y.js WebSocket (ENG-005) remains the primary open boundary.
4. ✅ **DONE** — ENG-030 / ENG-031 ([#28](https://github.com/deniskrizanovic/collaborativegherkin/issues/28)). Postgres `Session` now carries `prompt`/`model` (so `PATCH /api/sessions/[id]` writes succeed in production) and the stray `AppSetting` model was removed. A `lint:schema-parity` gate (CI + husky pre-commit) now fails the build on any single-schema edit, establishing a single source of truth.
5. ✅ **DONE** — ENG-003 / ENG-004 ([#29](https://github.com/deniskrizanovic/collaborativegherkin/issues/29), see §2.A.3). The `test-bypass` provider is gated on a static `NODE_ENV !== "production"` literal so it is dead-code-eliminated from production builds; the sign-in page passes a boolean `devLoginEnabled` instead of the raw secret, so the secret never crosses the server→client boundary. Guard tests pin both the production-absence and no-secret-in-payload properties.
6. ✅ **DONE** — ENG-005 ([#32](https://github.com/deniskrizanovic/collaborativegherkin/issues/32), PR [#33](https://github.com/deniskrizanovic/collaborativegherkin/pull/33)). The Y.js sync WebSocket now shares the Next.js app's origin/port (one custom `server.js`), so the browser sends the httpOnly NextAuth session cookie on the `upgrade` request; the server verifies the session JWT and validates the `session-{sessionId}` room name before joining any room. Unauthenticated or malformed-room upgrades are refused with 401 before any document/awareness state is sent; accept/reject decisions emit content-free security log events via Pino. The standalone unauthenticated `y-websocket-server.mjs` was deleted. *(This closed the primary access-control boundary that the ENG-001 resolution had elevated.)*

Phase 2 - AI-controlled and privacy blocks
7. AI-001/AI-004: assign and document a risk classification and an output-validation tier; label coaching output as AI-generated (cheapest profile-block closure).
8. AI-002/AI-003: pin model versions, remove invalid model IDs, complete an OpenRouter supply-chain assessment and AI-BOM.
9. PRIV-003/PRIV-004/PRIV-005: define the data-classification ceiling, complete a PIA, and resolve cross-border disclosure for LLM egress (or stop sending session content off-shore).

Phase 3 - engineering hardening
10. ENG-010/011/012, ENG-020/021/024, DEP-001..006, TEST-001..004, SEC-001..006, A11Y-001..004.

Phase 4 - governance and documentation
11. Create the missing delivery artefacts (DEL-001..008), AI governance doc, privacy pack, threat model, runbook/SLOs, and fix the doc drift (DOC-001..008). Establish registers, traceability matrix, and commit/release controls (GIT-001..005, OPS-001..004).

---

## 16. Standards alignment

- Task classification: governed AI-system compliance review and remediation planning.
- Overlay applied: control bundle = baseline-commercial (floor) + ai-controlled + au-privacy + essential-eight.
- Compliance MCP: unavailable this session; overlay reconstructed from the standards repo and NOT authoritative. Confirm via `query_appgenie_compliance` and the engagement contract, especially the applicability of au-privacy and essential-eight.
- Sources cited: ENG-CTRL-01/02/04/06/07/08/09/10 and ENG-CTRL-01-COMMIT (commit standard and AI-governance standards are visibility: internal / customer_safe: false - internal evidence only); STD-AI-OUTPUT-VALIDATION, STD-AI-SYSTEM-SECURITY, STD-AI-SUPPLY-CHAIN, STD-AI-DATA-PRIVACY, STD-AI-MODEL-LIFECYCLE; STD-ENTERPRISE-ACCESS-CONTROL (the live standard; std-security-access-control.md is Superseded); profile-baseline-commercial, profile-ai-controlled, profile-au-privacy, profile-essential-eight.
- Profile-specific gaps are flagged distinctly from baseline engineering defects per profile-ai-controlled lines 144-148.
- Do not treat this document as compliance evidence until a qualified human has reviewed it and it has been run through the live Compliance MCP control bundle.
