*** Settings ***
Documentation       Shared setup for every browser-driven Robot suite.
...
...                 Equivalent of Playwright's config + per-test fixtures:
...                 one browser per suite, a fresh owner-authenticated context
...                 and page per test. Browser's default auto_closing_level=TEST
...                 closes every context and page a test opened, so extra
...                 contexts never leak between tests (the try/finally of the
...                 Playwright suite).
...
...                 Browser is imported here only, with the routes.cjs extension
...                 (Fulfill Route, Hold Route, Release Route, Clear Routes).
...                 Other resources get it by importing this file.

Library             Browser    jsextension=${CURDIR}/../libraries/routes.cjs
Resource            variables.resource


*** Variables ***
# Override with: pnpm test:robot --variable HEADLESS:False
${HEADLESS}         True
# Screenshot at the end of every test, pass or fail (failures always get one).
# Enable with: pnpm test:robot --variable SCREENSHOTS:True
${SCREENSHOTS}      False
# Record a Playwright trace per test into robot/results/traces/<test>.zip.
# Enable with: pnpm test:robot --variable TRACE:True
# Open with:   uv run rfbrowser show-trace robot/results/traces/<test>.zip
${TRACE}            False


*** Keywords ***
Open Browser For Suite
    [Documentation]    Suite Setup: one Chromium browser for the whole suite.
    ...    The 5 s timeout matches Playwright's default `expect` timeout.
    New Browser    chromium    headless=${HEADLESS}
    Set Browser Timeout    5s

Open Owner Context And Page
    [Documentation]    Test Setup: fresh context signed in as the owner
    ...    (user.json), plus a page. Same as Playwright's default fixture.
    ${tracing}=    Trace File For Test
    New Context    storageState=${OWNER_STATE}    baseURL=${BASE_URL}    acceptDownloads=True
    ...    tracing=${tracing}
    New Page

Finish Test
    [Documentation]    Test Teardown: drop any route handlers so a held route
    ...    cannot outlive its test, then a full-page screenshot into log.html
    ...    when ${SCREENSHOTS} is True. Routes are cleared first so cleanup
    ...    never depends on the screenshot. Browser then closes the contexts.
    Clear Routes
    IF    ${SCREENSHOTS}    Take Screenshot    fullPage=True

Trace File For Test
    [Documentation]    Return the trace path for the current test when ${TRACE}
    ...    is True, else ${None} (no tracing). Pass the result as `tracing=` to
    ...    every `New Context` a test opens. The name is the test name with
    ...    unsafe characters replaced; ${suffix} tells extra contexts apart.
    [Arguments]    ${suffix}=${EMPTY}
    IF    not ${TRACE}    RETURN    ${None}
    ${name}=    Evaluate    re.sub(r"[^A-Za-z0-9._-]+", "_", $TEST_NAME).strip("_")    modules=re
    RETURN    traces/${name}${suffix}.zip
