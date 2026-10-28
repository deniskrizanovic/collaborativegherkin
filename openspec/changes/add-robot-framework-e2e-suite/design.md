## Context

`e2e/` holds 15 Playwright TypeScript files with roughly 110 tests and a shared
`helpers.ts` (`createSession`, `openSession`, `pressEnterAndWait`). Auth is
handled by `e2e/global-setup.ts`, which upserts two users and writes NextAuth JWT
cookies to `e2e/.auth/user.json` and `e2e/.auth/user2.json`. Playwright runs with
1 worker, 0 retries, and a `webServer` that reuses `pnpm dev` on `:3000`.

Over time the suite has grown robustness techniques that a naive port would lose:

| Technique | Where |
|---|---|
| Wait for a block count to grow before the next action | `helpers.ts` `pressEnterAndWait`, `enter-progression`, `visual-separation` |
| Click the block before keyboard input (Tiptap focus) | everywhere |
| Two isolated browser contexts | `collaboration`, `session-access-control` |
| Second, distinct identity (`user2.json`) | `session-access-control` |
| Held route released by the test | `llm-review` (in-flight disabled state, cached result) |
| Fulfilled/mocked routes, method-conditional `continue()` | `llm-review`, `home` |
| `waitForResponse` + status assertion paired with the triggering action | `session-access-control` |
| Download event, suggested filename, file content per line | `export`, `data-table`, `visual-separation` |
| File-input upload of a generated PNG | `image`, `export`, `enter-progression` |
| Synthetic `DataTransfer` drop and native value setter | `image`, `home` |
| Computed style (`borderTopWidth`, `background`) | `visual-separation`, `block-picker` |
| Clipboard permission grant | `home` |
| Raw `ws` client with exact `Cookie` header, 401 and no-data checks | `websocket-auth` |
| `try/finally` closing extra contexts | multi-context tests |

The user is new to Robot Framework. Both suites will exist permanently.

## Goals / Non-Goals

**Goals:**
- Full test-for-test parity with every robustness technique kept (see spec).
- Each chunk is a green, reviewable increment that ends in a demo: "run `pnpm test:robot`, N tests pass".
- Robot code that reads well to a novice: one shared resource of well-named keywords, short test cases, and a primer README.
- One command locally (`pnpm test:robot`), and the same command in CI.

**Non-Goals:**
- Removing or changing the Playwright suite, `playwright.config.ts`, or `e2e/global-setup.ts`.
- Rewriting the tests as business-language Gherkin keywords. Tests stay at the same abstraction level as the Playwright originals so parity can be checked line by line. A higher-level keyword layer can come later.
- Parallel execution (`pabot`). The suite stays serial, like Playwright's `workers: 1`.
- Un-skipping `SC-3.5.2` (collaboration cursors). It is ported as a skipped test.

## Decisions

### D1. Browser library, not SeleniumLibrary
`robotframework-browser` runs on Playwright, so auto-waiting, contexts, routes,
downloads and storage states keep the same semantics as the TS suite. SeleniumLibrary
would lose contexts and routing entirely.

### D2. `uv` for Python, wrapped by pnpm
`pyproject.toml` (no package, `[tool.uv] package = false`) pins `robotframework`,
`robotframework-browser`, `robotframework-requests`, and `websockets`. `.python-version` pins the interpreter.
Developers never activate a venv: `pnpm test:robot:init` runs `uv sync && uv run rfbrowser init chromium`,
and `pnpm test:robot` runs everything else. *Alternative:* pip + venv. Rejected
(chosen by the user): it is slower and needs manual activation.

### D3. Reuse `e2e/global-setup.ts` for auth
A new `scripts/mint-e2e-auth.ts` imports the default export of `e2e/global-setup.ts`
and calls it, run with `tsx`. Robot then opens contexts with
`New Context    storageState=e2e/.auth/user.json`. *Alternative:* encode the JWT in
Python. Rejected: NextAuth's JWE encoding (salt, `A256CBC-HS512`) would be
duplicated and could drift. With one minting path, both suites always authenticate
the same way.

### D4. Runner script mirrors Playwright's `webServer.reuseExistingServer`
`scripts/run-robot.mjs`:
1. Runs the auth minting from D3.
2. Probes `http://localhost:3000`. If nothing is listening, spawns `pnpm dev`, polls until it responds (120 s cap), and remembers that it started the server.
3. Runs `uv run robot --outputdir robot/results robot/suites` and forwards extra CLI args (for example `--include chunk1` or `--test "SC-7.1.4*"`).
4. Kills the server only if it started it, then exits with Robot's exit code.

This keeps `pnpm test:robot` standalone and also correct in CI after Playwright has
shut its own server down.

### D5. Layout
```
robot/
  README.md                 # primer: Robot syntax + Playwright→Browser cheat-sheet
  PARITY.md                 # Playwright title → Robot test, status per row
  resources/
    common.resource         # Library imports, suite/test setup, shared variables
    session.resource        # Create Session Via API, Open Session, Press Enter And Wait For Block, Block Types In Editor, Toolbar Button, ...
    files.resource          # Write Tiny PNG, Download And Read, temp-file cleanup
    api.resource            # RequestsLibrary: Create API Session For (cookie from storage state)
  libraries/
    WebSocketProbe.py       # Probe WebSocket Upgrade    url    cookie=    → dict(opened, status, received_data)
    routes.js               # Browser jsextension: hold/release/fulfil routes
  suites/
    00_smoke.robot
    home.robot  initial_content.robot  toolbar.robot  import.robot
    enter_progression.robot  block_picker.robot  visual_separation.robot
    export.robot  image.robot  data_table.robot
    llm_review.robot  session_access_control.robot  collaboration.robot
    session_access_control_api.robot
    websocket_auth.robot
  results/                  # git-ignored
```
One suite per spec file keeps PARITY.md mechanical. The one exception is
`session-access-control.spec.ts`, which splits in two: its API-contract block goes
to `session_access_control_api.robot` (no browser, see D15) and its UX block goes
to `session_access_control.robot`.

### D6. Test isolation equals a Playwright fixture
`common.resource` → `Suite Setup    New Browser    chromium    headless=${HEADLESS}`;
`Test Setup    New Context    storageState=e2e/.auth/user.json    baseURL=http://localhost:3000    acceptDownloads=True`
then `New Page`. Browser's default `auto_closing_level=TEST` closes every context and
page a test opened, including second-user contexts. That is the Robot equivalent of
the `try/finally { context2.close() }` blocks. Temp files are deleted in `[Teardown]`.

### D7. Playwright API to Browser keyword mapping (key cases)
| Playwright | Browser library |
|---|---|
| `expect(loc).toHaveCount(n)` | `Get Element Count    ${sel}    ==    ${n}` (auto-retries until timeout) |
| `toContainText` / `toHaveText` / `toHaveValue` | `Get Text    ${sel}    *=` / `==`; `Get Property    ${sel}    value    ==` |
| `toBeVisible` / `not.toBeVisible` / `toBeDisabled` / `toBeFocused` | `Wait For Elements State    ${sel}    visible` / `hidden` / `disabled` / `focused` |
| `locator(x, { hasText })`, `.last()`, `.nth(i)` | `x:has-text("…")`, `x >> nth=-1`, `x >> nth=${i}` |
| `page.waitForFunction(count > before)` | `Wait For Function` with the same JS, or `Get Element Count  ${sel}  >  ${before}` |
| `keyboard.press/type`, `mouse.click(x,y)` | `Keyboard Key    press    Enter`, `Keyboard Input    type    text`, `Mouse Button    click    10    10` |
| `click({ position })` | `Click    ${sel}    position_x=5    position_y=5` |
| `page.request.post/get/delete` used as test setup | `Http    /api/sessions    POST    {"title": "…"}` (uses the current context's cookies) |
| `request.newContext({ storageState: user2 })` API-contract tests | RequestsLibrary: `Create API Session For    other    ${OTHER_STATE}` → `DELETE On Session    other    /api/sessions/${id}    expected_status=403` (D15) |
| `Promise.all([waitForResponse(pred), action])` | `${p}=    Promise To    Wait For Response    matcher=…` → action → `${r}=    Wait For    ${p}` → `Should Be Equal    ${r.status}    ${200}` |
| `waitForEvent("download")` + `saveAs` | `${p}=    Promise To Wait For Download    ${path}` → click → `${d}=    Wait For    ${p}` → `${d.suggestedFilename}`, read file |
| `setInputFiles` | `Upload File By Selector    input[type="file"]    ${png}` |
| `evaluate` / `evaluateAll` | `Evaluate JavaScript    ${sel}    (el) => …` (with `all_elements=True` for evaluateAll) |
| `getComputedStyle(el).x` / `toHaveCSS` | `Get Style    ${sel}    border-top-width    ==    1px` |
| `context.grantPermissions` | `Grant Permissions    clipboard-read    clipboard-write` |
| `page.route(...).fulfill` / held route | `routes.js` jsextension (D8) |
| raw `ws` client | `WebSocketProbe.py` (D9) |

### D8. Routes through a Browser JS extension
Browser's built-in keywords cover request/response *waiting* but not arbitrary
`page.route` handlers with test-controlled release. `robot/libraries/routes.js` is
loaded with `Library    Browser    jsextension=${CURDIR}/../libraries/routes.js` and
exports `fulfillRoute(url, status, body, method, page)`, `holdRoute(url, status, body, page)`
(stores a resolver in module scope), `releaseRoute(url)` and `clearRoutes(page)`.
Each export becomes a keyword (`Fulfill Route`, `Hold Route`, `Release Route`).
That gives the exact semantics of `interceptReview`, the held-promise tests, and
the POST-only 500 in `home.spec.ts`. *Alternative:* add a server-side test hook.
Rejected: it touches app code and would weaken the test.

### D9. WebSocket probe as a tiny Python library
`WebSocketProbe.py` uses `websockets.sync.client.connect(url, additional_headers=…, open_timeout=3)`:
- `InvalidStatus` → `opened=False`, `status=exc.response.status_code`.
- Success → `opened=True`, then `recv(timeout=3)` → `received_data=True`.
- Close or timeout → terminal.
The cookie header is built from `Get Cookies` of the authenticated context, so the
probe controls `Cookie` exactly, as `connectResult` does.

### D15. RequestsLibrary for API-contract tests
The 3 API-contract tests (non-owner GET 200, PATCH 200, DELETE 403 plus the owner's
follow-up GET 200) use RequestsLibrary, Robot's standard REST library, chosen by the
user. `robot/resources/api.resource` provides
`Create API Session For    ${alias}    ${storage_state}`. It reads the storage-state
JSON (`Get File` + `Evaluate    json.loads(...)`), picks the `authjs.session-token`
cookie, and calls `Create Session    ${alias}    ${BASE_URL}    cookies=${cookies}`.
Tests then call `POST On Session` / `GET On Session` / `PATCH On Session` /
`DELETE On Session` with `expected_status=` set to the exact code, and check bodies
with `${resp.json()}[id]`. `session_access_control_api.robot` imports only
`api.resource`, with no Browser setup, so it runs without a browser.
*Alternative:* Browser `Http` from a second context (the original plan). Rejected:
it needs a browser for a pure HTTP contract, and RequestsLibrary's
`expected_status` keeps the assertion explicit. Browser `Http` stays in use for
*setup* calls inside UI tests (`Create Session Via API`, the `home` delete-all),
because those calls ride on the open page's cookies.

### D10. No-sleep gate
`scripts/lint-robot-no-sleep.mjs` (same shape as `lint-spec-traceability.mjs`,
with a Vitest test) fails on any `Sleep` keyword call in `robot/suites/**` or
`robot/resources/**`. Wired as `pnpm lint:robot` into the husky pre-commit hook,
`test:all`, and CI. It is offline-safe.

### D11. Naming, tags, and timeouts
Test names copy the Playwright title verbatim, `SC-` id included. Every test has
`[Tags]    chunk<N>    <area>` so a single chunk can be run with
`pnpm test:robot --include chunk2`. `Set Browser Timeout    5s` matches Playwright's
`expect` default. Explicit `timeout=5s` arguments are kept where the original
passes `{ timeout: 5000 }`.

### D12. Spec traceability
As each chunk lands, the matching baseline `openspec/specs/*/spec.md`
`> **Tests:**` lines get a second citation, e.g.
`` [`e2e/import.spec.ts`](…) · [`robot/suites/import.robot`](…) — case ``.
This is traceability metadata, not a requirement change, so it is edited in place
rather than through delta specs.

### D13. `test:all` and CI ordering
`test:all` is `run-p`, but both e2e suites share one SQLite DB and
`home` deletes every session, so they must not run concurrently. A new `e2e:all`
script runs `run-s test:e2e test:robot`, and `test:all` calls `e2e:all` instead of
`test:e2e`. In CI, steps run in this order: `astral-sh/setup-uv` → `pnpm test:robot:init`
→ existing e2e step → `pnpm test:robot` → `actions/upload-artifact` (`if: always()`)
for `robot/results/`. The CI `paths` filter also gains `robot/**`, `e2e/**`, and
`pyproject.toml`. At the moment, test-only changes do not trigger CI at all.

### D14. Chunks
| # | Scope | Proof at end of chunk |
|---|---|---|
| 0 | Toolchain, runner, auth reuse, `common`/`session` resources, README primer, PARITY skeleton, `00_smoke.robot` (open session, 5 scaffold blocks) | `pnpm test:robot` → 1 passed |
| 1 | `initial-content`, `toolbar`, `home` (no route test yet), `import` | ~27 passed |
| 2 | `enter-progression` (text rows), `block-picker`, `visual-separation` (non-export) | ~+25 |
| 3 | `files.resource`; `export`, `image`, `data-table`, the export/image rows deferred from chunk 2, and `visual-separation` export | ~+20 |
| 4 | `routes.js`; `llm-review`, the `home` server-error test | ~+20 |
| 5 | `collaboration`, `session-access-control` (second identity, response waits) | ~+9 |
| 6 | `WebSocketProbe.py`; `websocket-auth` | +3, PARITY complete |
| 7 | `lint:robot`, `e2e:all`, CI wiring, artifact upload | CI green with both suites |

The order runs from simplest to most technique-heavy, so each chunk introduces only
one or two new Robot concepts.

## Risks / Trade-offs

- [Browser `jsextension` handler signature or route API differs from assumption] → Chunk 4 starts with a spike test that proves `Hold Route`/`Release Route` before porting `llm-review`. Fallback: `Route URL`/`Unroute` keywords if the installed Browser version provides them.
- [`rfbrowser init` downloads its own Playwright and Node deps (~large, slow in CI)] → Cache `~/.cache/ms-playwright` and the Browser `wrapper/node_modules` keyed on `uv.lock`.
- [Two Playwright versions (the app's `@playwright/test` and Browser's bundled one) behave slightly differently] → Accepted. Parity is behavioural, and both run the same Chromium channel.
- [Shared DB state between suites (e.g. `home` deletes all sessions)] → Strictly serial runs (D13). Every test creates its own session, as the TS suite does.
- [CI e2e time roughly doubles] → Accepted by keeping both suites. Revisit with `pabot` later if needed.
- [Novice maintainer misreads Robot whitespace (cells need 2+ spaces)] → README primer plus `robocop format` is optional and not gated. The sample suite in chunk 0 is heavily commented.
- [Weaker port slips in, e.g. dropping a status assertion] → PARITY.md rows list the assertions per test, and review compares them against the TS source.

## Migration Plan

Additive only. Rollback means deleting `robot/`, `pyproject.toml`, `uv.lock` and
the new scripts, then reverting `package.json` and `ci.yml`. The Playwright suite
is untouched throughout.

## Open Questions

- Confirm the pinned `robotframework-browser` major version supports `Promise To Wait For Download` returning `suggestedFilename` (expected in ≥18). Check during chunk 0 when pinning.