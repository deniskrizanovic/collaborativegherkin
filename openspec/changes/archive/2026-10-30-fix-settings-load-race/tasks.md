## 1. Test infrastructure

- [x] 1.1 Add an optional `method = null` parameter to `holdRoute` in `robot/libraries/routes.cjs`. Put it in the same position as in `fulfillRoute`. When it is set, other methods `route.continue()`. Update the `rfdoc` string (design D3).
- [x] 1.2 Confirm the existing `Hold Route` callers in `robot/suites/llm_review.robot` still pass with three arguments (`pnpm test:robot --include llm-review`).

## 2. Regression tests (write first, expect red)

- [x] 2.1 In `e2e/llm-review.spec.ts`, add `SC-8.3.4: Model dropdown is disabled until session settings have loaded — controls disabled while settings load is pending`. Before `openSession`, hold the `**/api/sessions/*` GET with `page.route` (any other method falls back). Assert that `.session-edit-prompt-btn` and `.session-model-select` are disabled. Release the route, then assert both are enabled.
- [x] 2.2 In `e2e/llm-review.spec.ts`, add `SC-8.4.6: A prompt edited after a slow settings load is the one saved`. Hold the GET, then release it. Edit and save a new prompt, then `page.unrouteAll()` and reload. Reopening "Edit prompt" must show the saved prompt.
- [x] 2.3 In `e2e/llm-review.spec.ts`, add `SC-8.4.7: Failed settings load leaves the default prompt editable`. Fulfill the GET with 500. Assert that the `.form-error` text is `Couldn't load this session's AI settings.`. Then assert that "Edit prompt" opens the modal with the default prompt in the textarea.
- [x] 2.4 Port 2.1–2.3 to `robot/suites/llm_review.robot` with the same titles. Use `Hold Route … GET`, `Release Route`, `Fulfill Route … GET`, and `Clear Routes`, with no `Sleep`.
- [x] 2.5 Run both suites and confirm that 2.1 and its Robot port fail against the current code (the controls are enabled during the pending load).

## 3. Fix in SessionView

- [x] 3.1 In `src/app/sessions/[id]/SessionView.tsx`, add `loadedSessionId` state and derive `settingsLoaded = loadedSessionId === sessionId`. Set `loadedSessionId` to `sessionId` when the load settles: on success, on a non-OK response, and in `.catch` (design D1, D2).
- [x] 3.2 Add a `cancelled` flag to the settings effect. Skip every state update when it is set, and return a cleanup that sets it (design D2).
- [x] 3.3 Bind `disabled={!settingsLoaded}` on `.session-edit-prompt-btn`, and `disabled={reviewing || !settingsLoaded}` on `.session-model-select`.
- [x] 3.4 In `src/app/globals.css`, give `.session-edit-prompt-btn:disabled` the same look as `.session-model-select:disabled` (opacity 0.5, `not-allowed` cursor). Limit its hover rule to `:not(:disabled)`.
- [x] 3.5 Re-run the tests from section 2 and confirm they now pass.

## 4. Harden existing tests that read the model value

- [x] 4.1 In `e2e/llm-review.spec.ts`, in the SC-8.1.2 "header shows model name" test, add `await expect(select).toBeEnabled()` before `inputValue()`.
- [x] 4.2 In `e2e/session-access-control.spec.ts`, in "a second user can change the model and it persists", wait for the select to be enabled before reading `current`.
- [x] 4.3 In `robot/suites/llm_review.robot` (SC-8.1.2 header test) and `robot/suites/session_access_control.robot` (change model test), add `Wait For Elements State    ${MODEL_SELECT}    enabled` before `Get Property … value`.

## 5. Docs and traceability

- [x] 5.1 Add rows for SC-8.3.4, SC-8.4.6, and SC-8.4.7 to `robot/PARITY.md` under `llm-review.spec.ts`, with status `ported`.
- [x] 5.2 Check that the `> **Tests:**` lines in `specs/llm-review/spec.md` cite the cases that now exist.

## 6. Verify

- [x] 6.1 `pnpm lint`, `pnpm lint:specs`, `pnpm lint:given`, `pnpm lint:robot`, and `pnpm test` all pass.
- [x] 6.2 The full Playwright e2e suite passes.
- [x] 6.3 The full Robot suite (`pnpm test:robot`) passes. Run `llm_review.robot` three times in a row with no failures, to show SC-8.4.2 is no longer flaky.
- [x] 6.4 Manual check in `pnpm dev`: on a throttled network (DevTools "Slow 4G"), "Edit prompt" and the model select are disabled briefly, then enable with the stored values.
