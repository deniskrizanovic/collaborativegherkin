Every chunk ends with a **checkpoint**. Both `pnpm test:robot` and `pnpm test:e2e`
must be green, and `robot/PARITY.md` must be updated, before the next chunk starts
(see the spec requirement "The port is delivered in independently green chunks").
After the checkpoint, every chunk ends with a **STOP for user review** task. When
you reach it, halt the apply run: report what changed and the checkpoint results,
then wait. Never tick a STOP task yourself. Only the user signs it off, and the
next chunk starts only after they say to continue.
Port each test by reading its `.spec.ts` source side by side. Keep every
assertion, and never use `Sleep`.

## 0. Chunk 0: Toolchain, runner, and one smoke test

- [x] 0.1 Add `.python-version`, plus a `pyproject.toml` (`[tool.uv] package = false`) that pins `robotframework`, `robotframework-browser` (choose a version whose `Promise To Wait For Download` returns `suggestedFilename`, which resolves the design's open question), `robotframework-requests` and `websockets`. Run `uv lock` and commit `uv.lock`.
- [x] 0.2 Add `robot/results/` and `.venv/` to `.gitignore`.
- [x] 0.3 Add `scripts/mint-e2e-auth.ts`, which imports and awaits the default export of `e2e/global-setup.ts`. Verify that it writes `e2e/.auth/user.json` and `user2.json`.
- [x] 0.4 Add `scripts/run-robot.mjs` per design D4: mint auth, probe `:3000`, start `pnpm dev` only if it is down, run `uv run robot --outputdir robot/results robot/suites` with forwarded args, stop only a server it started, and propagate the exit code.
- [x] 0.5 Add `package.json` scripts: `test:robot:init` (`uv sync && uv run rfbrowser init chromium`) and `test:robot` (`node scripts/run-robot.mjs`).
- [x] 0.6 Create `robot/resources/common.resource`: Browser import, `${BASE_URL}`, `${OWNER_STATE}`, `${OTHER_STATE}`, `${HEADLESS}` (default True), `Set Browser Timeout 5s`, and the `Open Browser For Suite` and `Open Owner Context And Page` setup keywords (design D6).
- [x] 0.7 Create `robot/resources/session.resource` with the ports of `helpers.ts`: `Create Session Via API`, `Open Session`, `Press Enter And Wait For Block`, `Click Editor`, plus the shared `Block Types In Editor` (evaluateAll of `data-gherkin-type`) and `Toolbar Button` (`.gherkin-toolbar-btn:has-text(...)`) keywords.
- [x] 0.8 Write `robot/suites/00_smoke.robot`, heavily commented for a first-time reader. It opens a session and asserts the scaffold types are exactly `feature, scenario, given, when, then`.
- [x] 0.9 Write `robot/README.md`: how to install and run, Robot syntax basics (sections, 4-space cells, variables, keywords, tags, setup/teardown), how to run one chunk or test, where to read `log.html`, and the Playwright to Browser cheat-sheet from design D7.
- [x] 0.10 Create `robot/PARITY.md` with one row for every `test(...)`/`test.skip(...)` in `e2e/*.spec.ts`. Columns: Playwright file, title, key assertions, Robot suite, chunk, status (`pending`/`ported`).
- [x] 0.11 **Checkpoint**: `pnpm test:robot:init && pnpm test:robot` reports 1 test passed, and `pnpm test:e2e` is still green.
- [x] 0.12 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 1 until the user says to continue.

## 1. Chunk 1: Simple UI suites

- [x] 1.1 Port `initial-content.spec.ts` to `robot/suites/initial_content.robot` (3 tests).
- [x] 1.2 Port `toolbar.spec.ts` to `robot/suites/toolbar.robot` (5 tests).
- [x] 1.3 Port `import.spec.ts` to `robot/suites/import.robot` (11 tests), keeping every exact `Get Element Count ==` assertion.
- [x] 1.4 Port `home.spec.ts` except `SC-1.2.4` to `robot/suites/home.robot`: the API-driven delete-all for the empty state, the native-value-setter `Evaluate JavaScript` for the 201-character title, `Grant Permissions` for copy-link, and the URL assertions with `Get Url`.
- [x] 1.5 Tag chunk-1 tests `chunk1` and update PARITY.md rows to `ported`.
- [x] 1.6 Add the Robot citation to the matching `> **Tests:**` lines in the baseline specs (design D12), then run `pnpm lint:specs`.
- [x] 1.7 **Checkpoint**: `pnpm test:robot` (≈27 passed) and `pnpm test:e2e` are green.
- [x] 1.8 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 2 until the user says to continue.

## 2. Chunk 2: Keyboard and editor-structure suites

- [x] 2.1 Port `enter-progression.spec.ts`, all 9 text rows of `SC-3.2.1`, to `robot/suites/enter_progression.robot`. Keep the mix of plain `End`/`Enter` and `Press Enter And Wait For Block` exactly as in the original. The `SC-3.2.2` image row is deferred to 3.4.
- [x] 2.2 Port `block-picker.spec.ts` to `robot/suites/block_picker.robot` (9 tests). This includes the `Get Style … background *= rgba(0, 38, 100, 0.06)` focus checks, `Mouse Button click 10 10`, and the "Image always last" check in both contexts.
- [x] 2.3 Port the 7 non-export tests of `visual-separation.spec.ts` to `robot/suites/visual_separation.robot`, asserting `border-top-width` `1px`/`0px` through `Get Style`.
- [x] 2.4 Tag `chunk2`, update PARITY.md and the baseline `> **Tests:**` citations, then run `pnpm lint:specs`.
- [x] 2.5 **Checkpoint**: both suites green.
- [x] 2.6 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 3 until the user says to continue.

## 3. Chunk 3: Download and file suites

- [x] 3.1 Create `robot/resources/files.resource`: `Write Tiny PNG` (the same 1×1 hex bytes, unique temp path, returned for teardown), `Download Via Button` (`Promise To Wait For Download` → click → `Wait For`, returns path and `suggestedFilename`), `Read Lines`, and `Remove Temp Files` for `[Teardown]`.
- [x] 3.2 Port `export.spec.ts` to `robot/suites/export.robot` (4 tests). Assert the exact filename and exact line-by-line content.
- [x] 3.3 Port `image.spec.ts` to `robot/suites/image.robot` (3 tests). This includes the bounding-box width/height > 0 check (`Get BoundingBox`) and the synthetic `DataTransfer` drop through `Evaluate JavaScript`.
- [x] 3.4 Add `SC-3.2.2` (Enter on image block uses prevType) to `enter_progression.robot`.
- [x] 3.5 Port `data-table.spec.ts` to `robot/suites/data_table.robot` (10 tests): focus checks after `Tab`/`Shift+Tab`, `Fill Text` into cells, the blur commit, and TXT/MD export content.
- [x] 3.6 Add the "separator not in export" test to `visual_separation.robot`.
- [x] 3.7 Tag `chunk3`, update PARITY.md and the baseline `> **Tests:**` citations, then run `pnpm lint:specs`.
- [x] 3.8 **Checkpoint**: both suites green, and no temp files are left in the OS temp dir after the run.
- [x] 3.9 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 4 until the user says to continue.

## 4. Chunk 4: Network interception

- [x] 4.1 Write `robot/libraries/routes.cjs` (Browser jsextension; `.cjs` because the root package is ESM, see the D8 spike outcome) exporting `fulfillRoute`, `holdRoute`, `releaseRoute` and `clearRoutes` per design D8. Load it from `common.resource`.
- [x] 4.2 Spike: a throwaway test proves that a held route keeps the UI in flight until `Release Route`. If the jsextension signature differs, adapt it (or fall back to built-in route keywords) and record the outcome in design.md.
- [x] 4.3 Port `llm-review.spec.ts` to `robot/suites/llm_review.robot` (22 tests). Cover the `Intercept Review` keyword with a configurable body, the in-flight `Reviewing…`/disabled assertions under a held route, overlay click at position 5,5, the cached result while the second request is held, and the 500 error body text.
- [x] 4.4 Port `SC-1.2.4` (POST-only 500 with GET passthrough) into `home.robot`.
- [x] 4.5 Delete the spike test. Tag `chunk4`, update PARITY.md and the baseline `> **Tests:**` citations, then run `pnpm lint:specs`.
- [x] 4.6 **Checkpoint**: both suites green.
- [x] 4.7 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 5 until the user says to continue.

## 5. Chunk 5: Multi-context and second identity

- [x] 5.1 Add `Open Second Context` (storage state argument, own page, switched back explicitly) and `Expect Response Status` (Promise To `Wait For Response` matcher on URL and method, then action, then status assertion) keywords to `session.resource`.
- [x] 5.1a Write `robot/resources/api.resource` with `Create API Session For    ${alias}    ${storage_state}`, which reads the storage-state JSON, extracts the `authjs.session-token` cookie, and calls RequestsLibrary `Create Session` against `${BASE_URL}` (design D15).
- [x] 5.2 Port `collaboration.spec.ts` to `robot/suites/collaboration.robot`: `SC-3.5.1`, `SC-3.1.2` (no re-seed, asserted in both contexts with `timeout=5s`), and `SC-3.5.2` tagged `skip` with the original reason.
- [x] 5.3 Port the API-contract block of `session-access-control.spec.ts` to `robot/suites/session_access_control_api.robot` (3 tests, RequestsLibrary only, no browser). The owner creates the session over `POST On Session`. The `user2` session asserts `expected_status=200` for GET (with body `id` matching), 200 for PATCH, and 403 for DELETE, and the owner's follow-up GET returns 200.
- [x] 5.3a Port the UX block to `robot/suites/session_access_control.robot` (3 tests): GET 200 on load, `.form-error` count 0, the PATCH 200 on model change plus persistence after `Reload`, and the PATCH 200 on prompt save.
- [x] 5.4 Tag `chunk5`, update PARITY.md and the baseline `> **Tests:**` citations, then run `pnpm lint:specs`.
- [x] 5.5 **Checkpoint**: both suites green, and a deliberately broken assertion (local only, then reverted) proves the second context really fails independently.
- [x] 5.6 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 6 until the user says to continue.

## 6. Chunk 6: Raw WebSocket auth

- [x] 6.1 Write `robot/libraries/WebSocketProbe.py` with a `Probe WebSocket Upgrade` keyword (url, optional cookie) that returns `opened`, `status` and `received_data`, with a 3 s backstop (design D9).
- [x] 6.2 Add a `Cookie Header From Context` keyword (join `Get Cookies` as `name=value; …`).
- [x] 6.3 Port `websocket-auth.spec.ts` to `robot/suites/websocket_auth.robot` (3 tests): no-cookie → not opened, 401, no data; valid cookie → opened, data received; malformed room → not opened, 401.
- [x] 6.4 Tag `chunk6`, update the baseline `> **Tests:**` citations, then run `pnpm lint:specs`.
- [x] 6.5 **Checkpoint**: both suites green, and every PARITY.md row reads `ported` (or `skip` for `SC-3.5.2`), with no `pending` rows.
- [x] 6.6 **STOP for user review**: report what changed and the checkpoint results, then wait. Do not start chunk 7 until the user says to continue.

## 7. Chunk 7: Gates and CI

- [ ] 7.1 Write `scripts/lint-robot-no-sleep.mjs` plus `scripts/lint-robot-no-sleep.test.ts` (it passes on clean files, fails on a `Sleep` call, and reports file and line). Add a `lint:robot` script.
- [ ] 7.2 Add `pnpm run lint:robot` to `.husky/pre-commit` and `test:all`.
- [ ] 7.3 Add an `e2e:all` script (`run-s test:e2e test:robot`). In `test:all`, replace `test:e2e` with `e2e:all` so the suites never run concurrently.
- [ ] 7.4 Update `.github/workflows/ci.yml`: add `robot/**`, `e2e/**` and `pyproject.toml` to both `paths` filters. Add `astral-sh/setup-uv`, cache Browser/Playwright downloads keyed on `uv.lock`, `pnpm test:robot:init`, a Lint robot step, `pnpm test:robot` after the e2e step, and `actions/upload-artifact` for `robot/results/` with `if: always()`.
- [ ] 7.5 **Checkpoint**: push a feature branch (only once the user asks for a commit) and confirm the CI job is green with both suites and the Robot report artifact attached.
- [ ] 7.6 **STOP for user review**: report what changed and the checkpoint results, then wait. This is the final chunk. Wait for the user's sign-off before any archive or commit.