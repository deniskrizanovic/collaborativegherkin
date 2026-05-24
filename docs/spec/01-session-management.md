# 1. Session Management

## 1.1 Listing sessions

#### SC-1.1.1 Sessions listed newest first
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts) — list visible after creating · order

**Given** a signed-in user visits the home page  
**When** sessions exist in the database that were created by that user  
**Then** the user sees a list of their sessions ordered by creation date, newest first  
**And** each entry shows the session title and a human-readable creation timestamp  
**And** each entry is a link that navigates to that session's editor

#### SC-1.1.2 No sessions shows empty state
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** a signed-in user visits the home page  
**When** no sessions exist in the database for that user  
**Then** the session list is empty and only the creation form is shown

---

## 1.2 Creating a session

#### SC-1.2.1 Valid title creates session and redirects
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** the user is on the home page  
**When** the user enters a title of between 1 and 200 characters and submits the form  
**Then** a new session is created in the database  
**And** the user is redirected to the new session's editor page

#### SC-1.2.2 Empty title disables Create button
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** the user is on the home page  
**When** the user submits the form with an empty title  
**Then** a validation error is displayed and no session is created  
**And** the Create button remains disabled while the title field is empty

#### SC-1.2.3 Title over 200 chars shows validation error
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** the user is on the home page  
**When** the user submits the form with a title exceeding 200 characters  
**Then** a validation error is displayed and no session is created

#### SC-1.2.4 Server error shows error message
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** the user is on the home page  
**When** the server returns an error during session creation  
**Then** a "Network error" or server error message is shown  
**And** the user remains on the home page

---

## 1.3 Joining a session

#### SC-1.3.1 Valid session ID loads editor with title
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** a session exists  
**When** a user navigates directly to `/sessions/{id}`  
**Then** the editor loads for that session  
**And** the session title is displayed in the header

#### SC-1.3.2 Invalid session ID returns 404
> **Tests:** none

**Given** a session ID does not exist in the database  
**When** a user navigates to `/sessions/{id}`  
**Then** a 404 response is returned and the session page is not rendered

---

## 1.4 Sharing a session

#### SC-1.4.1 Copy invite link copies URL and shows Copied!
> **Tests:** [`e2e/home.spec.ts`](../../e2e/home.spec.ts)

**Given** a user is on a session page  
**When** the user clicks "Copy invite link"  
**Then** the full URL of the current page is copied to the clipboard  
**And** the button label changes to "Copied!" for 2 seconds  
**And** then reverts to "Copy invite link"

---

## 1.5 Deleting a session

#### SC-1.5.1 Owner can delete session
> **Tests:** none

**Given** a session exists and the request is authenticated as the session owner  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** the session is removed from the database  
**And** a 204 No Content response is returned

#### SC-1.5.2 Unauthenticated delete returns 401
> **Tests:** none

**Given** a DELETE request is made to `/api/sessions/{id}` without authentication  
**Then** a 401 Unauthorized response is returned

#### SC-1.5.3 Non-owner delete returns 403
> **Tests:** none

**Given** a DELETE request is made to `/api/sessions/{id}` by a signed-in user who is not the session owner  
**Then** a 403 Forbidden response is returned
