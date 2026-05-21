# 5. Data Model Constraints

**Given** a session is created  
**Then** its `id` is a CUID  
**And** its `title` is a non-empty string of at most 200 characters  
**And** its `createdAt` is set automatically at creation time  
**And** its `updatedAt` is updated automatically on every save  
**And** it is associated with exactly one `User` record via `userId`

**Given** a user record exists  
**Then** its `email` is unique across all users  
**And** a user may own zero or more sessions
