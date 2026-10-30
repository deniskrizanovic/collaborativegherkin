# robot-e2e-suite Specification

## Purpose

TBD - created by archiving change add-robot-framework-e2e-suite. Update Purpose after archive.

## Requirements

### Requirement: The Robot suite installs and runs with one command

The project SHALL provide a Robot Framework e2e suite under `robot/` that uses the
`robotframework-browser` library. Python dependencies MUST be pinned in
`pyproject.toml` and `uv.lock` and managed by `uv`. A `pnpm test:robot:init`
script MUST install the Python dependencies and the Browser library's Playwright
runtime (`rfbrowser init`). A `pnpm test:robot` script MUST mint the auth storage
states, run every suite under `robot/suites/`, and exit non-zero when any test
fails. Robot output (`output.xml`, `log.html`, `report.html`) MUST be written to
`robot/results/`, which MUST be git-ignored.

#### Scenario: A fresh checkout runs the Robot suite
> **Tests:** none
- **GIVEN** a fresh clone with Node, pnpm and `uv` installed, and the dev server reachable at `http://localhost:3000`
- **WHEN** the developer runs `pnpm test:robot:init` followed by `pnpm test:robot`
- **THEN** every Robot suite runs, the process exits zero when all tests pass, and `robot/results/report.html` exists

#### Scenario: A failing Robot test fails the command
> **Tests:** none
- **GIVEN** a Robot test whose assertion does not hold against the running app
- **WHEN** `pnpm test:robot` runs
- **THEN** the command exits non-zero and the report names the failing test

### Requirement: The Robot suite authenticates through the shared storage states

The Robot suite SHALL authenticate by loading the same NextAuth storage-state files
that the Playwright suite uses (`e2e/.auth/user.json` for the owner and
`e2e/.auth/user2.json` for a second, distinct user). These files are minted by the
existing `e2e/global-setup.ts`. The Robot suite MUST NOT re-implement JWT encoding,
and MUST NOT sign in through the UI or the dev-login bypass.

#### Scenario: Default context is signed in as the owner
> **Tests:** none
- **GIVEN** the storage states have been minted by `e2e/global-setup.ts`
- **WHEN** a Robot test opens a new browser context with the default identity and visits `/`
- **THEN** the home page renders the create-session form rather than the sign-in page

#### Scenario: A second identity is available for collaborator paths
> **Tests:** none
- **GIVEN** the storage states have been minted, including `user2.json`
- **WHEN** a Robot test opens a context with the second identity on a session owned by the default identity
- **THEN** the server treats the requests as coming from a non-owner (for example, a DELETE returns 403)

### Requirement: API-contract tests run through RequestsLibrary

Robot tests that assert the HTTP status contract of the REST API directly SHALL
use RequestsLibrary (`robotframework-requests`), not the Browser library. They MUST
authenticate with the `authjs.session-token` cookie taken from the same
storage-state files (`user.json`, `user2.json`), and MUST NOT open a browser.

#### Scenario: Non-owner DELETE is refused over a browserless API session
> **Tests:** none
- **GIVEN** a session created by the owner over a RequestsLibrary session authenticated from `user.json`
- **WHEN** a RequestsLibrary session authenticated from `user2.json` sends `DELETE /api/sessions/<id>`
- **THEN** the response status is 403, and the owner's follow-up `GET /api/sessions/<id>` returns 200

### Requirement: Every Playwright test has a Robot counterpart

Every `test(...)` in `e2e/*.spec.ts` SHALL have exactly one Robot test case that
exercises the same behaviour with assertions at least as strong. A `test.skip`
SHALL map to a Robot test tagged `skip` with the same reason. Each Robot test name
MUST keep the `SC-x.y.z` identifier from the Playwright title when one is present.
A checklist at `robot/PARITY.md` MUST list every Playwright test title next to its
Robot suite and test name, and MUST be updated in the same chunk that ports the test.

#### Scenario: A ported test keeps its scenario identifier
> **Tests:** none
- **GIVEN** the Playwright test `SC-7.1.4: Cancel closes modal without inserting` in `e2e/import.spec.ts`
- **WHEN** it is ported
- **THEN** `robot/suites/import.robot` contains a test case whose name begins `SC-7.1.4:`, and `robot/PARITY.md` maps the two

#### Scenario: The parity checklist is complete at the end
> **Tests:** none
- **GIVEN** all chunks of this change are complete
- **WHEN** the Playwright test titles in `e2e/*.spec.ts` are compared with `robot/PARITY.md`
- **THEN** every title appears with a Robot counterpart and no row is marked pending

### Requirement: Robot tests preserve the Playwright suite's robustness techniques

Robot tests SHALL keep every robustness technique of the Playwright test they port.
They MUST NOT replace one with a weaker form. In particular:

- **No fixed sleeps.** Waits MUST use Browser's auto-waiting assertions (`Get Element Count`, `Get Text`, `Get Attribute` with an assertion operator), `Wait For Elements State`, `Wait For Condition`, or `Wait For Function`. `Sleep` and inline delays (`time.sleep(`, `setTimeout(`, `waitForTimeout(`) are forbidden in `robot/suites/**` and `robot/resources/**`, and fixed delays are forbidden in the keyword libraries under `robot/libraries/**`.
- **Wait for a count to grow before acting**, as `pressEnterAndWait` does, rather than assuming a keypress has taken effect.
- **Click the editor block before sending keyboard input**, because Tiptap focus differs from DOM focus.
- **Isolated browser contexts** for multi-user sync tests, so `BroadcastChannel` cannot bridge them and sync has to go through the WebSocket server.
- **Held network routes** that keep a request in flight until the test releases it, for in-flight UI-state assertions.
- **Response-status assertions** on the real request the UI fires (GET or PATCH), not only on the visible outcome.
- **Download content assertions**: the suggested filename and the downloaded file's lines are checked, not only that a download happened.
- **Raw WebSocket upgrade probes** with an exactly controlled `Cookie` header, asserting no open, a 401 status, and no data received.
- **Guaranteed cleanup** of extra contexts and temp files through teardown (`[Teardown]` or `Run Keyword And Ignore Error` blocks), equivalent to `try/finally`.
- **Synthetic DOM events** where the Playwright test uses them (native value setter for over-length input, `DataTransfer` drop) and **computed-style assertions** where it uses them.

#### Scenario: In-flight state is asserted while a request is held
> **Tests:** none
- **GIVEN** an open session whose `/api/llm-review` route is held by the test
- **WHEN** the user clicks Get AI Coaching
- **THEN** the button reads `Reviewing…` and is disabled, the model select is disabled, and only after the test releases the route does the result modal appear and the button re-enable

#### Scenario: Sync is proven across isolated contexts
> **Tests:** none
- **GIVEN** a session open in two separate browser contexts signed in as the same user
- **WHEN** text is typed into the Feature block in the first context
- **THEN** the second context's Feature block contains that text within 5 seconds

#### Scenario: Unauthenticated WebSocket upgrade is refused
> **Tests:** none
- **GIVEN** an existing session and a raw WebSocket client sending no cookie
- **WHEN** the client requests an upgrade to `ws://localhost:3000/session-<id>`
- **THEN** the upgrade does not open, the response status is 401, and no data is received

#### Scenario: A fixed sleep is rejected
> **Tests:** [`scripts/lint-robot-no-sleep.test.ts`](../../../scripts/lint-robot-no-sleep.test.ts) — fails on a Sleep call and reports file and line
- **GIVEN** a Robot suite or resource file that contains a `Sleep` keyword call
- **WHEN** the Robot lint check runs
- **THEN** it fails and names the file and line

### Requirement: The port is delivered in independently green chunks

The port SHALL be delivered in ordered chunks. Each chunk ports a defined set of
Playwright files. A chunk MUST NOT be marked complete until `pnpm test:robot` and
`pnpm test:e2e` both pass with that chunk's suites included, and `robot/PARITY.md`
reflects the ported tests.

#### Scenario: A completed chunk leaves both suites green
> **Tests:** none
- **GIVEN** a chunk's Robot suites have been written
- **WHEN** `pnpm test:robot` and `pnpm test:e2e` run against the same dev server
- **THEN** both exit zero, and the chunk's rows in `robot/PARITY.md` are marked ported

### Requirement: The Robot suite runs in CI alongside Playwright

CI SHALL run the Robot suite after the Playwright e2e step, in the same job and
against the same seeded database and dev server. A Robot failure MUST fail the CI
job. The `robot/results/` directory MUST be uploaded as a build artifact whether
the step passes or fails. The Playwright suite MUST remain in place and keep running.

#### Scenario: A Robot failure fails CI and the report is kept
> **Tests:** none
- **GIVEN** a pull request in which one Robot test fails
- **WHEN** the CI workflow runs
- **THEN** the job fails, and the Robot `log.html` and `report.html` are downloadable as an artifact

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
> **Tests:** [`scripts/lint-robot-spec-steps.test.ts`](../../../scripts/lint-robot-spec-steps.test.ts) — fails on a test whose title matches no scenario
- **GIVEN** a `bdd` suite with a test named `SC-8.4.2: Saving new prompt persists it and closes modal`, while the spec title is `Saving new prompt persists to session and closes modal`
- **WHEN** `pnpm lint:robot-steps` runs
- **THEN** it fails and reports that no spec scenario has that title

#### Scenario: A spec line no business-language test exercises is rejected
> **Tests:** [`scripts/lint-robot-spec-steps.test.ts`](../../../scripts/lint-robot-spec-steps.test.ts) — fails on a step that drifted from the spec, and reports the uncovered spec line
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
