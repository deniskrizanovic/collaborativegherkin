# session-management Specification

## Purpose

Creating, listing, joining, and sharing collaborative Gherkin editing
sessions. (Deleting a session is governed by `session-access-control`.)

## Requirements

### Requirement: Listing sessions

A signed-in user SHALL see the sessions they own on the home page, ordered by
creation date newest first. Each entry MUST show the session title, a
human-readable creation timestamp, and MUST link to that session's editor. When
the user owns no sessions the list MUST be empty and only the creation form is
shown.

#### Scenario: Sessions listed newest first
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts) — list visible after creating · order
- **GIVEN** a signed-in user visits the home page
- **WHEN** sessions exist in the database that were created by that user
- **THEN** the user sees a list of their sessions ordered by creation date, newest first
- **AND** each entry shows the session title and a human-readable creation timestamp
- **AND** each entry is a link that navigates to that session's editor

#### Scenario: No sessions shows empty state
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** a signed-in user visits the home page
- **WHEN** no sessions exist in the database for that user
- **THEN** the session list is empty and only the creation form is shown

### Requirement: Creating a session

A signed-in user SHALL create a session from the home page by submitting a
title of between 1 and 200 characters. A valid submission MUST create the
session and redirect the user to its editor. An empty title MUST keep the
Create button disabled and create no session; a title over 200 characters MUST
show a validation error and create no session; a server error MUST show an
error message and leave the user on the home page.

#### Scenario: Valid title creates session and redirects
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** the user is on the home page
- **WHEN** the user enters a title of between 1 and 200 characters and submits the form
- **THEN** a new session is created in the database
- **AND** the user is redirected to the new session's editor page

#### Scenario: Empty title disables Create button
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** the user is on the home page
- **WHEN** the user submits the form with an empty title
- **THEN** a validation error is displayed and no session is created
- **AND** the Create button remains disabled while the title field is empty

#### Scenario: Title over 200 chars shows validation error
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** the user is on the home page
- **WHEN** the user submits the form with a title exceeding 200 characters
- **THEN** a validation error is displayed and no session is created

#### Scenario: Server error shows error message
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** the user is on the home page
- **WHEN** the server returns an error during session creation
- **THEN** a "Network error" or server error message is shown
- **AND** the user remains on the home page

### Requirement: Joining a session

Navigating directly to `/sessions/{id}` for an existing session SHALL load that
session's editor with its title in the header. A session id that does not exist
MUST return a 404 and MUST NOT render the session page.

#### Scenario: Valid session ID loads editor with title
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** a session exists
- **WHEN** a user navigates directly to `/sessions/{id}`
- **THEN** the editor loads for that session
- **AND** the session title is displayed in the header

#### Scenario: Invalid session ID returns 404
> **Tests:** none
- **GIVEN** a session ID does not exist in the database
- **WHEN** a user navigates to `/sessions/{id}`
- **THEN** a 404 response is returned and the session page is not rendered

### Requirement: Sharing a session

From a session page the user SHALL be able to copy an invite link. Clicking
"Copy invite link" MUST copy the current page's full URL to the clipboard and
change the button label to "Copied!" for 2 seconds before reverting.

#### Scenario: Copy invite link copies URL and shows Copied!
> **Tests:** [`e2e/home.spec.ts`](../../../e2e/home.spec.ts)
- **GIVEN** a user is on a session page
- **WHEN** the user clicks "Copy invite link"
- **THEN** the full URL of the current page is copied to the clipboard
- **AND** the button label changes to "Copied!" for 2 seconds
- **AND** then reverts to "Copy invite link"
