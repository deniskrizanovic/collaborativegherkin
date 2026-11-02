## MODIFIED Requirements

### Requirement: Data table insertion

A "Table" button SHALL be shown when the cursor is on a step block or on a data
table following a step. Clicking it, or choosing "Table" in the slash-command
block picker, MUST insert a 2×2 empty stub after the current block with the
cursor in the first cell, so that text typed next goes into that cell without
a click. Only the user who inserted the table gets this focus: a
collaborator's focus and cursor MUST NOT move when the table appears in their
editor. The slash-command picker MUST include "Table" when on a step block.
Tab and Shift+Tab MUST move focus between cells, and "Add row"/"Add column"
controls MUST be available. (Data table export formatting is specified in
`gherkin-export`.)

#### Scenario: Table button shown when cursor is on step or data table
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) — visible on Given · absent on Feature; [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot) — on Given
- **GIVEN** the cursor is on a step block (`given`, `when`, `then`, `and`, or `but`) or on a data table block that follows a step
- **THEN** the toolbar shows a "Table" button

#### Scenario: Clicking Table inserts 2×2 stub with cursor in first cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) · [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot) — node inserted · first cell focused and typed text lands there without a click
- **GIVEN** the toolbar shows a "Table" button
- **WHEN** the user clicks it
- **THEN** a 2×2 data table stub with empty cells is inserted immediately after the current block
- **AND** the cursor is placed inside the first cell
- **AND** text the user types next appears in the first cell

#### Scenario: Slash-command picker includes Table when on step block
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) · [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot)
- **GIVEN** the user types `/` and the current/previous block is a step type
- **THEN** the block picker includes "Table" as an option

#### Scenario: Choosing Table in the block picker puts the cursor in the first cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) · [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot) — slash removed · first cell focused and typed text lands there without a click
- **GIVEN** the block picker, opened by typing `/` on a step block, shows "Table" as an option
- **WHEN** the user chooses "Table"
- **THEN** a 2×2 data table stub with empty cells is inserted immediately after the step block
- **AND** the `/` typed to open the picker is removed from the step block
- **AND** the cursor is placed inside the first cell
- **AND** text the user types next appears in the first cell

#### Scenario: Inserting a table does not move a collaborator's cursor
> **Tests:** [`e2e/collaboration.spec.ts`](../../../../../e2e/collaboration.spec.ts) · [`robot/suites/collaboration.robot`](../../../../../robot/suites/collaboration.robot) · [`robot/suites/collaboration_bdd.robot`](../../../../../robot/suites/collaboration_bdd.robot)
- **GIVEN** two users are editing the same session and the second user's cursor is in a Gherkin block
- **WHEN** the first user inserts a data table
- **THEN** the second user sees the new table
- **AND** text the second user types next appears in the block where their cursor was, not in the table

#### Scenario: Tab moves focus to next cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) · [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot) — within a row · to the next row
- **GIVEN** a data table is in the document
- **WHEN** the user presses Tab inside a cell
- **THEN** focus moves to the next cell (left to right, top to bottom)

#### Scenario: Shift+Tab moves focus to previous cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) · [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot) — within a row · to the previous row
- **GIVEN** a data table is in the document
- **WHEN** the user presses Shift+Tab inside a cell
- **THEN** focus moves to the previous cell

#### Scenario: Add row and Add column controls available
> **Tests:** [`e2e/data-table.spec.ts`](../../../../../e2e/data-table.spec.ts) · [`robot/suites/data_table.robot`](../../../../../robot/suites/data_table.robot) · [`robot/suites/data_table_bdd.robot`](../../../../../robot/suites/data_table_bdd.robot)
- **GIVEN** a data table is in the document
- **THEN** "Add row" and "Add column" controls are available within the table UI
