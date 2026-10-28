*** Settings ***
Documentation       Port of e2e/export.spec.ts — spec §3.6 (TXT export) and §3.9
...                 (Markdown export). Each test types into the scaffold blocks,
...                 downloads the export, then asserts the exact filename and the
...                 exact content line by line.

Resource            ../resources/common.resource
Resource            ../resources/session.resource
Resource            ../resources/files.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Remove Temp Files

Test Tags           chunk3    export


*** Test Cases ***
SC-3.6.1: Export downloads plain-text file in document order — correct content
    Open Session
    Type Into Block    feature    User login
    Type Into Block    scenario    Successful login
    Type Into Block    given    the user is on the login page
    Type Into Block    when    the user enters valid credentials
    Type Into Block    then    the user is redirected to the dashboard
    ${path}    ${filename}=    Download Via Button    .gherkin-export-btn
    Should Be Equal    ${filename}    gherkin.txt
    ${lines}=    Read Lines    ${path}
    Should Be Equal    ${lines}[0]    Feature: User login
    Should Be Equal    ${lines}[1]    Scenario: Successful login
    Should Be Equal    ${lines}[2]    Given: the user is on the login page
    Should Be Equal    ${lines}[3]    When: the user enters valid credentials
    Should Be Equal    ${lines}[4]    Then: the user is redirected to the dashboard

SC-3.6.1: Export downloads plain-text file in document order — block order
    Open Session
    Type Into Block    feature    Ordering
    Type Into Block    scenario    First scenario
    Type Into Block    given    a starting state
    ${path}    ${filename}=    Download Via Button    .gherkin-export-btn
    ${lines}=    Read Lines    ${path}
    Should Match Regexp    ${lines}[0]    ^Feature:
    Should Match Regexp    ${lines}[1]    ^Scenario:
    Should Match Regexp    ${lines}[2]    ^Given:

SC-3.6.1: Export downloads plain-text file in document order — image data-URI included
    Open Session
    ${png}=    Write Tiny PNG
    Click    [data-gherkin-type="then"] >> nth=-1
    ${image_button}=    Toolbar Button    Image
    Click    ${image_button}
    Upload File By Selector    input[type="file"]    ${png}
    Wait For Elements State    .gherkin-image-block    visible
    ${path}    ${filename}=    Download Via Button    .gherkin-export-btn
    ${content}=    Get File    ${path}    encoding=UTF-8
    Should Contain    ${content}    data:image

SC-3.9.1: Export MD downloads markdown file in document order
    Open Session
    Type Into Block    feature    User login
    Type Into Block    scenario    Successful login
    Type Into Block    given    the user is on the login page
    ${path}    ${filename}=    Download Via Button    .gherkin-export-md-btn    md
    Should Be Equal    ${filename}    gherkin.md
    ${lines}=    Read Lines    ${path}
    Should Be Equal    ${lines}[0]    \# Feature: User login
    Should Be Equal    ${lines}[1]    \## Scenario: Successful login
    Should Be Equal    ${lines}[2]    - Given: the user is on the login page
