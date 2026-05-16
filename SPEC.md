# Collaborative Gherkin — specification

## What it does
A web app where multiple people edit the same Gherkin acceptance criteria
document at the same time. Changes from all participants appear live, without
anyone needing to refresh. When the session is done, the Gherkin can be
exported as text for pasting into Jira or another tool.

## Who uses it
Teams writing software acceptance criteria together, primarily non-Salesforce
users. All participants share one central hosted instance of the app.

## What "done" looks like
- A user can create a new session and share a link.
- Other users can join that session via the link.
- All participants see each other's edits in real time.
- The editor only allows valid Gherkin block types and sequences.
- A session can be exported as plain-text Gherkin.

## The Gherkin block types
Feature, Rule, Background, Scenario, Given, When, Then, And, But.
Invalid sequences (e.g. a Then before a Given) are prevented by the editor.

## Keyboard behaviour
- Enter at the end of a step creates the next logical step automatically.
- Tab promotes or demotes a block type.
- Typing / opens a block picker to select any valid block type.

## Key behaviours and edge cases
- Two users editing the same word at the same time: Y.js merges the changes
  without losing either user's input (last-write-wins per character).
- A user disconnects mid-session: their in-progress changes are held locally
  and synced when they reconnect.
- Export: produces plain-text Gherkin only. No formatting, no attachments.
- Authentication: users must log in before creating or joining a session.
- Session data: considered transient. No automatic backups. Users are
  responsible for exporting before closing a session.
- Invalid Gherkin sequence: the editor prevents the block from being created,
  not just warns. The user must choose a valid next block type.
