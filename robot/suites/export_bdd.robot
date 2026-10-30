*** Settings ***
Documentation       Business-language twin of export.robot and of the export
...                 tests in data_table.robot: spec §3.6 / §3.9 / §3.11 export
...                 (openspec/specs/gherkin-export/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/gherkin_export.resource and
...                 shared.resource. Documents and tables are test data in
...                 *** Variables ***: a document maps block type to the text
...                 typed into it, a table is a list of rows. The Then steps
...                 compare the downloaded file with the editor's content.
...                 `SC-3.9.1 — image inline` has no technical twin: it covers
...                 the image line of the Markdown export.

Resource            ../resources/common.resource
Resource            ../resources/files.resource
Resource            ../resources/steps/gherkin_export.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           bdd    export


*** Variables ***
&{LOGIN_DOCUMENT}
...                 feature=User login
...                 scenario=Successful login
...                 given=the user is on the login page
...                 when=the user enters valid credentials
...                 then=the user is redirected to the dashboard
&{ORDERING_DOCUMENT}
...                 feature=Ordering
...                 scenario=First scenario
...                 given=a starting state
# Every keyword type, so both markdown lines are checked for all of them.
&{ALL_KEYWORDS_DOCUMENT}
...                 feature=Checkout
...                 rule=Orders need a payment
...                 background=a signed-in shopper
...                 scenario=Paying by card
...                 given=a basket with one item
...                 when=the shopper pays
...                 then=the order is confirmed
...                 and=a receipt is sent
...                 but=no second charge is made
# Header row, then two body rows of different widths.
${USERS_TABLE}      ${{[["name", "role"], ["Alice", "admin"], ["Bob", "user"]]}}


*** Test Cases ***
SC-3.6.1: Export downloads plain-text file in document order — correct content
    Given a user is in a session editor with ${LOGIN_DOCUMENT}
    When the user clicks the Export button
    Then a plain-text file is downloaded
    And keyword blocks appear as one line each in the format Keyword: text
    And all lines appear in document order

SC-3.6.1: Export downloads plain-text file in document order — block order
    Given a user is in a session editor with ${ORDERING_DOCUMENT}
    When the user clicks the Export button
    Then all lines appear in document order

SC-3.6.1: Export downloads plain-text file in document order — image data-URI included
    Given a user is in a session editor with ${ORDERING_DOCUMENT} and an image after the Then block
    When the user clicks the Export button
    Then image blocks appear as one line each containing the full base64 data-URI
    And all lines appear in document order

SC-3.9.1: Export MD downloads markdown file in document order — all keyword types
    Given a user is in a session editor with ${ALL_KEYWORDS_DOCUMENT}
    When the user clicks the Export MD button
    Then a markdown file gherkin.md is downloaded
    And feature, rule, background, and scenario blocks appear as markdown headers
    And given, when, then, and, and but blocks appear as markdown list items
    And all blocks appear in document order

SC-3.9.1: Export MD downloads markdown file in document order — image inline
    Given a user is in a session editor with ${LOGIN_DOCUMENT} and an image after the Then block
    When the user clicks the Export MD button
    Then image blocks appear as inline images using ![alt](src) syntax
    And all blocks appear in document order

SC-3.11.7: TXT export uses pipe-delimited rows padded to column width
    Given a data table block is present with ${USERS_TABLE}
    When the user exports as TXT
    Then each row appears as one line in | cell | cell | format with cells padded to column width

SC-3.11.8: MD export uses header row with separator
    Given a data table block is present with ${USERS_TABLE}
    When the user exports as MD
    Then the first row is the header row
    And a | --- | --- | separator row follows the header
    And subsequent rows follow in order
