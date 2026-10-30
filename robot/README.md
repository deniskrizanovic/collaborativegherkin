# Robot Framework e2e suite

A second e2e suite, written in [Robot Framework](https://robotframework.org/)
with the [Browser library](https://robotframework-browser.org/) (which drives
Playwright underneath). It runs alongside the Playwright TypeScript suite in
`e2e/`, which stays in place. Every Playwright test has one Robot counterpart;
`PARITY.md` tracks the mapping.

## Install and run

Prerequisites: Node, pnpm and [`uv`](https://docs.astral.sh/uv/) (`brew install uv`).
You never need to activate a virtualenv; `uv` manages `.venv/` for you.

```bash
pnpm test:robot:init    # once, and after pyproject.toml / uv.lock change:
                        #   uv sync --locked && uv run rfbrowser init chromium
pnpm test:robot         # run every suite under robot/suites/
```

`pnpm test:robot` (`scripts/run-robot.mjs`):

1. mints the auth storage states `e2e/.auth/user.json` and `user2.json` with
   the same `e2e/global-setup.ts` that Playwright uses;
2. reuses a dev server already listening on `http://localhost:3000`, or starts
   `pnpm dev` and stops it again afterwards;
3. runs `uv run robot --outputdir robot/results robot/suites`;
4. exits with Robot's exit code (non-zero when any test fails).

Do not run it at the same time as `pnpm test:e2e`: both suites share one
SQLite database, and some tests delete every session.

### Run part of the suite

Any extra arguments are passed straight to `robot`:

```bash
pnpm test:robot --include chunk1                  # one chunk, by tag
pnpm test:robot --include smoke                   # any tag
pnpm test:robot --test "SC-7.1.4*"                # one test, by name (glob)
pnpm test:robot --suite import                    # one suite file (import.robot)
pnpm test:robot --variable HEADLESS:False         # watch the browser
pnpm test:robot --variable SCREENSHOTS:True       # screenshot every test, not only failures
pnpm test:robot --variable TRACE:True             # Playwright trace per test (see below)
pnpm test:robot --exclude skip                    # leave out skipped tests
```

### Read the results

Robot writes to `robot/results/` (git-ignored):

- `report.html` — pass/fail overview; start here.
- `log.html` — every keyword of every test, with arguments, timings, and a
  screenshot on failure. Click a failing test to expand it.
- `output.xml` — machine-readable; used by CI.

Open them with `open robot/results/log.html`.

Each run clears `robot/results/` first, so everything there is from the last run.

### Playwright trace viewer

With `--variable TRACE:True`, every test writes a Playwright trace to
`robot/results/traces/<test name>.zip`. Open one in the same trace viewer the
Playwright suite uses (timeline, before/after DOM snapshots, network, console):

```bash
uv run rfbrowser show-trace robot/results/traces/Smoke_new_session_shows_the_scaffold_blocks_in_order.zip
```

Tests that open extra contexts pass `tracing=` from `Trace File For Test` with a
suffix (for example `Trace File For Test    _user2`), so each context gets its
own zip.

## Layout

```
robot/
  README.md          this file
  PARITY.md          Playwright test → Robot test, status per row
  resources/         shared keywords and variables (*.resource)
    variables.resource  globals (${BASE_URL}, storage states)
    common.resource  Browser import, suite/test setup and teardown
    api.resource     RequestsLibrary sessions for the browser-free API suite
    session.resource sessions, REST calls through the page, contexts,
                     cookies, response waits, AI review selectors
    editor.resource  editor selectors and helpers: blocks, toolbar, picker,
                     images, data tables, export and import controls
    files.resource   temp files and downloads
    steps/           business-language steps, one file per spec capability
      shared.resource            steps whose text is in more than one capability
      gherkin_editor.resource    openspec/specs/gherkin-editor
      gherkin_export.resource    openspec/specs/gherkin-export
      gherkin_import.resource    openspec/specs/gherkin-import
      realtime_collaboration.resource  openspec/specs/realtime-collaboration
      llm_review.resource        openspec/specs/llm-review
  libraries/         Python / JS keyword libraries (routes.cjs, WebSocketProbe.py)
  suites/            one technical *.robot file per e2e/*.spec.ts, plus one
                     business-language <area>_bdd.robot twin per editor area
  results/           output (git-ignored)
```

## Writing a business-language test

A `bdd` suite (`suites/<area>_bdd.robot`, tag `bdd`) tells the same story as
its spec: each test is the GIVEN/WHEN/THEN lines of one scenario of
`openspec/specs/`, word for word. The technical `<area>.robot` next to it
keeps the Playwright port. `pnpm lint:robot-steps` (pre-commit hook and CI)
checks every `bdd` test against its scenario:

- the test is named `SC-x.y.z: <spec scenario title>[ — <variant>]`;
- each step is a line of that scenario, with the same kind (Given / When /
  Then; `And` / `But` take the kind before them), or that line refined (see
  below). Backticks are dropped and case is ignored;
- across all tests of a scenario, every line of it is used at least once.

### Refining a line

A step either equals its spec line or adds words after it. Pick the form by
how the line ends:

| Spec line ends in… | Refine with | Example |
|---|---|---|
| a noun the detail qualifies | a plain phrase | `Given the cursor is at the end of a block of type Feature` |
| a full clause (expected values, a branch of an "or" line) | ` — <detail>` | `When the user clicks "Cancel" or presses Escape or clicks outside the panel — Escape` |

Test data, such as a document to type or a text to import, lives in the
suite's `*** Variables ***`, and the step refers to it with `with ${NAME}`:
`Given the user pastes or types Gherkin text into the textarea and clicks
Insert with ${MARKDOWN_PREFIXED}`. Expected values are test data too, passed
after ` — `. A step never works out an expected value from a rule table of its
own (that would copy `src/lib/gherkin.ts`); the one exception is the
valid-next lists, kept once in `&{VALID_NEXT_LABELS}` /
`&{INVALID_NEXT_LABELS}` in `steps/gherkin_editor.resource`.

### Where a keyword goes

- **A step** goes in `steps/<capability>.resource`, the capability whose
  `openspec/specs/<capability>/spec.md` holds the line. If the same text
  appears in more than one capability, it goes in `steps/shared.resource`.
  Each step is defined once across `resources/`.
- **A helper** goes where its subject is: `editor.resource` for the editor,
  `session.resource` for sessions and the session page, `files.resource` for
  files. A suite never redefines a selector or keyword these provide.
- **Selectors** are variables of `editor.resource` or `session.resource`. A
  step keyword never contains a selector literal.
- **Naming**: steps are lower-case sentences copied from the spec line;
  helpers are Title Case verb phrases (`Insert Image After Block`). A `bdd`
  test body calls steps only.
- **Synonyms**: when two lines mean the same thing (`a user is in a session
  editor` / `a user is on a session page`), the second keyword calls the
  first and its `[Documentation]` says so.
- **Imports**: a `steps/` file imports `shared.resource`, `editor.resource`
  and `session.resource`; a `bdd` suite imports `common.resource` and the
  `steps/` files it uses.

### Passing state between steps

A test body holds steps only, so steps share state through test variables.
The contract:

- a step's `[Documentation]` ends with `Sets:` and/or `Reads:` lines naming
  its variables;
- each `steps/*.resource` lists, in its `Documentation`, every variable its
  keywords set, with its meaning;
- a step that reads one starts with `Require Step State    NAME    <step that
  sets it>`. Run without that step, it fails with `"<step>" must run before
  this step (${NAME} is not set)` instead of Robot's "variable not found".

### Then steps check what the spec line says

A Then step asserts its whole line, even when the technical test checks less.
For example, "the cursor is placed at the start of the new block's text" types
and checks that the text lands in the new block. When part of a line happens
on the server, the step asserts what the browser can see and its
`[Documentation]` names the boundary (for example, the review request's body
carries the editor's content; the OpenRouter call is covered by unit tests).
The usual robustness rules still hold: no fixed waits, wait for counts to
grow, click before typing, and held routes for in-flight states.

### When a scenario gets no business-language test

A scenario is left out only when a line cannot be asserted:

- the line cannot be seen from the browser (`SC-8.4.2`, "the next review uses
  the updated prompt");
- the technical test is skipped (`SC-3.5.2`);
- the app does not do what the line says. Open a GitHub issue and leave the
  scenario out until it is fixed (`SC-3.2.2` #53, `SC-3.8.3` #54, `SC-3.11.2`
  #55). Never weaken the step to make it pass.

Name the exclusion and its reason in the suite's `Documentation` and in
`PARITY.md`. Technical variants with no matching line (for example "Table
button absent on Feature") stay technical-only.

### Worked example

Spec `SC-8.8.2` in `openspec/specs/llm-review/spec.md`:

```
#### Scenario: View last review reopens modal without new API call
- **GIVEN** the "View last review" button is visible
- **WHEN** the user clicks it
- **THEN** the result modal reopens showing the same result without a new API call
```

The test in `suites/llm_review_bdd.robot` repeats it:

```robot
SC-8.8.2: View last review reopens modal without new API call
    Given the "View last review" button is visible
    When the user clicks it
    Then the result modal reopens showing the same result without a new API call
```

`When the user clicks it` is in `steps/shared.resource`, because the line
also appears in `gherkin-editor`. The Given and Then are in
`steps/llm_review.resource`:

```robot
the "View last review" button is visible
    [Documentation]    Open a fresh session, complete a review, close the result
    ...    modal and wait for "View last review". "it" in the next step is
    ...    that button.
    ...    Sets: ${SESSION_ID}, ${REVIEW_SHOWN}, ${IT_SELECTOR}.
    a review has completed and the result modal has been closed
    Wait For Elements State    ${VIEW_LAST_BUTTON}    visible
    Set Test Variable    ${IT_SELECTOR}    ${VIEW_LAST_BUTTON}

the result modal reopens showing the same result without a new API call
    [Documentation]    The result modal shows the text it showed for the first
    ...    review, and /api/llm-review has still served exactly one request.
    ...    Reads: ${REVIEW_SHOWN}.
    Require Step State    REVIEW_SHOWN    the "View last review" button is visible
    Wait For Elements State    ${REVIEW_MODAL}    visible
    Get Text    ${REVIEW_MODAL_BODY}    ==    ${REVIEW_SHOWN}
    ${count}=    Route Request Count    ${REVIEW_URL}
    Should Be Equal As Integers    ${count}    1
```

The review is served by `Fulfill Counted Route` (`routes.cjs`), so "without a
new API call" is a count, not a fixed wait. Last, add the suite to the
scenario's `> **Tests:**` line (`pnpm lint:specs`) and a row to `PARITY.md`.

## Robot syntax in five minutes

Start with `suites/00_smoke.robot`; it is commented line by line.

### Sections

A `.robot` file is made of sections, each opened with `*** Name ***`:

```robot
*** Settings ***
Resource            ../resources/common.resource
Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page

*** Variables ***
${TITLE}            My session

*** Test Cases ***
SC-1.2.1: Valid title creates session and redirects
    [Tags]    chunk1    home
    Open Session    ${TITLE}
    Get Url    *=    /sessions/

*** Keywords ***
My Helper Keyword
    [Arguments]    ${name}
    Log    Hello ${name}
```

`.resource` files contain only `Settings`, `Variables` and `Keywords`.

### Cells are separated by 2+ spaces

This is the rule that catches everyone. Inside a line, **two or more spaces**
separate cells; a single space is part of the value. We use **4 spaces**.

```robot
Click    [data-gherkin-type="feature"]       # keyword + 1 argument
Get Element Count    .modal    ==    0       # keyword + 3 arguments
Open Session                                 # "Open Session" is ONE keyword name
```

Test and keyword names start in column 1; their steps are indented.
A line starting with `...` continues the previous line.

### Variables

| Syntax | Meaning |
|---|---|
| `${x}` | scalar |
| `@{list}` | list, expanded into separate cells |
| `&{dict}` | dictionary |
| `${x}=    Some Keyword` | store a keyword's return value |
| `${resp}[body][id]` | index into a dict / list |
| `${CURDIR}` | directory of the current file |

Globals live in `variables.resource` (`${BASE_URL}`, `${OWNER_STATE}`,
`${OTHER_STATE}`), shared by `common.resource` (browser suites, adds
`${HEADLESS}`) and `api.resource` (browser-free RequestsLibrary suites).

### Keywords

A keyword is a reusable step, like a function. Keywords come from libraries
(`Browser`, `BuiltIn`, `Collections`, ...) or from our `*.resource` files.
Names are case- and space-insensitive. Define one with `[Arguments]` and
`RETURN`:

```robot
Toolbar Button
    [Arguments]    ${label}
    RETURN    .gherkin-toolbar-btn:has-text("${label}")
```

### Tags

`[Tags]    chunk1    home` on a test. Every test carries its chunk tag
(`chunk0` … `chunk6`) and an area tag; business-language tests carry `bdd`
instead of a chunk tag. Select with `--include` / `--exclude`.
The tag `skip` marks a ported `test.skip`.

### Setup and teardown

- `Suite Setup` / `Suite Teardown` run once per file.
- `Test Setup` / `Test Teardown` run around every test.
- `[Setup]` / `[Teardown]` inside a test override them for that test.

A teardown always runs, even when the test fails — Robot's `try/finally`.
Browser closes every context and page a test opened automatically at the end
of the test, so second-user contexts never leak.

### Assertions retry

Browser's `Get ...` keywords take an optional assertion
(`Get Text    .title    ==    Hello`). With an assertion they **retry until
the 5 s browser timeout**, exactly like Playwright's `expect(...)`. That is why
the suite never uses `Sleep`: it is forbidden, and `pnpm lint:robot` (run by the
pre-commit hook and CI) fails on any `Sleep` call or inline delay
(`time.sleep(`, `setTimeout(`, `waitForTimeout(`) in `robot/suites/` or
`robot/resources/`, and on any such delay in `robot/libraries/`.

## Playwright → Browser cheat-sheet

| Playwright | Browser library |
|---|---|
| `expect(loc).toHaveCount(n)` | `Get Element Count    ${sel}    ==    ${n}` |
| `toContainText` / `toHaveText` | `Get Text    ${sel}    *=    text` / `Get Text    ${sel}    ==    text` |
| `toHaveValue` | `Get Property    ${sel}    value    ==    text` |
| `toBeVisible` / `not.toBeVisible` | `Wait For Elements State    ${sel}    visible` / `hidden` |
| `toBeDisabled` / `toBeFocused` | `Wait For Elements State    ${sel}    disabled` / `focused` |
| `locator(x, { hasText })` | `x:has-text("…")` |
| `.last()` / `.nth(i)` | `x >> nth=-1` / `x >> nth=${i}` |
| `page.waitForFunction(count > before)` | `Get Element Count    ${sel}    >    ${before}` (or `Wait For Function`) |
| `keyboard.press("Enter")` | `Keyboard Key    press    Enter` |
| `keyboard.type("text")` | `Keyboard Input    type    text` |
| `mouse.click(10, 10)` | `Mouse Button    click    10    10` |
| `click({ position: { x: 5, y: 5 } })` | `Click With Options    ${sel}    position_x=5    position_y=5` |
| `page.request.post(...)` as setup | `Http    ${BASE_URL}/api/sessions    POST    {"title": "…"}` |
| `request.newContext({ storageState })` API test | RequestsLibrary: `Create API Session For    other    ${OTHER_STATE}` → `DELETE On Session    other    /api/sessions/${id}    expected_status=403` |
| `Promise.all([waitForResponse(pred), action])` | `${p}=    Promise To    Wait For Response    matcher=…` → action → `${r}=    Wait For    ${p}` |
| `waitForEvent("download")` + `saveAs` | `${p}=    Promise To Wait For Download    ${path}` → click → `${d}=    Wait For    ${p}` → `${d}[suggestedFilename]` |
| `setInputFiles` | `Upload File By Selector    input[type="file"]    ${png}` |
| `evaluate` / `evaluateAll` | `Evaluate JavaScript    ${sel}    (el) => …` (`all_elements=True` for evaluateAll) |
| `getComputedStyle(el).x` / `toHaveCSS` | `Get Style    ${sel}    border-top-width    ==    1px` |
| `context.grantPermissions` | `Grant Permissions    clipboard-read    clipboard-write` |
| `page.route(...).fulfill` / held route | `routes.cjs` jsextension (`Fulfill Route`, `Hold Route`, `Release Route`) |
| raw `ws` client | `WebSocketProbe.py` (`Probe WebSocket Upgrade`) |
| `page.goto(url)` / `page.url()` | `Go To    ${url}` / `Get Url    *=    /sessions/` |

### Shared keywords (ports of `e2e/helpers.ts`)

| `helpers.ts` | `session.resource` |
|---|---|
| `createSession(page, title)` | `${id}=    Create Session Via API    ${title}` |
| `openSession(page, title?)` | `${id}=    Open Session    ${title}` |
| `pressEnterAndWait(page, type)` | `Press Enter And Wait For Block    ${type}` |
| `clickEditor(page)` | `Click Editor` |
| `evaluateAll(data-gherkin-type)` | `${types}=    Block Types In Editor` |
| `.gherkin-toolbar-btn` with text | `${btn}=    Toolbar Button    Scenario` |
| `context.cookies()` joined `name=value; …` | `${cookie}=    Cookie Header From Context` |

Always click the target block before sending keyboard input: Tiptap's focus
is not the DOM's focus.
