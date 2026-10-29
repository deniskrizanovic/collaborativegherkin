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
