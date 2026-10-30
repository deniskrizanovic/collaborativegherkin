## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/51

## Why

When a session page loads, it fetches that session's AI settings (model and
prompt). When the fetch resolves, it writes them into component state without
checking anything. If the user opened "Edit prompt" and started typing before
that happens, a late response replaces their text with the stored or default
prompt. Clicking Save then stores the default (PATCH 200), and the edit is
lost without any warning. A late response can undo a model change the same
way.

This race made `SC-8.4.2` fail on the Dependabot vitest 5.0.5 PR
([run 40820690734](https://github.com/deniskrizanovic/collaborativegherkin/actions/runs/40820690734/job/123272215721)).
It can also hit real users on slow networks.

## What Changes

- The "Edit prompt" button and the model dropdown stay disabled until the
  session's settings have loaded. Once the load settles, whether it succeeds
  or fails, they become enabled. On failure the existing error banner shows
  and the defaults stay editable.
- The settings-load effect ignores responses that come back after the effect
  has been cleaned up. That covers an unmount, a `sessionId` change, and the
  React StrictMode double mount in dev.
- New regression tests, in both the Playwright and Robot suites, hold the
  settings GET open. They check that the controls are disabled while the load
  is pending, and that a prompt typed after the load persists on Save.
- Tests that read the model dropdown's value without clicking it first now
  wait for the control to become enabled. Before this change those reads
  depended on timing.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `llm-review`: "Selecting a model" and "Editing the review prompt" each gain
  a scenario stating that the control is disabled until the session's settings
  have loaded. Both requirement statements say that edits can no longer be
  overwritten by the initial load.

## Impact

- `src/app/sessions/[id]/SessionView.tsx`: the settings-load effect gets a
  `settingsLoaded` flag and a cleanup guard, and both controls get a
  `disabled` binding.
- `e2e/llm-review.spec.ts` and `robot/suites/llm_review.robot`: new
  delayed-load regression test, plus waits for the enabled state before
  reading the model value.
- `e2e/session-access-control.spec.ts` and
  `robot/suites/session_access_control.robot`: wait for the enabled state
  before reading the current model.
- `robot/PARITY.md`: a row for the new test.
- No API, schema, or dependency changes. The sync layer, `gherkin.ts`, auth,
  and export are untouched.
