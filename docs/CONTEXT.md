# Collaborative Gherkin

A real-time collaborative editor for writing Gherkin acceptance criteria. Multiple participants edit a shared session simultaneously and export the result to tools like Jira.

## Language

**Session**:
A shared editing workspace identified by a unique URL. Sessions are transient — export is the record of truth.
_Avoid_: document, file, room

**Block**:
A single Gherkin node within a session — one of Feature, Rule, Scenario, Background, Given, When, Then, And, But, Example. Blocks have a type and text content.
_Avoid_: line, row, element, node

**Coaching**:
The capability that reviews a session's Gherkin content using an LLM and returns structured feedback. Owns the review call, the system prompt, and the model selection. Backed by OpenRouter; the backing provider is an implementation detail.
_Avoid_: LLM review, AI review, LLM service

**Export**:
The act of serialising a session's blocks to plain-text Gherkin or Markdown for use outside the app (e.g. pasting into Jira).
_Avoid_: download, save, copy
