# ---------------------------------------------------------------------------
# Smoke test: proves the toolchain works end to end (auth, server, browser).
#
# A .robot file is split into sections, each starting with *** Name ***.
# Inside a section, cells are separated by TWO OR MORE spaces (we use 4).
# A single space is part of the value, so "Open Session" is one keyword name.
# See robot/README.md for a fuller primer.
# ---------------------------------------------------------------------------

*** Settings ***
Documentation       Smoke test: a new session opens with the 5 scaffold blocks.

# Resource files hold shared keywords and variables (like TS imports).
Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/editor.resource

# Runs once before any test in this file: start Chromium.
Suite Setup         Open Browser For Suite
# Runs before each test: fresh context signed in as the owner, plus a page.
# Browser closes that context automatically after the test.
Test Setup          Open Owner Context And Page
# Runs after each test, even when it fails (Robot's try/finally).
Test Teardown       Finish Test


*** Test Cases ***
# A test case is a name (starting in column 1) followed by indented steps.
Smoke: new session shows the scaffold blocks in order
    # [Tags] let you select tests: pnpm test:robot --include smoke
    [Tags]    chunk0    smoke
    # Create a session through the API, open it, click the Feature block.
    Open Session
    # ${types}= stores the keyword's return value in a variable.
    ${types}=    Block Types In Editor
    # @{list} expands to a list; Create List builds one from cells.
    @{expected}=    Create List    feature    scenario    given    when    then
    Should Be Equal    ${types}    ${expected}
