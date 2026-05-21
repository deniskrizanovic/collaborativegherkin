# 6. Out of Scope (Current Version)

The following behaviours are intentionally not implemented and should not be assumed:

- **Authentication** — all requests use a hardcoded placeholder `userId`; no real login flow exists yet
- **Persistent document content** — Y.js document state is held in memory only; restarting the WebSocket server loses all editor content
- **Session deletion from the UI** — the DELETE API exists but there is no delete button in the front end
- **Per-session access control** — anyone with the URL can read and edit any session
