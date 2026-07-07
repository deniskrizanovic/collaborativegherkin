# gherkin-import Specification

## Purpose

Importing free-form Gherkin text into a session via a toolbar modal, parsing
recognisable keyword lines and pipe-delimited tables into blocks. Keyword
matching is case-insensitive and colons after keywords are optional.

## Requirements

### Requirement: Import modal and lenient parsing

An "Import" button with class `gherkin-import-btn` SHALL always be visible in
the editor toolbar. Clicking it MUST open a modal (`gherkin-import-modal`)
containing a textarea (`gherkin-import-textarea`), an Insert confirm button
(`gherkin-import-confirm`), and a Cancel button (`gherkin-import-cancel`).
Clicking Insert MUST insert each recognisable keyword line as a block at the
cursor, group pipe-delimited rows into DataTable blocks, skip non-matching
lines, insert blocks in text order regardless of `canFollow()` validity, then
close the modal and clear the textarea. Cancel MUST close the modal without
inserting. Keyword matching MUST be case-insensitive with optional colons.

#### Scenario: Import button always visible in toolbar
> **Tests:** [`e2e/import.spec.ts`](../../../e2e/import.spec.ts)
- **WHEN** a user is in a session editor and the editor renders
- **THEN** an "Import" button with class `gherkin-import-btn` is always visible in the toolbar

#### Scenario: Clicking Import opens modal with textarea and buttons
> **Tests:** [`e2e/import.spec.ts`](../../../e2e/import.spec.ts)
- **WHEN** the user clicks the Import button
- **THEN** a modal overlay with class `gherkin-import-modal` opens
- **AND** the modal contains a textarea with class `gherkin-import-textarea`
- **AND** the modal contains a confirm button `.gherkin-import-confirm` ("Insert")
- **AND** the modal contains a cancel button `.gherkin-import-cancel` ("Cancel")

#### Scenario: Inserting Gherkin creates blocks, skips non-matching, clears modal
> **Tests:** [`e2e/import.spec.ts`](../../../e2e/import.spec.ts) — valid sequence · out-of-order inserted leniently · textarea cleared · markdown-prefixed Gherkin parsed · pipe rows become DataTable · plain text skipped · case-insensitive with colon · case-insensitive without colon
- **WHEN** the user pastes or types Gherkin text into the textarea and clicks Insert
- **THEN** each recognisable keyword line is inserted as a Gherkin block at the current cursor position
- **AND** pipe-delimited rows (`| cell | cell |`) are grouped into DataTable blocks
- **AND** lines that do not match any keyword or table pattern are skipped
- **AND** blocks are inserted in the order they appear in the text, regardless of `canFollow()` validity
- **AND** the modal closes and the textarea is cleared

#### Scenario: Cancel closes modal without inserting
> **Tests:** [`e2e/import.spec.ts`](../../../e2e/import.spec.ts)
- **WHEN** the user clicks Cancel
- **THEN** the modal closes without inserting anything
