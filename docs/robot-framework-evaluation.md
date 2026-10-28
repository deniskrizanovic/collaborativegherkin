# Robot Framework for the e2e suite: pros, cons, and how robustness was kept

Status as of 2026-10-29: chunks 0–2 of the OpenSpec change
`add-robot-framework-e2e-suite` (issue #42) are ported. The last run of
`pnpm test:robot` passed 53 of 53 tests: 1 smoke, 27 in chunk 1, 25 in chunk 2.
Chunks 3–6 (downloads, routes, multi-context, WebSocket) are still pending, so
this document says which claims have been proven and which are still planned.

Stack: Robot Framework 7.5, `robotframework-browser` 20.6.0 (Playwright
underneath), Python 3.13 managed by `uv`.

Ported so far:

| Playwright spec | Robot suite | Tests | TS lines | Robot lines |
|---|---|---|---|---|
| `initial-content.spec.ts` | `initial_content.robot` | 3 | 29 | 31 |
| `toolbar.spec.ts` | `toolbar.robot` | 5 | 45 | 48 |
| `import.spec.ts` | `import.robot` | 11 | 135 | 129 |
| `home.spec.ts` (minus SC-1.2.4) | `home.robot` | 8 | 98 | 82 |
| `enter-progression.spec.ts` (minus SC-3.2.2) | `enter_progression.robot` | 9 | 200 | 129 |
| `block-picker.spec.ts` | `block_picker.robot` | 9 | 154 | 136 |
| `visual-separation.spec.ts` (minus export) | `visual_separation.robot` | 7 | 189 | 89 |

The TS line counts include the tests that have not been ported yet, so the
comparison flatters Robot a little for `enter-progression` and
`visual-separation`.

---

## 1. What Robot Framework is

Robot Framework is a keyword-driven test runner written in Python. A test is a
list of steps, and each step is a *keyword* followed by its arguments. Keywords
come from libraries (here mainly `Browser`, which wraps Playwright) or from
`.resource` files we write. A user keyword is just a named list of other
keywords.

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

FOR    ${session}    IN    @{list}[body]                  # iterate a response body
    Call API    DELETE    /api/sessions/${session}[id]
END
```

`${x}` is a scalar, `@{x}` a list that expands into cells, `&{x}` a dict, and
`${x}[key]` indexes into one.

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
Import Gherkin
    [Arguments]    @{lines}
    ${text}=    Catenate    SEPARATOR=\n    @{lines}
    Click    ${IMPORT_BTN}
    Fill Text    ${TEXTAREA}    ${text}
    Click    ${CONFIRM}
```

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
# Python expression, evaluated by Robot
${i}=    Evaluate    $types.index("background")
Should Be True
...    ("then", "and") in list(zip($types, $types[1:]))
...    No then → and pair in ${types}

# JavaScript, evaluated in the page (home.robot, SC-1.2.3)
Evaluate JavaScript    ${TITLE_INPUT}
...    (el, value) => {
...        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
...        setter.call(el, value);
...        el.dispatchEvent(new Event("input", { bubbles: true }));
...        el.dispatchEvent(new Event("change", { bubbles: true }));
...    }
...    arg=${long_title}
```

### 2.7 Playwright → Browser library cheat-sheet (the most common calls)

| Playwright | Browser library |
|---|---|
| `expect(loc).toHaveCount(n)` | `Get Element Count    ${sel}    ==    ${n}` |
| `expect(loc).toHaveText(t)` | `Get Text    ${sel}    ==    ${t}` |
| `toBeVisible` / `not.toBeVisible` | `Wait For Elements State    ${sel}    visible` / `hidden` |
| `toBeDisabled` | `Wait For Elements State    ${sel}    disabled` |
| `toHaveCSS("background", /x/)` | `Get Style    ${sel}    background    *=    x` |
| `.last()` / `.nth(i)` | `${sel} >> nth=-1` / `${sel} >> nth=${i}` |
| `locator(x, { hasText })` | `x:has-text("…")` |
| `keyboard.press("Enter")` | `Keyboard Key    press    Enter` |
| `keyboard.type("/")` | `Keyboard Input    type    /` |
| `mouse.click(10, 10)` | `Mouse Button    click    10    10` |
| `evaluateAll(fn)` | `Evaluate JavaScript    ${sel}    fn    all_elements=True` |
| `context.grantPermissions([...])` | `Grant Permissions    clipboard-read    clipboard-write` |

The full table is in `robot/README.md`.

---

## 3. Pros

**Tests read as steps.** Without `await`, `page.locator(...)` and `expect`,
each line is one action or one check. `visual_separation.robot` is 89 lines
against 189 for the TS file. The biggest win comes from pulling the repeated
setup into a suite-local keyword (`Build Feature To Then`) and dropping the
`evaluate(getComputedStyle)` boilerplate for `Get Style`.

**Same engine underneath.** Browser drives Playwright, so contexts,
storage-state auth, auto-waiting, routes, downloads and traces are the same
concepts. A failing Robot test can be opened in the Playwright trace viewer
(`--variable TRACE:True`, then `uv run rfbrowser show-trace …`).

**Reports are good out of the box.** `robot/results/log.html` shows every
keyword of every test, nested, with arguments, timings and a screenshot on
failure. A non-developer can follow a failure there without reading code.
Playwright's `list` reporter, which this project uses, gives only a stack
trace.

**Assertions are built into getters.** `Get Text    .x    ==    Copied!`
both reads and asserts, and it retries until the browser timeout. Because the
assertion form is short, it gets used, and there's less temptation to read a
value once and assert on it without retrying.

**Tag-based selection.** `--include chunk2`, `--include block-picker` and
`--exclude skip` can be combined freely. Playwright offers `--grep` on titles
only.

**Keyword layers can rise toward business language.** It isn't used yet (the
design deliberately keeps tests at the Playwright abstraction level so that
parity can be checked line by line), but Robot lets a later layer read like
`Given a session with a Feature block` without a separate Cucumber toolchain.
That fits a Gherkin product.

**Readable by non-TypeScript people.** QA staff and BAs can usually read and
edit `.robot` files after an hour with the README primer.

---

## 4. Cons

**Two toolchains, two Playwright versions.** The repo now needs Node *and*
Python (`uv`, `pyproject.toml`, `uv.lock`), plus `rfbrowser init`, which
downloads its own Playwright and Chromium. The app's `@playwright/test` and
Browser's bundled Playwright can drift apart. CI time roughly doubles while both
suites run (design D13 accepts this).

**Whitespace is syntax.** One space where two were needed silently turns two
arguments into one argument with a space in it. The error that results is
often far from the cause. Editors without a Robot plugin give no help.

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

Even small helpers like `Last Index Of` need a one-line Python expression.

**Weaker tooling than TypeScript.** There's no type checking. Keyword names
resolve at runtime, so a typo in a keyword name only fails when that line
runs. Go-to-definition and rename depend on an IDE plugin (RobotCode in VS Code
or IntelliJ).

**Hard cases need custom code anyway.** Held network routes (`llm-review`) and
the raw WebSocket probe (`websocket-auth`) can't be expressed with built-in
keywords. The plan is a `routes.js` jsextension and a `WebSocketProbe.py`
library (D8, D9), so for those tests contributors still have to write JS or
Python.

**Two suites to maintain forever.** Both suites are kept permanently, so every
UI change that breaks a selector has to be fixed twice, and `PARITY.md` has to
stay in sync.

**Shared database means serial runs.** Both suites hit the same SQLite DB, and
`home` deletes every session, so they can't run concurrently (`e2e:all` uses
`run-s`).

**Debugging is one step removed.** There's no `page.pause()` or
`--debug`-style stepping out of the box. The options are `HEADLESS:False`,
traces, and the log.

---

## 5. How Playwright's robustness has been kept

Over time the Playwright suite picked up techniques that a naive port would
lose. The rule for the port (design, "Goals") is full test-for-test parity
with every technique kept, and `robot/PARITY.md` lists the required assertions
for each test. This section shows how each technique that is already ported
was carried over.

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

In one place the port is *stronger* than the original. In
`visual-separation.spec.ts` the border check was a one-shot read with no retry:

```ts
const borderTop = await lastGiven.evaluate((el) => window.getComputedStyle(el).borderTopWidth);
expect(borderTop).toBe("1px");
```

The Robot version retries until the CSS settles:

```robot
Get Style    [data-gherkin-type="given"] >> nth=-1    border-top-width    ==    1px
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
before `Keyboard Key` / `Keyboard Input`, step for step:

```robot
Click    [data-gherkin-type="scenario"] >> nth=-1
Keyboard Key    press    End
Keyboard Key    press    Enter
```

`Open Session` ends with the same `Click` on the Feature block that
`openSession` does.

### 5.4 Exact assertions, not weaker ones

Counts, orders and texts are asserted exactly as strictly as in the original.
PARITY.md lists the assertions so that a reviewer can catch a weakened port.

```ts
await expect(editorBlocks).toHaveCount(5);
expect(types[1]).not.toBe("scenario");
```
```robot
Get Element Count    ${BLOCKS}    ==    5
${types}=    Block Types In Editor
Should Not Be Equal    ${types}[1]    scenario
```

The smoke test and `initial_content.robot` compare the whole block-type list
for equality (`Should Be Equal    ${types}    ${expected}`), not just a
membership check.

### 5.5 Computed-style checks

Focus in the block picker is shown only by a background colour, so the test
asserts the computed CSS:

```ts
await expect(firstBtn).toHaveCSS("background", /rgba\(0, 38, 100, 0\.06\)/);
```
```robot
${FOCUSED_BG}       rgba(0, 38, 100, 0.06)
Get Style    ${PICKER} >> button >> nth=0    background    *=    ${FOCUSED_BG}
```

`*=` is "contains", the equivalent of the unanchored regex. Both forms retry.

### 5.6 Test isolation equal to a Playwright fixture

Each test gets a fresh browser context, signed in from the same storage-state
file, with the same `baseURL` and `acceptDownloads` settings:

```robot
Open Owner Context And Page
    ${tracing}=    Trace File For Test
    New Context    storageState=${OWNER_STATE}    baseURL=${BASE_URL}    acceptDownloads=True
    ...    tracing=${tracing}
    New Page
```

Browser's default `auto_closing_level=TEST` closes every context and page a
test opened, including extra second-user contexts. That replaces the
`try { … } finally { context2.close() }` blocks of the TS suite, and it can't
be forgotten. Every test still creates its own session through the API, as in
the original.

### 5.7 One auth path for both suites

The Robot suite doesn't re-implement NextAuth JWT encoding in Python.
`scripts/run-robot.mjs` calls the *same* `e2e/global-setup.ts` (through
`scripts/mint-e2e-auth.ts`) to write `e2e/.auth/user.json` and `user2.json`
(design D3). If the auth scheme changes, both suites break or pass together.

### 5.8 Setup through the API, on the page's own cookies

`createSession` uses `page.request`, which carries the context's cookies. The
port uses Browser's `Http`, which runs `fetch` inside the page and so uses the
same cookies. The port also asserts the status code, which the original didn't:

```robot
Create Session Via API
    [Arguments]    ${title}
    ${payload}=    Evaluate    json.dumps({"title": $title})    modules=json
    ${response}=    Call API    POST    /api/sessions    ${payload}
    Should Be Equal As Integers    ${response}[status]    201
    RETURN    ${response}[body][id]
```

### 5.9 Same server lifecycle

The runner copies Playwright's `webServer.reuseExistingServer: true`. It
reuses a dev server already on `:3000`, otherwise starts `pnpm dev`, waits up
to 120 s, and stops the server only if it started it.

### 5.10 React-aware input tricks preserved

SC-1.2.3 has to get past `maxLength` *and* still fire React's synthetic
`onChange`. The port keeps the native-value-setter technique word for word
(see §2.6) rather than switching to `Fill Text`, which would be blocked by
`maxLength` and make the test pass for the wrong reason.

### 5.11 No sleeps

Neither suite uses a fixed wait. In Robot, `Sleep` is banned by convention
(README), and a lint gate (`pnpm lint:robot`, design D10) is planned for
chunk 7. **That gate doesn't exist yet**, so for now the rule is enforced only
in review.

### 5.12 Parity preserves weaknesses too

The port copies the original step for step, including its weak spots. For
example, `feature → scenario` in `enter_progression.robot` presses Enter and
then reads the block types once, with no wait, exactly as the TS test does.
Both suites pass today, but both carry the same small race. The parity rule
deliberately doesn't fix these during the port. They're worth a follow-up in
both suites at once.

---

## 6. Techniques not yet proven (chunks 3–6)

The following techniques have a planned mapping in `design.md`, but nothing
has run them yet. Treat them as claims until their chunk is green.

| Technique | Playwright | Planned Robot approach | Chunk |
|---|---|---|---|
| Download + filename + per-line content | `waitForEvent("download")`, `saveAs` | `Promise To Wait For Download` → `Wait For` → `${d}[suggestedFilename]`, read the file | 3 |
| Generated PNG upload | `setInputFiles` | `Upload File By Selector` + `files.resource` temp-file teardown | 3 |
| Synthetic `DataTransfer` drop | `page.evaluate` | `Evaluate JavaScript` (same body) | 3 |
| Mocked / method-conditional routes | `page.route(...).fulfill / continue` | `routes.js` jsextension: `Fulfill Route` | 4 |
| Held route released by the test | route handler awaits a promise | `Hold Route` / `Release Route` (spike test first, as flagged in design risks) | 4 |
| Response wait paired with its action | `Promise.all([waitForResponse, action])` | `Promise To    Wait For Response` → action → `Wait For` | 5 |
| Second identity, two live contexts | `browser.newContext({ storageState: user2 })` | second `New Context    storageState=${OTHER_STATE}`, auto-closed | 5 |
| API contract as non-owner | `request.newContext` | RequestsLibrary `DELETE On Session … expected_status=403` | 5 |
| Raw WebSocket with exact `Cookie` header | `ws` client | `WebSocketProbe.py` (`websockets.sync.client`) | 6 |

Chunks 4 and 6 carry the most risk, because those are the places where Robot
needs custom JS or Python code rather than built-in keywords.

---

## 7. Verdict so far

For the UI suites ported so far, Robot with the Browser library keeps every
robustness technique, sometimes with less code. In one place (computed-style
checks) it's slightly stronger. The cost is a second toolchain, a second copy
of every test, and awkward inline logic. The return is readable tests, rich
HTML logs, and a route toward business-language keywords.

Whether the trade pays off depends mostly on chunks 4–6. If held routes and
the WebSocket probe stay small and readable, the Robot suite is a credible
equal to the Playwright one. If they grow into large JS/Python libraries,
Robot is only wrapping code that would be simpler to keep in TypeScript.
