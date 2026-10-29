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
                        #   uv sync && uv run rfbrowser init chromium
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
    common.resource  Browser import, variables, suite/test setup
    session.resource ports of e2e/helpers.ts (Open Session, ...)
  libraries/         Python / JS keyword libraries
  suites/            one *.robot file per e2e/*.spec.ts
  results/           output (git-ignored)
```

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
(`chunk0` … `chunk6`) and an area tag. Select with `--include` / `--exclude`.
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
the suite never uses `Sleep` (it is forbidden).

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

Always click the target block before sending keyboard input: Tiptap's focus
is not the DOM's focus.
