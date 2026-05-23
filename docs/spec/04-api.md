# 4. API Behaviour

All endpoints require a valid authenticated session (JWT cookie). Requests without authentication return 401.

## 4.1 GET /api/sessions

**Given** the request includes a valid authenticated session  
**When** a GET request is made to `/api/sessions`  
**Then** a 200 response is returned containing an array of sessions owned by the authenticated user  
**And** each session includes: `id`, `title`, `createdAt`, `userId`

**Given** the request is unauthenticated  
**When** a GET request is made to `/api/sessions`  
**Then** a 401 response is returned

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to list sessions"`

---

## 4.2 POST /api/sessions

**Given** the request includes a valid authenticated session and a valid request body `{ title }`  
**When** a POST request is made to `/api/sessions`  
**Then** a 201 response is returned containing the full created session object  
**And** the session's `userId` is set to the authenticated user's id

**Given** the request is unauthenticated  
**When** a POST request is made to `/api/sessions`  
**Then** a 401 response is returned

**Given** the request body has a missing or empty title  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** the request body has a title longer than 200 characters  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** a server error occurs during creation  
**When** a POST request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to create session"`

---

## 4.3 GET /api/sessions/[id]

**Given** the request includes a valid authenticated session and the session exists  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 200 response is returned containing the full session object

**Given** the request is unauthenticated  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 401 response is returned

**Given** the session does not exist  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 404 response is returned

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned

---

## 4.4 DELETE /api/sessions/[id]

**Given** the request includes a valid authenticated session and the authenticated user owns the session  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** the session is deleted from the database  
**And** a 204 No Content response is returned

**Given** the request is unauthenticated  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 401 response is returned

**Given** the request is authenticated but the user does not own the session  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 403 response is returned

**Given** a server error occurs  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned
