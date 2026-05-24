# 5. Data Model Constraints

#### SC-5.1 Session has CUID, title constraints, timestamps, and user
> **Tests:** none

**Given** a session is created  
**Then** its `id` is a CUID  
**And** its `title` is a non-empty string of at most 200 characters  
**And** its `createdAt` is set automatically at creation time  
**And** its `updatedAt` is updated automatically on every save  
**And** it is associated with exactly one `User` record via `userId`

#### SC-5.2 User email is unique and owns zero or more sessions
> **Tests:** none

**Given** a user record exists  
**Then** its `email` is unique across all users  
**And** a user may own zero or more sessions
