# gherkin-export Specification

## Purpose

Exporting a session's document to downloadable files — plain text and
Markdown — including image blocks and data tables, in document order.

## Requirements

### Requirement: Plain-text export

Clicking Export SHALL download a plain-text file. Keyword blocks appear as one
line each in the format `Keyword: text`; image blocks appear as one line each
containing the full base64 data-URI; all lines appear in document order.

#### Scenario: Export downloads plain-text file in document order
> **Tests:** [`e2e/export.spec.ts`](../../../e2e/export.spec.ts) — correct content · block order · image data-URI included
- **GIVEN** a user is in a session editor
- **WHEN** the user clicks the Export button
- **THEN** a plain-text file is downloaded
- **AND** keyword blocks appear as one line each in the format `Keyword: text`
- **AND** image blocks appear as one line each containing the full base64 data-URI
- **AND** all lines appear in document order

### Requirement: Markdown export

Clicking Export MD SHALL download a Markdown file `gherkin.md`. `feature`,
`rule`, `background`, and `scenario` blocks appear as Markdown headers; `given`,
`when`, `then`, `and`, and `but` blocks appear as Markdown list items; image
blocks appear as inline images using `![alt](src)`; all blocks appear in
document order.

#### Scenario: Export MD downloads markdown file in document order
> **Tests:** [`e2e/export.spec.ts`](../../../e2e/export.spec.ts)
- **GIVEN** a user is in a session editor
- **WHEN** the user clicks the Export MD button
- **THEN** a markdown file `gherkin.md` is downloaded
- **AND** `feature`, `rule`, `background`, and `scenario` blocks appear as markdown headers
- **AND** `given`, `when`, `then`, `and`, and `but` blocks appear as markdown list items
- **AND** image blocks appear as inline images using `![alt](src)` syntax
- **AND** all blocks appear in document order

### Requirement: Data table export formatting

Data table blocks SHALL be rendered in exports. On TXT export each row appears
as one `| cell | cell |` line with cells padded to column width. On MD export
the first row is the header row, followed by a `| --- | --- |` separator row,
then the remaining rows in order.

#### Scenario: TXT export uses pipe-delimited rows padded to column width
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts)
- **GIVEN** a data table block is present
- **WHEN** the user exports as TXT
- **THEN** each row appears as one line in `| cell | cell |` format with cells padded to column width

#### Scenario: MD export uses header row with separator
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts)
- **GIVEN** a data table block is present
- **WHEN** the user exports as MD
- **THEN** the first row is the header row
- **AND** a `| --- | --- |` separator row follows the header
- **AND** subsequent rows follow in order
