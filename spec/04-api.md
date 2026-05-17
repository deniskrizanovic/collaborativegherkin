# 4. API Behaviour

## 4.1 GET /api/sessions

**Given** sessions exist  
**When** a GET request is made to `/api/sessions`  
**Then** a 200 response is returned containing an array of all sessions  
**And** each session includes: `id`, `title`, `createdAt`, `userId`

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to list sessions"`

---

## 4.2 POST /api/sessions

**Given** a valid request body `{ title, userId }`  
**When** a POST request is made to `/api/sessions`  
**Then** a 201 response is returned containing the full created session object

**Given** the request body has a missing or empty title  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** the request body has a title longer than 200 characters  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** the request body has a `userId` that is not a valid CUID  
**When** a POST request is made to `/api/sessions`  
**Then** a 400 response is returned with field-level validation errors

**Given** a server error occurs during creation  
**When** a POST request is made to `/api/sessions`  
**Then** a 500 response is returned with the message `"Failed to create session"`

---

## 4.3 GET /api/sessions/[id]

**Given** the session exists  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 200 response is returned containing the full session object

**Given** the session does not exist  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 404 response is returned

**Given** a server error occurs  
**When** a GET request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned

---

## 4.4 DELETE /api/sessions/[id]

**Given** the session exists  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** the session is deleted from the database  
**And** a 204 No Content response is returned

**Given** a server error occurs  
**When** a DELETE request is made to `/api/sessions/{id}`  
**Then** a 500 response is returned
