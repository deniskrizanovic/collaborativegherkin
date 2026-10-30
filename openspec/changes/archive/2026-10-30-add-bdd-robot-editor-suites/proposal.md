## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/52

## Why

The business-language pilot (`robot/suites/block_picker_bdd.robot`,
`docs/robot-framework-evaluation.md` §6.7) showed that tests written as the
GIVEN/WHEN/THEN lines of their spec scenario read like the spec. The pilot
also made four assertions stronger. It covers one area, 9 tests, so it
cannot answer the open question in §6.7.2: does keyword reuse grow past 1.8
uses per keyword when there are more tests? The shared keywords are also
hard to follow. `editor_domain.resource` mixes business-language steps with
technical helpers and passes seven test variables between steps that no
test shows. The technical suites copy the same selectors and step sequences
(the picker selector three times, image insertion three times, "build
Feature to Then" three times, toolbar clicks everywhere). Some suites also
keep local helpers that duplicate `session.resource`. Writing many more BDD
tests on that base would copy those problems into every new suite.

## What Changes

- Add a business-language sibling `*_bdd.robot` next to each editor-area
  technical suite: `initial_content`, `enter_progression`, `toolbar`,
  `visual_separation`, `image`, `data_table`, `export`, `import`,
  `collaboration`, `llm_review`. Each follows the pattern of
  `block_picker_bdd.robot`: tagged `bdd`, every test body is GIVEN/WHEN/THEN
  steps only, and every step is a line (or a refinement of a line) of the
  test's OpenSpec scenario, checked by `pnpm lint:robot-steps`. That is about
  75 new tests.
- BDD test names use the **spec** scenario title, prefixed with `SC-x.y.z:`.
  These titles differ from the Playwright titles for `SC-3.7.1`, `SC-3.7.2`,
  `SC-8.3.1` and `SC-8.4.2`.
- Every line of a spec scenario must be exercised by its BDD tests, so several
  BDD tests check things their technical counterparts do not: where the
  cursor is after Enter or a toolbar insert, the image line in an MD export,
  the separator missing from the export for `SC-3.7.2`, the reopened prompt
  after Cancel showing the old text, no new review request on "View last
  review", the button state after a review fails, and the pre-selected
  model. Technical suites and Playwright tests are not changed to match.
- Some technical variants have no matching spec line (for example "Table
  button absent on Feature", "expected models listed", "first Given after
  Scenario has no border"). They stay technical-only. One scenario has a line
  the browser cannot observe (`SC-8.4.2`, "the next review uses the updated
  prompt"), so that scenario gets no BDD test. The skipped `SC-3.5.2` also
  gets no BDD test. Three scenarios have a line the app does not satisfy
  (`SC-3.2.2`, `SC-3.8.3`, `SC-3.11.2`); they get no BDD test until the app
  bugs #53, #54 and #55 are fixed. `robot/PARITY.md` lists each exclusion and its reason.
- Review and reorganise the shared keywords:
  - Business-language steps move from `editor_domain.resource` into
    `robot/resources/steps/`: one resource per spec capability, plus
    `shared.resource` for steps whose text appears in more than one
    capability (for example `a user is in a session editor`,
    `the user presses Escape`).
  - Technical helpers are split by what they touch. `session.resource`
    keeps sessions, the API, contexts and cookies. A new `editor.resource`
    takes block, toolbar, picker, image and table helpers and the shared
    selectors. `files.resource` is unchanged.
  - Duplicated selectors and sequences in the technical suites are replaced
    by the shared keywords. No assertion gets weaker.
  - One written convention for keyword naming, step refinement, and the
    test variables steps share (each keyword documents which variables it
    sets and reads; reading one that no earlier step set fails with a
    message naming that step).
- Extend `robot/libraries/routes.cjs` with a request counter for a fulfilled
  route, so "without a new API call" can be asserted.
- Update the `> **Tests:**` lines of the covered scenarios in
  `openspec/specs/**`, `robot/README.md` (how to write a BDD test),
  `robot/PARITY.md`, and the reuse figures in the evaluation doc §6.7.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `robot-e2e-suite`: adds requirements for business-language suites across
  the editor areas, how they relate to spec scenarios, how step keywords are
  organised and share state, and how technical helpers are deduplicated.

The behaviour specs (`gherkin-editor`, `gherkin-export`, `gherkin-import`,
`realtime-collaboration`, `llm-review`) do not change. Only their
`> **Tests:**` lines gain links to the new suites.

## Impact

- **New files**: `robot/suites/*_bdd.robot` (10 suites),
  `robot/resources/steps/*.resource`, `robot/resources/editor.resource`.
- **Changed files**: `robot/resources/session.resource`,
  `editor_domain.resource` (removed; its steps move to
  `steps/gherkin_editor.resource` and `steps/shared.resource`), the
  technical suites under `robot/suites/` (imports and deduplicated helpers
  only), `robot/suites/block_picker_bdd.robot` (imports),
  `robot/libraries/routes.cjs`, `robot/README.md`, `robot/PARITY.md`,
  `docs/robot-framework-evaluation.md`, and the `Tests:` lines in
  `openspec/specs/**`.
- **Not touched**: application code, `src/lib/gherkin.ts`, the Playwright
  suite in `e2e/`, `scripts/lint-robot-spec-steps.mjs` (the existing lint is
  enough), CI and husky wiring (both already run `lint:robot-steps` and
  `test:robot`).
- **Run time**: about 75 more browser tests in `pnpm test:robot`, so roughly
  45 s more at the current rate (107 tests in 67 s).
