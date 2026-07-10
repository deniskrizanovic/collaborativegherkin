# realtime-collaboration Specification

## Purpose

Live, multi-user editing of a shared session document via Tiptap's Y.js
integration — propagating each user's changes to all connected peers and
showing remote cursors.

## Requirements

### Requirement: Live change propagation and remote cursors

A change made by one user SHALL be reflected in every other connected user's
editor in real time when two or more users have the same session URL open.
Each remote user's cursor position MUST be visible, displayed in a distinct
colour.

#### Scenario: Change by one user is visible to all in real time
> **Tests:** [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts)
- **GIVEN** two or more users have the same session URL open
- **WHEN** one user types or inserts a block
- **THEN** all other connected users see the change reflected in their editors in real time

#### Scenario: Remote user cursors visible in distinct colour
> **Tests:** [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts)
- **GIVEN** two or more users are in the same session
- **WHEN** the editor renders
- **THEN** each remote user's cursor position is visible, displayed in a distinct colour
