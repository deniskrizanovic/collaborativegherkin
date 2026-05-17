# Collaborative Gherkin — Behaviour-Driven Specification

Collaborative Gherkin is a real-time multi-user editor for writing Gherkin acceptance criteria. Multiple people share a single session URL and edit the same document simultaneously, seeing each other's changes live. Sessions are ephemeral workspaces; users export the finished Gherkin to external tools such as Jira.

## Sections

| # | File | Contents |
|---|------|----------|
| 1 | [spec/01-session-management.md](spec/01-session-management.md) | Listing, creating, joining, sharing, and deleting sessions |
| 2 | [spec/02-gherkin-document-model.md](spec/02-gherkin-document-model.md) | Block types and document structure rules (`canFollow()`) |
| 3 | [spec/03-editor.md](spec/03-editor.md) | Loading, Enter progression, slash-command picker, toolbar, real-time collaboration, export |
| 4 | [spec/04-api.md](spec/04-api.md) | REST API behaviour for all four endpoints |
| 5 | [spec/05-data-model.md](spec/05-data-model.md) | Database constraints for `Session` and `User` |
| 6 | [spec/06-out-of-scope.md](spec/06-out-of-scope.md) | Features intentionally not yet implemented |
