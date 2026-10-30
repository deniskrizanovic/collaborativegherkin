*** Settings ***
Documentation       Business-language twin of collaboration.robot: spec §3.5
...                 real-time collaboration
...                 (openspec/specs/realtime-collaboration/spec.md).
...
...                 Each test is the GIVEN/WHEN/THEN lines of its scenario; the
...                 steps live in ../resources/steps/realtime_collaboration.resource.
...                 Every user is a separate browser context, so the change has
...                 to travel through the WebSocket server. The SC-3.1.2
...                 second-joiner test lives in initial_content_bdd.robot, with
...                 the rest of its scenario. SC-3.5.2 (remote cursors) is
...                 excluded: it is skipped in the technical suite, since the
...                 collaboration-cursor extension has no stable Tiptap 3 release.

Resource            ../resources/common.resource
Resource            ../resources/steps/realtime_collaboration.resource

Suite Setup         Open Browser For Suite
Test Setup          Open Owner Context And Page
Test Teardown       Finish Test

Test Tags           bdd    collaboration


*** Test Cases ***
SC-3.5.1: Change by one user is visible to all in real time — types
    Given two or more users have the same session URL open
    When one user types or inserts a block — types
    Then all other connected users see the change reflected in their editors in real time

SC-3.5.1: Change by one user is visible to all in real time — inserts a block
    Given two or more users have the same session URL open
    When one user types or inserts a block — inserts a block
    Then all other connected users see the change reflected in their editors in real time
