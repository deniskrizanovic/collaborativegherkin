# Robot Framework for the e2e suite: pros, cons, and how robustness was kept

Status as of 2026-10-29: the business-language pilot of §6.7 is built
(`block_picker_bdd.robot`, 9 more tests; a full `pnpm test:robot` run is now
116 tests, 115 passed, 1 skipped). All chunks (0–7) of the OpenSpec change
`add-robot-framework-e2e-suite` (issue #42) are done. Every Playwright test now
has a Robot counterpart. The last local run of `pnpm test:robot` ran 107 tests
in 67 s: 106 passed and 1 was skipped. The skipped test is `SC-3.5.2`, which is
also skipped in Playwright for the same reason. The 107 are the 106 Playwright
tests plus one Robot-only smoke test. The CI job runs both suites, the
`lint:robot` gate, and uploads `robot/results/` as an artifact.

Stack: Robot Framework 7.5, `robotframework-browser` 20.6.0 (Playwright
underneath), RequestsLibrary for the browser-free API tests, and Python 3.13
managed by `uv`.

## Port at a glance

| Playwright spec | Robot suite | Tests | TS lines | Robot lines |
|---|---|---|---|---|
| `initial-content.spec.ts` | `initial_content.robot` | 3 | 29 | 31 |
| `toolbar.spec.ts` | `toolbar.robot` | 5 | 45 | 48 |
| `import.spec.ts` | `import.robot` | 11 | 135 | 129 |
| `home.spec.ts` | `home.robot` | 9 | 98 | 91 |
| `enter-progression.spec.ts` | `enter_progression.robot` | 10 | 200 | 157 |
| `block-picker.spec.ts` | `block_picker.robot` | 9 | 154 | 136 |
| `visual-separation.spec.ts` | `visual_separation.robot` | 8 | 189 | 122 |
| `export.spec.ts` | `export.robot` | 4 | 136 | 68 |
| `image.spec.ts` | `image.robot` | 3 | 79 | 66 |
| `data-table.spec.ts` | `data_table.robot` | 10 | 173 | 126 |
| `llm-review.spec.ts` | `llm_review.robot` | 22 | 260 | 229 |
| `collaboration.spec.ts` | `collaboration.robot` | 3 (1 skip) | 77 | 80 |
| `session-access-control.spec.ts` | `session_access_control_api.robot` + `session_access_control.robot` | 3 + 3 | 172 | 41 + 86 |
| `websocket-auth.spec.ts` | `websocket_auth.robot` | 3 | 96 | 48 |
| **Total** | 15 suites | **106** | **1,843** | **1,458** |

The test files alone are about 21% shorter in Robot. That number is
misleading on its own, because Robot moves code out of the tests and into
shared keywords and libraries:

| Shared code | Playwright | Robot |
|---|---|---|
| Helpers | `helpers.ts` (36) | `session.resource` (125), `common.resource` (61), `files.resource` (79), `api.resource` (33), `variables.resource` (10) |
| Custom libraries | none (inline in specs) | `routes.cjs` (73), `WebSocketProbe.py` (47) |
| **Total with tests** | **1,879** | **1,886** |

Overall the two suites are the same size. The TS specs keep their download,
temp-file, route and WebSocket plumbing inline. For example, `connectResult`
is about 45 of the 96 lines in `websocket-auth.spec.ts`. Robot puts that
plumbing in resources, so its test bodies are shorter but there's more support
code. Both suites reuse `e2e/global-setup.ts` for auth, so it isn't counted
above.

---

## 1. What Robot Framework is

Robot Framework is a keyword-driven test runner written in Python. A test is a
list of steps, and each step is a *keyword* followed by its arguments. Keywords
come from libraries (here `Browser`, which wraps Playwright, and
`RequestsLibrary` for HTTP) or from `.resource` files we write. A user keyword
is just a named list of other keywords.

We use the [Browser library](https://robotframework-browser.org/) rather than
SeleniumLibrary. Browser runs Playwright through a Node gRPC process, so
auto-waiting, browser contexts, storage-state auth, routes and downloads work
the same way they do in the TypeScript suite (design D1).

---

## 2. Syntax, by example

### 2.1 File structure

A `.robot` file is split into sections. This is the header every UI suite
shares (`robot/suites/toolbar.robot`):

```robot
*** Settings ***
Documentation       Port of e2e/toolbar.spec.ts — spec §3.4 toolbar.

Library             Collections
Resource            ../resources/common.resource
Resource            ../resources/session.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           chunk1    toolbar
```

- `Resource` works like a TS `import` of helpers.
- `Suite Setup` runs once per file, and `Test Setup` / `Test Teardown` run
  around every test. This replaces Playwright's config file and fixtures.
- `Test Tags` lets you pick tests to run: `pnpm test:robot --include toolbar`.

### 2.2 The whitespace rule

Cells are separated by **two or more spaces**. A single space is part of the
value. This is the main thing that catches newcomers:

```robot
Click    [data-gherkin-type="feature"]       # keyword + 1 argument
Get Element Count    .modal    ==    0       # keyword + 3 arguments
Open Session                                 # ONE keyword, "Open Session"
```

### 2.3 A test case, side by side

Playwright (`e2e/block-picker.spec.ts`):

```ts
test("SC-3.3.6: Escape closes picker without inserting", async ({ page }) => {
  await openSession(page);
  const blocksBefore = await page.locator(".gherkin-editor [data-gherkin-type]").count();
  await page.locator('[data-gherkin-type="feature"]').click();
  await page.keyboard.type("/");
  const picker = page.locator('[style*="position: fixed"]');
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).not.toBeVisible();
  await expect(page.locator(".gherkin-editor [data-gherkin-type]")).toHaveCount(blocksBefore);
});
```

Robot (`robot/suites/block_picker.robot`):

```robot
*** Variables ***
${PICKER}           [style*="position: fixed"]
${BLOCKS}           .gherkin-editor [data-gherkin-type]

*** Test Cases ***
SC-3.3.6: Escape closes picker without inserting
    Open Session
    ${before}=    Get Element Count    ${BLOCKS}
    Click    [data-gherkin-type="feature"]
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${before}
```

There's no `async`/`await`, no `page` handle, and no `expect`. An assertion is
the last three cells of a `Get ...` keyword (`==    ${before}`).

### 2.4 Variables

```robot
${id}=    Create Session Via API    List test session     # store a return value
Get Attribute    .session-link >> nth=0    href    ==    /sessions/${id}

@{expected}=    Create List    feature    scenario    given    when    then
Should Be Equal    ${types}    ${expected}                # list equality

${path}    ${filename}=    Download Via Button    .gherkin-export-btn   # two return values

FOR    ${session}    IN    @{list}[body]                  # iterate a response body
    Call API    DELETE    /api/sessions/${session}[id]
END
```

`${x}` is a scalar, `@{x}` a list that expands into cells, `&{x}` a dict, and
`${x}[key]` indexes into one.

A leading `#` starts a comment, so values that begin with `#` must be escaped.
That matters in this project because Markdown export lines start with `#`:

```robot
${MOCK_REVIEW}      \## Feedback\n\n- Step 1 is ambiguous.
Should Be Equal    ${lines}[0]    \# Feature: User login
```

### 2.5 User keywords (the equivalent of `helpers.ts`)

```robot
*** Keywords ***
Open Session
    [Documentation]    Create a session, open it, wait for the editor and click
    ...    the Feature block so Tiptap has focus. Port of helpers.ts `openSession`.
    [Arguments]    ${title}=Test session
    ${id}=    Create Session Via API    ${title}
    Go To    ${BASE_URL}/sessions/${id}
    Wait For Elements State    [data-gherkin-type="feature"]    visible
    Click    [data-gherkin-type="feature"]
    RETURN    ${id}
```

A keyword can take varargs, which makes for readable test data
(`robot/suites/import.robot`):

```robot
SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — valid sequence
    Open Session
    Import Gherkin
    ...    Feature: My feature
    ...    Scenario: My scenario
    ...    Given some context
    ...    When I do something
    ...    Then I see the result
    Wait For Elements State    ${MODAL}    hidden
    Get Element Count    [data-gherkin-type="feature"]    ==    2
```

The Playwright version builds the same input with a `\n`-joined template
string inside a `fill()` call.

### 2.6 Dropping into Python or JavaScript

Inline logic is possible, but it reads worse than either language does on its
own:

```robot
# Python expressions, evaluated by Robot
${i}=    Evaluate    $types.index("background")
Should Be True    ${box}[width] > 0
Should Be True
...    ("then", "and") in list(zip($types, $types[1:]))
...    No then → and pair in ${types}

# JavaScript, evaluated in the page (image.robot, SC-3.8.3)
Evaluate JavaScript    ${None}
...    ({ selector, base64 }) => {
...        const el = document.querySelector(selector);
...        if (!el) return;
...        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
...        const file = new File([bytes], "test.png", { type: "image/png" });
...        const dt = new DataTransfer();
...        dt.items.add(file);
...        el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
...    }
...    arg=${arg}
```

### 2.7 Playwright → Robot cheat-sheet

| Playwright | Robot |
|---|---|
| `expect(loc).toHaveCount(n)` | `Get Element Count    ${sel}    ==    ${n}` |
| `expect(loc).toHaveText(t)` | `Get Text    ${sel}    ==    ${t}` |
| `toBeVisible` / `not.toBeVisible` | `Wait For Elements State    ${sel}    visible` / `hidden` |
| `toBeDisabled` / `toBeFocused` | `Wait For Elements State    ${sel}    disabled` / `focused` |
| `toHaveCSS("background", /x/)` | `Get Style    ${sel}    background    *=    x` |
| `.last()` / `.nth(i)` | `${sel} >> nth=-1` / `${sel} >> nth=${i}` |
| `locator(x, { hasText })` | `x:has-text("…")` |
| `keyboard.press("Enter")` | `Keyboard Key    press    Enter` |
| `keyboard.type("/")` | `Keyboard Input    type    /` |
| `mouse.click(10, 10)` | `Mouse Button    click    10    10` |
| `click({ position: { x: 5, y: 5 } })` | `Click With Options    ${sel}    position_x=5    position_y=5` |
| `evaluateAll(fn)` | `Evaluate JavaScript    ${sel}    fn    all_elements=True` |
| `boundingBox()` | `Get BoundingBox    ${sel}` |
| `setInputFiles(path)` | `Upload File By Selector    input[type="file"]    ${path}` |
| `waitForEvent("download")` + `saveAs` | `Promise To Wait For Download    ${path}` → click → `Wait For` |
| `Promise.all([waitForResponse(fn), action])` | `Promise To    Wait For Response    matcher=…` → action → `Wait For` |
| `page.route(...).fulfill` / held route | `Fulfill Route` / `Hold Route` + `Release Route` (`routes.cjs`) |
| `browser.newContext({ storageState })` | `New Context    storageState=…` + `Switch Page    ${id}    context=ALL` |
| `request.newContext({ storageState })` | RequestsLibrary `Create Session` with the session cookie header |
| `context.grantPermissions([...])` | `Grant Permissions    clipboard-read    clipboard-write` |

The full table is in `robot/README.md`.

---

## 3. Pros

**Tests read as steps.** Without `await`, `page.locator(...)` and `expect`,
each line is one action or one check. The biggest gains are in suites where
Playwright repeats plumbing in each test: `export.robot` is 68 lines against
136, `visual_separation.robot` 122 against 189, and `websocket_auth.robot` 48
against 96. In those suites the download, temp-file and socket code moved into
keywords (`Download Via Button`, `Read Lines`, `Probe WebSocket Upgrade`), and
each test keeps only its intent.

**Same engine underneath.** Browser drives Playwright, so contexts,
storage-state auth, auto-waiting, routes, downloads and traces are the same
concepts. A failing Robot test can be opened in the Playwright trace viewer
(`--variable TRACE:True`, then `uv run rfbrowser show-trace …`). Second
contexts get their own trace file.

**The hard cases stayed small.** Before chunks 4–6 the open question was
whether held routes and the raw WebSocket probe would need large custom
libraries. They didn't. `routes.cjs` is 73 lines (four functions, about half
of it comments), and `WebSocketProbe.py` is 47. The Python probe is simpler
than the TS one: a blocking `connect` + `recv` with exceptions in place of the
event-driven `connectResult` promise and its `settled` flag.

**Teardown is guaranteed, which made the port more robust.** Robot's
`Test Teardown` runs whether the test passes or fails. The suite uses it for
temp-file cleanup (`Remove Temp Files`) and to remove route handlers
(`Clear Routes`). The Playwright specs delete their temp files with
`fs.unlinkSync` at the end of the test body, 12 calls in all, so those calls
are skipped whenever an assertion fails earlier. Browser's
`auto_closing_level=TEST` also closes every extra context a test opened. That
replaces the `try { … } finally { context2.close() }` blocks, and nobody can
forget it.

**Reports are good out of the box.** `robot/results/log.html` shows every
keyword of every test, nested, with arguments, timings and a screenshot on
failure. CI uploads it on every run (`if: always()`). A non-developer can
follow a failure there without reading code. Playwright's `list` reporter,
which this project uses, gives only a stack trace. Skipped tests show their
reason in the report (`SC-3.5.2`: "no Tiptap 3 stable release yet").

**Assertions are built into getters.** `Get Text    .x    ==    Copied!`
both reads and asserts, and it retries until the browser timeout. Because the
assertion form is short, it gets used, and there's less temptation to read a
value once and assert on it without retrying.

**Tag-based selection.** Every test carries a chunk tag and a feature tag, and
some carry `api` or `skip`. `--include chunk5`, `--include llm-review`,
`--exclude skip` and `--include api` can be combined freely. Playwright offers
`--grep` on titles only.

**Browser-free API tests are first-class.** The three API-contract tests in
`session_access_control_api.robot` use RequestsLibrary and never start a
browser. `expected_status=403` asserts the status inside the request keyword,
so the test reads as a contract:

```robot
non-owner cannot DELETE a session (403) — deletion stays owner-only
    ${id}=    Create Session As    owner    Owner-only-delete session
    DELETE On Session    other    /api/sessions/${id}    expected_status=403
    GET On Session    owner    /api/sessions/${id}    expected_status=200
```

**Keyword layers can rise toward business language.** The ported suites stay
at the Playwright abstraction level on purpose, so that parity can be checked
line by line. But Robot lets a further layer read like
`Given the block picker menu is open` without a separate Cucumber toolchain.
That fits a Gherkin product. §6 describes that layer and the pilot of it.

**Readable by non-TypeScript people.** QA staff and BAs can usually read and
edit the UI suites after an hour with the README primer. This holds for 13 of
the 15 suites. The exceptions are below.

---

## 4. Cons

**Two toolchains, two Playwright versions.** The repo now needs Node *and*
Python (`uv`, `pyproject.toml`, `uv.lock`), plus `rfbrowser init`, which runs
its own `npm ci` and downloads its own Playwright. The app's `@playwright/test`
and Browser's bundled Playwright can drift apart. In CI, `rfbrowser init` wiped
its browsers on every run until we pointed both tools at one
`PLAYWRIGHT_BROWSERS_PATH`. CI runs both e2e suites one after the other, so e2e
time roughly doubles (design D13 accepts this). Locally the Robot suite alone
takes about 67 s for 107 tests on one worker.

**Total code didn't shrink.** Shorter test files are balanced by roughly 430
lines of resources and libraries against 36 lines of `helpers.ts`. Robot moves
code; it doesn't remove it. Anyone debugging a keyword still has to read the
layer underneath.

**The hard suites need three languages.** `llm_review.robot` depends on
`routes.cjs` (JavaScript, and specifically CommonJS, because the root
`package.json` is ESM and Browser loads extensions with `require()`).
`websocket_auth.robot` depends on `WebSocketProbe.py`. `image.robot` puts a JS
body inside `...` continuation lines. Contributors changing those suites need
Robot, JS and Python, where the TS suite needs only TS.

**Whitespace is syntax, and `#` is a comment.** One space where two were
needed silently turns two arguments into one argument with a space in it. A
leading `#` in a value silently becomes a comment unless escaped as `\#`, which
bit the Markdown export and the mock review body. In both cases the error
shows up far from the cause. Editors without a Robot plugin give no help.

**Logic is awkward.** Anything beyond a straight sequence turns into
`Evaluate` with a Python expression in a string, or `Evaluate JavaScript` with
a JS body spread over `...` continuation lines. Compare:

```ts
const thenFollowedByAnd = types.some((t, i) => t === "then" && types[i + 1] === "and");
```

```robot
Should Be True
...    ("then", "and") in list(zip($types, $types[1:]))
...    No then → and pair in ${types}
```

Even small helpers like `Last Index Of`, `Cookie Header From Context` and
reading a cookie out of a storage-state file need a one-line Python
expression.

**Implicit "current page" state.** In TS a second user is a variable
(`page2.goto(...)`), so every call says which page it acts on. In Robot,
keywords act on the *current* page, and multi-context tests switch with
`Switch Page    ${page2}    context=ALL`. Forget a switch and the step runs
against the wrong user with no error. `Open Second Context` switches back to
the first page before returning, so each test has to name its page
explicitly, but that is a convention, not something the tool checks.

**Some keywords take keywords as arguments.** `Expect Response Status` has to
start the wait before the action, so the action is passed in as a keyword name
plus arguments:

```robot
Expect Response Status    /api/sessions/${id}    PATCH    200
...    Select Options By    ${MODEL_SELECT}    value    ${target}
```

This works, but it's less obvious than `Promise.all([...])`, and IDE support
for the inner keyword is weaker.

**Library defaults can be wrong, silently.** RequestsLibrary 0.9.7 keeps
`cookies=` in one library-wide slot, so the second `Create Session` signed in
*every* alias as user 2. The owner silently became the non-owner, and the
DELETE test got 204 instead of 403. It was caught only because the test
asserts the exact status. The fix sends the cookie as a per-alias header.
Other traps of the same kind: `Library    Browser` may be imported only once,
from `common.resource`, because a second import with different arguments
conflicts. And Python's `bytes.fromhex` rejects the odd-length PNG hex string
that Node's `Buffer.from` quietly truncates, so the port has to truncate it
explicitly to produce the same bytes.

**Weaker tooling than TypeScript.** There's no type checking. Keyword names
resolve at runtime, so a typo in a keyword name only fails when that line
runs. Go-to-definition and rename depend on an IDE plugin (RobotCode in VS Code
or IntelliJ).

**Two suites to maintain forever.** Both suites are kept permanently, so every
UI change that breaks a selector has to be fixed twice, and `PARITY.md` has to
stay in sync. The Robot suite adds no coverage that Playwright doesn't
already have: 106 of its 107 tests are ports, and the extra one is a smoke
test.

**Shared database means serial runs.** Both suites hit the same SQLite DB, and
`home` deletes every session, so they can't run concurrently (`e2e:all` uses
`run-s`). Within Robot, suites run one after another as well. `pabot` is the
route to parallelism, but it isn't set up.

**Debugging is one step removed.** There's no `page.pause()` or
`--debug`-style stepping out of the box. The options are `HEADLESS:False`,
traces, and the log.

---

## 5. How Playwright's robustness has been kept

Over time the Playwright suite picked up techniques that a naive port would
lose. The rule for the port (design, "Goals") is full test-for-test parity
with every technique kept. `robot/PARITY.md` lists the required assertions for
each of the 106 tests, and every row is now `ported` (or `skip` for
`SC-3.5.2`).

### 5.1 Retrying assertions instead of one-shot reads

Playwright's `expect(locator)` retries until its 5 s timeout. Browser's
`Get ...` keywords do the same *when given an assertion operator*, and
`common.resource` sets the same timeout:

```robot
Open Browser For Suite
    New Browser    chromium    headless=${HEADLESS}
    Set Browser Timeout    5s          # = Playwright's default expect timeout
```

```ts
await expect(names.first()).toHaveText("Session Beta");
```
```robot
Get Text    .session-name >> nth=0    ==    Session Beta
```

Where the original sets an explicit timeout, the port keeps it. The
collaboration tests wait up to 5 s for the other context to receive the
change:

```robot
Wait For Condition    Text    ${FEATURE}    *=    Shared feature    timeout=5s
```

### 5.2 Never assume a keypress took effect

`helpers.ts pressEnterAndWait` exists because Tiptap applies Enter
asynchronously. Pressing Enter twice in a row without waiting is the classic
source of flakiness here. The port keeps the contract (count the blocks,
press, wait for the count to grow, click the newest block):

```ts
export async function pressEnterAndWait(page: Page, expectedType: string) {
  const before = await page.locator(`[data-gherkin-type="${expectedType}"]`).count();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ({ selector, before }) => document.querySelectorAll(selector).length > before,
    { selector: `[data-gherkin-type="${expectedType}"]`, before }
  );
  await page.locator(`[data-gherkin-type="${expectedType}"]`).last().click();
}
```

```robot
Press Enter And Wait For Block
    [Arguments]    ${type}
    ${selector}=    Set Variable    [data-gherkin-type="${type}"]
    ${before}=    Get Element Count    ${selector}
    Keyboard Key    press    Enter
    Get Element Count    ${selector}    >    ${before}     # retries until true
    Click    ${selector} >> nth=-1
```

The `waitForFunction` becomes a retrying `Get Element Count ... > ${before}`.
The meaning is the same, without injecting JavaScript.

### 5.3 Click the block before typing (Tiptap focus)

Tiptap's internal focus isn't the DOM focus, so keyboard events only reach
the right block after it has been clicked. Every ported test keeps the click
before `Keyboard Key` / `Keyboard Input`, step for step. `Open Session` ends
with the same `Click` on the Feature block that `openSession` does, and
`Type Into Block` clicks before it types.

### 5.4 Exact assertions, not weaker ones

Counts, orders, texts, filenames and status codes are asserted exactly as
strictly as in the original. PARITY.md lists the assertions so that a reviewer
can catch a weakened port. The export tests check the filename and each line:

```robot
${path}    ${filename}=    Download Via Button    .gherkin-export-md-btn    md
Should Be Equal    ${filename}    gherkin.md
${lines}=    Read Lines    ${path}
Should Be Equal    ${lines}[0]    \# Feature: User login
Should Be Equal    ${lines}[1]    \## Scenario: Successful login
```

`Read Lines` copies JavaScript's `split("\n")` exactly, including the empty
last element after a trailing newline, so line indexes match the original.

### 5.5 Computed-style checks

Focus in the block picker is shown only by a background colour, and the
visual separator only by a top border, so the tests assert computed CSS:

```robot
Get Style    ${PICKER} >> button >> nth=0    background    *=    rgba(0, 38, 100, 0.06)
Get Style    [data-gherkin-type="given"] >> nth=-1    border-top-width    ==    1px
```

`*=` is "contains", the equivalent of the unanchored regex. Both forms retry.

### 5.6 Waits armed before the action

Downloads and network responses are easy to miss if the wait starts after the
click. Playwright pairs them with `Promise.all`. The port uses Browser's
`Promise To`, which starts the wait first:

```ts
const [patchRes] = await Promise.all([
  page2.waitForResponse(
    (r) => r.url().includes(`/api/sessions/${sessionId}`) && r.request().method() === "PATCH"
  ),
  select.selectOption(target!),
]);
expect(patchRes.status()).toBe(200);
```

```robot
Expect Response Status    /api/sessions/${id}    PATCH    200
...    Select Options By    ${MODEL_SELECT}    value    ${target}
```

`Download Via Button` follows the same pattern with
`Promise To Wait For Download`. The session-access-control tests also assert
the status on the network independently of the UI, because the original bug
closed the modal even on a silently swallowed 403.

### 5.7 Held and mocked routes

`llm-review` checks the UI *while* a request is in flight, so the test must
control when the response arrives. Playwright does this with a route handler
that awaits a promise. `routes.cjs` does the same inside Browser's Node
process:

```ts
let resolveRoute!: () => void;
const held = new Promise<void>((res) => { resolveRoute = res; });
await page.route("/api/llm-review", async (route) => {
  await held;
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: MOCK_REVIEW }) });
});
await page.locator(".session-review-btn").click();
await expect(page.locator(".session-review-btn")).toBeDisabled();
// …
resolveRoute();
```

```robot
${body}=    Review Body    ${MOCK_REVIEW}
Hold Route    ${REVIEW_URL}    200    ${body}
Click    ${REVIEW_BTN}
Wait For Elements State    ${REVIEW_BTN}    disabled
Get Text    ${REVIEW_BTN}    ==    Reviewing…
Wait For Elements State    ${MODEL_SELECT}    disabled
Release Route    ${REVIEW_URL}
Wait For Elements State    ${MODAL}    visible
```

The Robot version needs one safeguard the TS version doesn't. The held-route
map lives in module scope in a Node process that outlives each test, so
`Finish Test` calls `Clear Routes` to drop handlers and forget held routes.
A test that fails mid-hold can't leak into the next one. `Fulfill Route` also
takes an optional method, which covers `SC-1.2.4` (POST gets a 500 and GET
passes through to the server).

### 5.8 Isolated second identity

The collaboration tests use a second *context*, not a second page, so
BroadcastChannel can't bridge them. All Y.js sync has to go through the
WebSocket server, so a broken server fails the test. The access-control tests
open that second context as a different user (`user2.json`). The port keeps
both points:

```robot
${page2}=    Open Second Context    ${OTHER_STATE}
Switch Page    ${page2}    context=ALL
```

The chunk 5 checkpoint broke an assertion on purpose, locally, to prove the
second context fails on its own. The browser-free API tests use one
RequestsLibrary session per user, each carrying only that user's session
cookie, which matches `request.newContext({ storageState })`.

### 5.9 Raw WebSocket with exact cookie control

`websocket-auth` must prove that the server refuses an upgrade *before* any
Y.js state is sent. A browser would add its own cookies, so both suites use a
raw client and control the `Cookie` header exactly. Both have a 3 s backstop,
and both treat a refusal, the first message, or a close as the end of the
probe:

```robot
${id}=    Create Session Via API    WS auth negative test
${result}=    Probe WebSocket Upgrade    ${WS_BASE}/session-${id}
Should Not Be True    ${result}[opened]    msg=upgrade must not open without a session cookie
Should Be Equal As Integers    ${result}[status]    401
Should Not Be True    ${result}[received_data]    msg=no document/awareness state may be sent
```

The authenticated case builds the header from the browser context's cookies
(`Cookie Header From Context`), as the TS test does with
`context().cookies()`.

### 5.10 Test isolation equal to a Playwright fixture

Each test gets a fresh browser context, signed in from the same storage-state
file, with the same `baseURL` and `acceptDownloads` settings, and creates its
own session through the API:

```robot
Open Owner Context And Page
    ${tracing}=    Trace File For Test
    New Context    storageState=${OWNER_STATE}    baseURL=${BASE_URL}    acceptDownloads=True
    ...    tracing=${tracing}
    New Page
```

### 5.11 One auth path for both suites

The Robot suite doesn't re-implement NextAuth JWT encoding in Python.
`scripts/run-robot.mjs` calls the *same* `e2e/global-setup.ts` (through
`scripts/mint-e2e-auth.ts`) to write `e2e/.auth/user.json` and `user2.json`
(design D3). If the auth scheme changes, both suites break or pass together.

### 5.12 Setup through the API, on the page's own cookies

`createSession` uses `page.request`, which carries the context's cookies. The
port uses Browser's `Http`, which runs `fetch` inside the page and so uses the
same cookies.

### 5.13 React-aware input tricks preserved

SC-1.2.3 has to get past `maxLength` *and* still fire React's synthetic
`onChange`. The port keeps the native-value-setter technique word for word
rather than switching to `Fill Text`, which would be blocked by `maxLength`
and make the test pass for the wrong reason. The image drop test keeps the
synthetic `DataTransfer` event body word for word as well.

### 5.14 Same server lifecycle

The runner copies Playwright's `webServer.reuseExistingServer: true`. It
reuses a dev server already on `:3000`, otherwise starts `pnpm dev`, waits up
to 120 s, and stops the server only if it started it.

### 5.15 No sleeps, now enforced

Neither suite uses a fixed wait. `pnpm lint:robot`
(`scripts/lint-robot-no-sleep.mjs`, design D10) fails on any `Sleep` call in
`robot/suites/` or `robot/resources/`, including `Run Keyword    Sleep` and
`BuiltIn.Sleep`. It ignores the word in documentation prose. It runs in the
husky pre-commit hook, in `test:all`, and in CI.

### 5.16 Where the port is stronger than the original

- **Retrying CSS checks.** The `visual-separation` border checks were one-shot
  `evaluate(getComputedStyle)` reads. `Get Style    …    ==    1px` retries
  until the style settles.
- **Cleanup on failure.** Temp images and downloads are removed in teardown,
  pass or fail. The TS `fs.unlinkSync` calls are skipped when an earlier
  assertion fails.
- **Status on setup.** `Create Session Via API` asserts the 201. The original
  `createSession` doesn't check the status.
- **Route leakage.** `Clear Routes` in teardown means a held route can't
  outlive its test.

### 5.17 Parity preserves weaknesses too

The port copies the original step for step, including its weak spots. For
example, `feature → scenario` in `enter_progression.robot` presses Enter and
then reads the block types once, with no wait, exactly as the TS test does.
Both suites pass today, but both carry the same small race. The parity rule
deliberately doesn't fix these during the port. They're worth a follow-up in
both suites at once.

---

## 6. A business-language layer (piloted on the block picker)

Robot can do this without any extra tooling, and this project is well placed
for it because every spec scenario is already written in Given/When/Then. A
test could repeat its spec scenario word for word.

### 6.1 How it works

1. **Robot ignores the step prefixes.** When it looks up a keyword, it drops a
   leading `Given`, `When`, `Then`, `And` or `But`. So
   `Given the block picker menu is open` calls a keyword named
   `the block picker menu is open`.
2. **Arguments can sit inside the keyword name.** A keyword named
   `the user presses ${key}` matches both `the user presses Escape` and
   `the user presses Enter`.
3. **The layers stack.** Business-language test → domain keywords (new) →
   today's technical keywords (`session.resource`) → the Browser library.

### 6.2 Example: SC-3.3.6

The spec (`openspec/specs/gherkin-editor/spec.md`):

```
GIVEN the block picker menu is open
WHEN the user presses Escape
THEN the menu closes without inserting a block
```

The test would read:

```robot
*** Test Cases ***
SC-3.3.6: Escape closes picker without inserting
    Given the block picker menu is open
    When the user presses Escape
    Then the menu closes without inserting a block
```

The steps live in a new domain resource, for example
`robot/resources/editor_domain.resource`:

```robot
*** Keywords ***
the block picker menu is open
    Open Session
    ${before}=    Get Element Count    ${BLOCKS}
    Set Test Variable    ${BLOCKS_BEFORE}    ${before}
    Click    [data-gherkin-type="feature"]
    Keyboard Input    type    /
    Wait For Elements State    ${PICKER}    visible

the user presses ${key}
    Keyboard Key    press    ${key}

the user clicks outside the menu
    Mouse Button    click    10    10

the menu closes without inserting a block
    Wait For Elements State    ${PICKER}    hidden
    Get Element Count    ${BLOCKS}    ==    ${BLOCKS_BEFORE}
```

SC-3.3.7 ("clicking outside picker closes without inserting") then needs
only one new keyword: `When the user clicks outside the menu`. The vocabulary
grows slowly, and new tests are sentences built from it.

### 6.3 Where it fits best

These suites would reuse the vocabulary the most:

- **`block_picker`**: menu open, press a key, menu closes with or without
  inserting.
- **`llm_review`**: `Given the AI review responds with "…"`,
  `Given the AI review is still in flight`,
  `Then the review controls are disabled`. These keywords would wrap
  `Hold Route` / `Release Route`, so route handling never appears in test
  bodies.
- **`session_access_control`**: `Given a session owned by another user`,
  `When I change the model`, `Then the change is saved for everyone`.
- **`enter_progression`**: a data-driven table using `Test Template`:

```robot
*** Settings ***
Test Template    Enter at the end of a ${from} block inserts a ${expected} block

*** Test Cases ***    FROM          EXPECTED
feature → scenario    feature       scenario
given → when          given         when
then → and            then          and
rule → scenario       rule          scenario
```

### 6.4 Gains

- **Spec text equals test text.** A lint like `lint:specs` could check that
  each Robot test's steps match its spec's GIVEN/WHEN/THEN lines, so the spec
  and the test can't drift apart.
- **BAs and QA can write new tests** from the existing vocabulary without
  touching selectors.
- **A selector change is fixed once**, in the domain keyword, however many
  tests use it.
- **It suits the product.** A Gherkin editor tested with Gherkin, and the
  report reads as acceptance criteria.

### 6.5 Costs

- **Parity with Playwright is no longer line by line.** PARITY.md reviews
  currently compare steps one to one. With this layer they would compare
  behaviour, which is a weaker check.
- **Steps share hidden state.** `${BLOCKS_BEFORE}` passes from the Given step
  to the Then step through `Set Test Variable`, and the test doesn't show it.
- **Assertions are hidden.** How strict a `Then` step is lives inside its
  keyword, so a reviewer has to open the keyword to confirm it still asserts
  exact counts.
- **Embedded arguments can be ambiguous.** If two keyword patterns match the
  same step, Robot fails at runtime.
- **Vocabulary sprawl.** Without an owner, near-duplicates such as
  `the menu closes` and `the picker is closed` creep in.
- **One more layer to debug.** A failure goes test → domain keyword →
  technical keyword → Browser. `log.html` shows that nesting, which helps.

### 6.6 Not Cucumber

Robot doesn't run `.feature` files natively. The steps live in `.robot`
files. A third-party Gherkin parser for Robot exists, but nobody has checked
how mature it is. Gherkin exported from this app (`Given: the user…`, with a
colon) isn't valid Robot step syntax either.

### 6.7 The pilot

The plan was to convert `block_picker.robot` alone, keep the technical
version next to it for one cycle, and measure three things: lines of code, how
many domain keywords get reused, and whether a non-developer can write SC-3.3.7
without help. Plus a draft spec-step lint. That is now built:

- `robot/suites/block_picker_bdd.robot`: the same 9 tests, tagged
  `pilot bdd block-picker`. Every step is a line of its spec scenario.
- `robot/resources/editor_domain.resource`: 18 domain keywords
  (lower-case sentences) on top of 5 technical helpers (Title Case).
- `scripts/lint-robot-spec-steps.mjs` (`pnpm lint:robot-steps`, in
  `test:all`, the pre-commit hook and CI), with unit tests. Details in §6.7.4.

`block_picker.robot` is untouched, and both suites pass. A full
`pnpm test:robot` run is 116 tests: 115 passed, 1 skipped.

The layer has since been extended to every editor suite, and
`editor_domain.resource` split into `robot/resources/steps/` (§6.7.7).

SC-3.3.6 now reads exactly as the spec does:

```robot
SC-3.3.6: Escape closes picker without inserting
    Given the block picker menu is open
    When the user presses Escape
    Then the menu closes without inserting a block
```

#### 6.7.1 Lines of code

| | Technical | Business language |
|---|---|---|
| Test-body lines (9 tests) | 72 | 33 |
| Suite file | 136 | 71 |
| Supporting keywords | 12 (2 local keywords) | 191 (`editor_domain.resource`, about half of it documentation) |
| **Total** | **136** | **262** |

The tests are less than half as long. The total nearly doubles. The new layer
also doesn't replace `session.resource`; it sits on top of it. This confirms
§4's "Robot moves code; it doesn't remove it", one level further up.

#### 6.7.2 Keyword reuse

33 steps call 18 domain keywords, about 1.8 uses each. 11 of the 18 are used
once, mostly the `Then` steps, which are specific to one scenario. The reused
ones are the setup and action vocabulary: `the block picker menu is open` (4),
`the user types /` (4), `a block picker menu opens` (4),
`the cursor is inside a block on a new line after …` (3). Domain keywords also
call each other (`the block picker menu is open` is built from three other
steps). Nine tests are too few to show whether reuse grows; the
`llm_review` suite (22 tests, §6.3) would be the better test of that.

SC-3.3.7 did need only one new keyword beyond SC-3.3.6's, as §6.2 predicted:
`the user clicks outside the menu`, which is one line
(`Mouse Button    click    10    10`).

#### 6.7.3 Can a non-developer write SC-3.3.7?

Not measured yet. It needs a QA or BA colleague to try it, given only the spec
and `editor_domain.resource`. With the vocabulary in place SC-3.3.7 is three
lines copied from the spec. The harder part for a newcomer would be a step the
vocabulary lacks, because that means writing a keyword with selectors in it.

#### 6.7.4 The spec-step lint

A suite opts in with the `bdd` tag in `Test Tags` (or `Force Tags` /
`Default Tags`), and a single test with `bdd` in its `[Tags]`; tags on `...`
continuation lines count. For each such test, the lint finds the spec
scenario with the same title (the test name without `SC-x.y.z:` and without any
` — variant` suffix) in `openspec/specs/**`, and fails when:

- no scenario has that title, or more than one does
- a test body line is not a Given/When/Then/And/But step
- a step matches none of the scenario's lines, or matches a line of a
  different kind (`Then` against a GIVEN line)
- a scenario line isn't exercised by any test of that scenario, so adding a
  step to the spec fails the lint until a test covers it

Text is compared without case, backticks or extra whitespace, so
``the user types `/` `` matches `the user types /`, and a trailing `# comment`
on a step is ignored. Step order isn't checked yet. A step may *refine* its
spec line by adding words at the end (see §6.7.5). A step is credited to the
spec line it equals; failing that, to the longest line it refines, so `the
menu closes` and `the menu closes without inserting a block` can share a
scenario.

#### 6.7.5 What the pilot showed

**Some spec steps are too abstract to execute.** `GIVEN the cursor is inside
a block` doesn't say which block, and SC-3.3.1's three tests need three
different contexts. The pilot lets a step add words to its spec line
(`Given the cursor is inside a block on a new line after Feature`), and the
lint accepts that as a refinement. The alternative would be rewriting the spec
as a Scenario Outline with examples, which is the better long-term answer.

**The Given step decides what the test proves.** `the block picker menu is
open` could open the picker on the Feature block (as the technical SC-3.3.6/7
do) or on a new line. On the Feature block the picker lists only `Feature`,
and because that is replace mode, picking an item wouldn't change the block
count. So the technical "closes without inserting" check can't fail there. The
domain keyword opens the menu on a new line after Feature (insert mode)
instead, and the Then step compares the full list of block types, not only the
count.

**The rewrite made assertions stronger.** Writing each Then step from the
spec sentence, rather than copying the Playwright lines, raised the bar in
four places (listed in `robot/PARITY.md`, "Business-language suites"):

- `a block picker menu opens` waits for the picker. The technical test waits
  for the first `text=Scenario`, which the seeded Scenario block in the editor
  also matches, so it passes without a picker.
- `the menu closes without inserting a block` checks the block-type list as
  well as the count.
- `focus moves to the next item` also checks that the old item lost focus.
- `the focused block type is inserted` checks the new type equals the focused
  item's label, not only that it is no longer `scenario`.

These were checked by sabotage: a throwaway suite with the wrong action in
each test (Enter instead of Escape, Up instead of Down, Escape instead of
Enter, and the valid-types check in an unrecorded context). All four failed.
The first one is the telling case: the block count stayed the same, and only
the type list caught it (`Index 1: rule != scenario`).

**The §6.5 costs are real.** Steps share seven test variables
(`${BLOCKS_BEFORE}`, `${FOCUSED_INDEX}` and others), each listed in the
keyword documentation but invisible in the test. The "Image always last" test
visits two contexts, so its second Given has to close the picker the first
one left open, which is a hidden step. The valid-types Then step has
expectations only for the after-Feature context, copied from the Playwright
test, so it fails with a clear message anywhere else. Embedded arguments
needed one guard: `the user presses ${key:Escape|Enter}` is limited by a
pattern so it doesn't also match `the user presses the down arrow key`. Some
steps read awkwardly once arguments are filled in
(`… on a new line after Then`).

#### 6.7.6 Next steps

1. Have a QA or BA colleague write a new block-picker test from the
   vocabulary (§6.7.3), and note where they get stuck.
2. Try the layer on `llm_review` to see whether reuse grows past 1.8.
3. Decide whether the four stronger assertions should go back into
   `block-picker.spec.ts` and `block_picker.robot` either way.
4. If the pilot is kept: add step-order checking to the lint, wire it into
   husky and CI, and consider Scenario Outlines in the spec for steps like
   `the cursor is inside a block`.

#### 6.7.7 All editor suites

The OpenSpec change `add-bdd-robot-editor-suites` (issue #52) gave each
editor-area suite a `*_bdd.robot` twin, next to its technical suite. It also
moved the steps into one resource per spec capability
(`robot/resources/steps/`), moved the editor helpers out of `session.resource`
into `editor.resource`, and wrote the conventions down in `robot/README.md`
("Writing a business-language test").

**Counts.** 11 business-language suites, 89 tests and 287 steps, against the 91
tests of the same 11 technical suites. A full `pnpm test:robot` run is 199
tests: 198 passed, 1 skipped (SC-3.5.2, as before). Eleven technical tests have
no twin (`robot/PARITY.md`, "Exclusions"). Five have no spec line of their own
or are covered by another twin. One checks something the browser cannot see
(SC-8.4.2). One is skipped (SC-3.5.2). Four, over three scenarios, test spec
lines the app does not satisfy (#53, #54, #55). Writing the Then steps from the
spec found those three. The technical tests never checked those lines. Seven
twins have no technical test, because a spec line has a branch the technical
suite skipped.

**Keyword reuse.** The 281 steps call 147 step keywords, 1.91 uses each (the
pilot: 1.8). 89 of the 147 are used once (61%, the same share as the pilot).

| Steps file | Keywords | Uses | Uses each | Used once |
|---|---|---|---|---|
| `gherkin_editor.resource` | 51 | 129 | 2.5 | 21 |
| `gherkin_export.resource` | 20 | 30 | 1.5 | 13 |
| `gherkin_import.resource` | 14 | 24 | 1.7 | 12 |
| `llm_review.resource` | 54 | 75 | 1.4 | 39 |
| `realtime_collaboration.resource` | 4 | 6 | 1.5 | 2 |
| `shared.resource` | 4 | 17 | 4.3 | 2 |

The most used are `the user presses ${key:Escape|Enter}` (12, in 3 suites), and
the Enter-progression trio `the cursor is at the end of a block of type …`,
`a new block of the auto-progression type is inserted …` and `the cursor is
placed at the start of the new block's text` (9 each). Only 3 keywords are used
by more than one suite. Reuse comes from variants of one scenario (the nine
progressions, the three ways to close a modal), not from scenarios sharing
steps. `llm_review`, which §6.7.6 item 2 picked as the test of whether reuse
grows, has the lowest figure: its scenarios each describe a different control,
so most of its Then steps are used once.

Counted from `robot/results/output.xml`: every keyword a `bdd` test body calls,
resolved to the keyword definition it runs.

**Lines of code per layer**, before the change (`main`) and after:

| Layer | Before | After |
|---|---|---|
| Technical suites (all 16) | 1,536 | 1,443 |
| Of which the 11 with a twin: test-body lines | 664 | 639 |
| Business-language suites | 71 (1) | 823 (11) |
| Business-language test-body lines | 33 | 287 |
| Step keywords (`editor_domain.resource`; then `steps/`) | 191 | 2,011 |
| Helper resources (`common`, `variables`, `api`, `files`, `session`, `editor`) | 309 | 682 |
| JS/Python libraries | 145 | 210 |

The technical suites shrank by 93 lines once they used the shared helpers
(`Build Scaffold To Then`, `Insert Image After Block`, `Click Toolbar Button`)
and the selectors of `editor.resource` (`${PICKER}`, `&{BLOCK_TYPE}`, the
export and image selectors) instead of their own. Their assertions are
unchanged. `editor.resource` (351 lines) is new. Of the 2,011 step-keyword
lines, 276 are the step inventory in
`shared.resource` (a comment), and about 540 are documentation, including the
`Sets:`/`Reads:` lines. The business-language layer is now 2,834 lines
(suites plus steps) for 89 tests: about 32 lines per test, against 13 per
technical test. §6.7.1 found the total nearly doubled for one area. Across all
areas it more than doubles.

**What changed in the conventions.** The §6.5 hidden-state cost now has a
contract: each step's documentation lists the variables it `Sets:` and
`Reads:`, and a step that reads state starts with `Require Step State`. If the
setting step did not run, that fails with `"<step>" must run before this step
(${NAME} is not set)`, not with Robot's generic error. Refinement has one rule (a
plain phrase, or ` — detail` after a full clause), and expected values are test
data, never rules copied from `gherkin.ts`. "Without a new API call" is asserted
by counting route requests (`Route Request Count`), since a fixed wait is
banned.

**§6.7.6, item by item.**

1. Not answered. A non-developer still has to try it. The README section is
   the guide they would start from.
2. Answered. Reuse did not grow: 1.91 overall and 1.4 for `llm_review`.
3. Not decided, but listed. `robot/PARITY.md` names every assertion where a
   twin checks more than its technical test. There are 39, for example
   the cursor position after Enter, the full TXT and MD export, and "closes
   without saving".
4. In part. The lint was already in husky and CI. Step-order checking and
   Scenario Outlines are still open. The refinement rule covers steps like
   `the cursor is inside a block` for now.

---

## 7. Verdict

The port is complete and robust. All 106 Playwright tests have a Robot
equivalent with assertions at least as strict, and every robustness technique
was carried over. That includes the risky ones: held routes, paired response
waits, isolated second identities, and the raw WebSocket probe. In four
places the Robot suite is stronger (§5.16). The question the earlier draft
left open, whether chunks 4–6 would need large JS or Python libraries, came
out well: 73 lines of JS and 47 lines of Python.

The costs are structural and won't shrink over time:

- a second toolchain (Python, `uv`, Browser's own Playwright) in dev and CI
- a second copy of every test, kept in sync by hand through `PARITY.md`
- no reduction in total code, only a move from test bodies into keywords
- three languages in the hardest suites, and library traps (RequestsLibrary
  cookies, ESM vs CommonJS, `#` escaping) that TS doesn't have
- no new coverage

What you get in return: test bodies that read as steps, HTML logs a
non-developer can follow, guaranteed teardown, tag selection, and a route
toward business-language keywords.

So the decision depends on who will use the suite, because the engineering
risk is now settled. If QA or BA colleagues will read the Robot suites and
reports, or if a business-language keyword layer is planned, the dual suite is
worth its upkeep. If the only readers are TypeScript developers, Robot repeats
coverage that Playwright already gives, at the cost of a second toolchain and
fixing each selector break twice. In that case the better choice is to keep
one suite and adopt the improvements from §5.16 in Playwright. The §6.7 pilot
is built and works technically: tests read as their spec, the lint keeps them
aligned, and the rewrite made four assertions stronger. It hasn't yet answered
the deciding question, whether non-developers will write tests with it
(§6.7.3). That is the next thing to try.
