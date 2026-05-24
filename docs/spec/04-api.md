# 4. API Behaviour

All endpoints require a valid authenticated session (JWT cookie). Requests without authentication return 401.

## 4.1 GET /api/sessions

#### SC-4.1.1 Authenticated GET returns 200 with sessions
> **Tests:** none

**Given** the request includes a valid authenticated session  
**When** a GET request is made to `/api/sessions`  
**Then** a 200 response is returned containing an array of sessions owned by the authenticated user  
**And** each session includes: `id`, `title`, `createdAt`, `userId`

#### SC-4.1.2 Unauthenticated GET returns 401
> **Tests:** none

**Given** the request is unauthenticated  
**When** a GET request is made to `/api/sessions`  
**Then** a 401 response is returned

#### SC-4.1.3 Server error returns 500
> **Tests:** none

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to list sessions"`

---

## 4.2 POST /api/sessions

#### SC-4.2.1 Authenticated POST with valid title returns 201
> **Tests:** none

**Given** the request includes a valid authenticated session and a valid request body `{ title }`  
**When** a POST request is made to `/api/sessions`  
**Then** a 201 response is returned containing the full created session object  
**And** the session's `userId` is set to the authenticated user's id

#### SC-4.2.2 Unauthenticated POST returns 401
> **Tests:** none

**Given** the request is unauthenticated  
**When** a POST request is made to `/api/sessions`  
**Then** a 401 response is returned

#### SC-4.2.3 POST with empty title returns 400
> **Tests:** none

**Given** the request body has a missing or empty title  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

#### SC-4.2.4 POST with title over 200 chars returns 400
> **Tests:** none

**Given** the request body has a title longer than 200 characters  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

#### SC-4.2.5 Server error during creation returns 500
> **Tests:** none

**Given** a server error occurs during creation  
**When** a POST request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to create session"`

---

## 4.3 GET /api/sessions/[id]

#### SC-4.3.1 Authenticated GET existing session returns 200
> **Tests:** none

**Given** the request includes a valid authenticated session and the session exists  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 200 response is returned containing the full session object

#### SC-4.3.2 Unauthenticated GET returns 401
> **Tests:** none

**Given** the request is unauthenticated  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 401 response is returned

#### SC-4.3.3 Session not found returns 404
> **Tests:** none

**Given** the session does not exist  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 404 response is returned

#### SC-4.3.4 Server error returns 500
> **Tests:** none

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned

---

## 4.4 DELETE /api/sessions/[id]

#### SC-4.4.1 Owner DELETE returns 204
> **Tests:** none

**Given** the request includes a valid authenticated session and the authenticated user owns the session  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** the session is deleted from the database  
**And** a 204 No Content response is returned

#### SC-4.4.2 Unauthenticated DELETE returns 401
> **Tests:** none

**Given** the request is unauthenticated  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 401 response is returned

#### SC-4.4.3 Non-owner DELETE returns 403
> **Tests:** none

**Given** the request is authenticated but the user does not own the session  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 403 response is returned

#### SC-4.4.4 Server error DELETE returns 500
> **Tests:** none

**Given** a server error occurs  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned
