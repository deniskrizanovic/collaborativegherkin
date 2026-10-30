## ADDED Requirements

### Requirement: Every editor-area suite has a business-language sibling

Next to each editor-area technical suite (`initial_content`,
`enter_progression`, `toolbar`, `visual_separation`, `image`, `data_table`,
`export`, `import`, `collaboration`, `llm_review`) the Robot suite SHALL
contain a business-language suite with the same base name and the suffix
`_bdd` (for example `robot/suites/toolbar_bdd.robot`). Each one MUST carry the
`bdd` tag in its `Test Tags`, plus the same area tag as its technical suite.
It MUST NOT replace the technical suite, and both MUST stay in
`pnpm test:robot`. `block_picker_bdd.robot` already exists and keeps this
form.

#### Scenario: A business-language suite runs next to its technical suite
> **Tests:** none
- **GIVEN** `robot/suites/toolbar.robot` and `robot/suites/toolbar_bdd.robot` both exist, and the second is tagged `bdd` and `toolbar`
- **WHEN** the developer runs `pnpm test:robot --include toolbar`
- **THEN** the tests of both suites run, and the command exits zero only when all of them pass

### Requirement: Business-language tests follow their spec scenario

Every test in a `bdd` suite SHALL be named `SC-x.y.z: <spec scenario title>`,
optionally followed by ` — <variant>`. `<spec scenario title>` MUST be the
title of exactly one `#### Scenario:` in `openspec/specs/**`, even where the
Playwright test title for that scenario differs. A test body MUST contain only
Given/When/Then/And/But steps. Each step MUST be a line of that scenario, or
that line followed by more words that make it concrete (a refinement). Taken
together, the tests for a scenario MUST exercise every one of its lines.
`pnpm lint:robot-steps` enforces these rules.

A technical test variant that matches no line of its scenario MUST stay
technical-only. A scenario with a line the browser cannot observe MUST get no
business-language test. `robot/PARITY.md` MUST list each exclusion and its
reason.

#### Scenario: A test named after the Playwright title instead of the spec title is rejected
> **Tests:** [`scripts/lint-robot-spec-steps.test.ts`](../../../../../scripts/lint-robot-spec-steps.test.ts) — fails on a test whose title matches no scenario
- **GIVEN** a `bdd` suite with a test named `SC-8.4.2: Saving new prompt persists it and closes modal`, while the spec title is `Saving new prompt persists to session and closes modal`
- **WHEN** `pnpm lint:robot-steps` runs
- **THEN** it fails and reports that no spec scenario has that title

#### Scenario: A spec line no business-language test exercises is rejected
> **Tests:** [`scripts/lint-robot-spec-steps.test.ts`](../../../../../scripts/lint-robot-spec-steps.test.ts) — fails on a step that drifted from the spec, and reports the uncovered spec line
- **GIVEN** `bdd` tests for `Export MD downloads markdown file in document order` that never add an image block
- **WHEN** `pnpm lint:robot-steps` runs
- **THEN** it fails and names the line `image blocks appear as inline images using ![alt](src) syntax`

#### Scenario: An excluded variant is recorded
> **Tests:** none
- **GIVEN** the technical test `SC-3.11.1: … — absent on Feature`, whose cursor is on a Feature block, which no line of the scenario describes
- **WHEN** the reader looks in `robot/PARITY.md`
- **THEN** the business-language section lists it as technical-only, with the reason

### Requirement: Then steps assert what their spec line says

Each business-language Then step SHALL assert the outcome its spec line
states, as far as the browser can observe it. When the spec line says more
than the technical counterpart asserts, the Then step MUST assert the spec
line, not copy the technical test's weaker check. For example, `the cursor is
placed at the start of the new block's text` MUST be asserted by typing into
the editor and checking that the text lands in the new block. When part of a
line happens on the server, the step MUST assert the part the browser can see,
and its `[Documentation]` MUST name the boundary. A step MUST keep every
robustness technique required of Robot tests: no fixed sleeps, wait for
counts to grow, click before typing, and held routes for in-flight state.

#### Scenario: Cursor placement is proven, not assumed
> **Tests:** none
- **GIVEN** a fresh session whose cursor is at the end of the Feature block
- **WHEN** the business-language test for `Enter at end of block inserts auto-progression type` presses Enter
- **THEN** its Then steps check that the new block right after Feature is a Scenario, and that text typed next appears in that block

#### Scenario: "Without a new API call" is counted
> **Tests:** none
- **GIVEN** one completed review, served from a fulfilled `/api/llm-review` route whose requests are being counted, with the result modal closed
- **WHEN** the user clicks "View last review"
- **THEN** the modal shows the earlier result, and the route has still seen exactly one request

### Requirement: Step keywords are organised by spec capability

Business-language step keywords SHALL live in `robot/resources/steps/`, one
resource per spec capability, named after the capability folder (for example
`steps/gherkin_editor.resource` for `openspec/specs/gherkin-editor/`). A step
whose text appears in scenarios of more than one capability MUST live in
`steps/shared.resource` instead. Each step keyword MUST be defined exactly
once across `robot/resources/`. Step keywords MUST be lower-case sentences;
technical helpers MUST be Title Case and MUST NOT appear in a `bdd` test body.
A step keyword MUST NOT contain a selector literal. It uses the selector
variables of `editor.resource` or of its own resource.

#### Scenario: A step shared by two capabilities is defined once
> **Tests:** none
- **GIVEN** the line `a user is in a session editor` appears in both `gherkin-editor` and `gherkin-export` scenarios
- **WHEN** the developer searches `robot/resources/` for a keyword with that name
- **THEN** exactly one definition is found, in `steps/shared.resource`

### Requirement: Steps declare the state they share

A step keyword that passes information to a later step through a test
variable SHALL list that variable in its `[Documentation]`, on a line that
starts with `Sets:` or `Reads:`. A step that reads a variable that no earlier
step has set MUST fail with a message naming the step that sets it, not with
Robot's generic "variable not found" error. Each `steps/*.resource` MUST list,
in its own `Documentation`, every shared variable its keywords set.

#### Scenario: A missing Given step is reported by name
> **Tests:** none
- **GIVEN** a `bdd` test that runs `Then focus moves to the next item in the list` without first running `Given the block picker menu is open`
- **WHEN** the test runs
- **THEN** it fails with a message saying that `the block picker menu is open` must run first

### Requirement: Technical helpers are shared, not duplicated

Technical keywords and selectors used by more than one Robot file SHALL be
defined once. `session.resource` covers sessions, the REST calls made through
the page, browser contexts and cookies. `editor.resource` covers editor
blocks, the toolbar, the block picker, image insertion, data tables and the
editor selectors. `files.resource` covers temp files and downloads. A suite
MUST NOT redefine a selector variable or keyword that one of these resources
provides. Moving a helper into a shared resource MUST NOT weaken any
assertion of the tests that use it.

#### Scenario: The picker selector has one definition
> **Tests:** none
- **GIVEN** the refactor is complete
- **WHEN** the developer searches `robot/` for `[style*="position: fixed"]`
- **THEN** it is defined only in `editor.resource`, and every suite or step resource that needs the picker uses that variable

#### Scenario: The refactor keeps every existing test green
> **Tests:** none
- **GIVEN** the technical suites and `block_picker_bdd.robot` now use the reorganised resources
- **WHEN** `pnpm test:robot` runs
- **THEN** every test that passed before the refactor still passes, and the 1 skipped test is still skipped

### Requirement: Requests to a fulfilled route can be counted

The `routes.cjs` keyword library SHALL let a test fulfil a route and later
read how many requests that route has served on the active page. The count
MUST NOT depend on a fixed delay.

#### Scenario: The count reflects every served request
> **Tests:** none
- **GIVEN** `/api/llm-review` is fulfilled through the counting keyword on the active page
- **WHEN** the page sends two review requests
- **THEN** the count keyword returns 2
