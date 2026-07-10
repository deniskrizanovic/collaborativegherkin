# gherkin-editor Specification

## Purpose

The collaborative Gherkin editor's interactive behaviour: loading and seeding,
Enter-key auto-progression, the slash-command block picker, the toolbar,
visual separation and indentation, image insertion, and data table insertion.
(Real-time collaboration is specified in `realtime-collaboration`; export is
specified in `gherkin-export`.)

## Requirements

### Requirement: Loading

When a user opens a session the editor SHALL establish a WebSocket connection
to `ws://localhost:1234` in room `session-{sessionId}`, synchronise the Y.js
document, and become interactive. A newly empty document MUST be seeded exactly
once per document lifetime with five empty scaffold blocks — Feature, Scenario,
Given, When, Then — with the cursor at the start of the Feature block.
Subsequent users receive the document via Y.js sync and MUST NOT trigger
re-seeding.

#### Scenario: Editor establishes WebSocket and becomes interactive
> **Tests:** none (WebSocket connection itself not directly asserted)
- **GIVEN** a user opens a session
- **WHEN** the editor mounts
- **THEN** a WebSocket connection is established to `ws://localhost:1234` in the room `session-{sessionId}`
- **AND** the Y.js document state is synchronised with the server and any other connected peers
- **AND** the editor becomes interactive once the connection is established

#### Scenario: New document seeded with 5 scaffold blocks once
> **Tests:** [`e2e/initial-content.spec.ts`](../../../e2e/initial-content.spec.ts) — order · empty text · cursor on Feature; [`e2e/collaboration.spec.ts`](../../../e2e/collaboration.spec.ts) — second joiner does not re-seed
- **GIVEN** the Y.js document is empty after synchronisation
- **WHEN** the first user's editor finishes syncing
- **THEN** the editor is seeded with 5 empty scaffold blocks in this order: Feature, Scenario, Given, When, Then
- **AND** each scaffold block contains no text — only the keyword label is displayed
- **AND** the cursor is placed at the start of the Feature block
- **AND** the seed is applied exactly once per document lifetime — subsequent users joining the session receive the document content via Y.js sync and do not trigger re-seeding

### Requirement: Enter-key auto-progression

Pressing Enter at the end of a block SHALL insert a new block of a
predetermined type: feature→scenario, rule→scenario, background→given,
scenario→given, given→when, when→then, then→scenario, and→and, but→but. The
cursor MUST be placed at the start of the new block's text. When the cursor is
on an image block, Enter MUST use the auto-progression type of the most recent
Gherkin block preceding the image.

#### Scenario: Enter at end of block inserts auto-progression type
> **Tests:** [`e2e/enter-progression.spec.ts`](../../../e2e/enter-progression.spec.ts) — feature→scenario · scenario→given · given→when · when→then · then→and · and→and · but→and · background→given · rule→scenario
- **GIVEN** the cursor is at the end of a block
- **WHEN** the user presses Enter
- **THEN** a new block of the auto-progression type is inserted immediately after the current block
- **AND** the cursor is placed at the start of the new block's text

#### Scenario: Enter on image block uses prevType context
> **Tests:** [`e2e/enter-progression.spec.ts`](../../../e2e/enter-progression.spec.ts)
- **GIVEN** the cursor is on an image block
- **WHEN** the user presses Enter
- **THEN** a new block is inserted after the image using the auto-progression type of the most recent Gherkin block that precedes the image
- **AND** the cursor is placed at the start of the new block's text

### Requirement: Slash-command block picker

Typing `/` inside a block SHALL open a block picker listing the block types that
are valid next blocks per `canFollow()`, always including `Image` as the final
option. Arrow keys MUST move focus; Enter or a click MUST insert the focused
type and close the menu; Escape or an outside click MUST close the menu without
inserting.

#### Scenario: Typing / opens picker with valid next blocks and Image
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts) — opens picker · only valid types shown · Image always last
- **GIVEN** the cursor is inside a block
- **WHEN** the user types `/`
- **THEN** a block picker menu opens
- **AND** the menu lists the block types that are valid next blocks for the current block, according to `canFollow()`
- **AND** the menu always includes `Image` as the final option, regardless of the current block type

#### Scenario: Down arrow moves picker focus to next item
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts)
- **GIVEN** the block picker menu is open
- **WHEN** the user presses the down arrow key
- **THEN** focus moves to the next item in the list

#### Scenario: Up arrow moves picker focus to previous item
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts)
- **GIVEN** the block picker menu is open
- **WHEN** the user presses the up arrow key
- **THEN** focus moves to the previous item in the list

#### Scenario: Enter on focused picker item inserts type and closes
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts)
- **GIVEN** the block picker menu is open and an item is focused
- **WHEN** the user presses Enter
- **THEN** the focused block type is inserted and the menu closes

#### Scenario: Clicking picker item inserts type and closes
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts)
- **GIVEN** the block picker menu is open and an item is focused
- **WHEN** the user clicks the item
- **THEN** the clicked block type is inserted and the menu closes

#### Scenario: Escape closes picker without inserting
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts)
- **GIVEN** the block picker menu is open
- **WHEN** the user presses Escape
- **THEN** the menu closes without inserting a block

#### Scenario: Clicking outside picker closes without inserting
> **Tests:** [`e2e/block-picker.spec.ts`](../../../e2e/block-picker.spec.ts)
- **GIVEN** the block picker menu is open
- **WHEN** the user clicks outside the menu
- **THEN** the menu closes without inserting a block

### Requirement: Toolbar block insertion

The editor toolbar SHALL show the block types that are valid next blocks per
`canFollow()`, always including an Image button. Clicking a toolbar button MUST
insert a new block of the chosen type after the current block and move the
cursor to it.

#### Scenario: Toolbar shows valid next blocks and Image
> **Tests:** [`e2e/toolbar.spec.ts`](../../../e2e/toolbar.spec.ts) — no Feature shown on Feature block · Rule, Background, Scenario after Feature · Image present on non-Feature block
- **GIVEN** the cursor is inside a block
- **WHEN** the editor toolbar renders
- **THEN** the toolbar shows the block types that are valid next blocks for the current block, according to `canFollow()`
- **AND** the toolbar always shows an Image button, regardless of the current block type

#### Scenario: Clicking toolbar button inserts block and moves cursor
> **Tests:** [`e2e/toolbar.spec.ts`](../../../e2e/toolbar.spec.ts) — node inserted · Scenario after Feature
- **GIVEN** the toolbar is showing valid block types
- **WHEN** the user clicks a toolbar button
- **THEN** a new block of the chosen type is inserted after the current block
- **AND** the cursor moves to the new block

### Requirement: Visual separation between step groups

The editor SHALL render a horizontal rule and vertical space above a `given` or
`scenario` block that immediately follows a `then`, `and`, or `but` block. This
separation is purely visual and MUST NOT affect document structure or export
output.

#### Scenario: Given after then/and/but gets top border (visual only)
> **Tests:** [`e2e/visual-separation.spec.ts`](../../../e2e/visual-separation.spec.ts) — after then · after and · after but · first given after scenario has no border · separator not in export
- **GIVEN** a `given` block immediately follows a `then`, `and`, or `but` block
- **THEN** a horizontal rule and vertical space are rendered above the `given` block
- **AND** this separation is purely visual and does not affect the document structure or export output

#### Scenario: Scenario after then/and/but gets top border (visual only)
> **Tests:** [`e2e/visual-separation.spec.ts`](../../../e2e/visual-separation.spec.ts) — after then · after and · after but
- **GIVEN** a `scenario` block immediately follows a `then`, `and`, or `but` block
- **THEN** a horizontal rule and vertical space are rendered above the `scenario` block
- **AND** this separation is purely visual and does not affect the document structure or export output

### Requirement: Image insertion

A user SHALL be able to insert an image block via the Image toolbar button, the
slash-command Image option, or drag-and-drop. Toolbar and slash-command
insertion open a file picker and embed the selected image immediately after the
current block; drag-and-drop embeds at the drop position. An image block MUST be
displayed inline at full available width and MAY appear after any keyword block.

#### Scenario: Image toolbar button opens file picker and embeds image
> **Tests:** [`e2e/image.spec.ts`](../../../e2e/image.spec.ts)
- **GIVEN** a user is in a session editor
- **WHEN** the user clicks the Image toolbar button
- **THEN** a file picker opens
- **AND** selecting an image file embeds it as an image block immediately after the current block

#### Scenario: Slash-command Image selection opens file picker and embeds image
> **Tests:** [`e2e/image.spec.ts`](../../../e2e/image.spec.ts)
- **GIVEN** a user is in a session editor
- **WHEN** the user types `/` and selects Image from the block picker
- **THEN** a file picker opens
- **AND** selecting an image file embeds it as an image block immediately after the current block

#### Scenario: Drag and drop image embeds at drop position
> **Tests:** [`e2e/image.spec.ts`](../../../e2e/image.spec.ts)
- **GIVEN** a user is in a session editor
- **WHEN** the user drags an image file onto the editor
- **THEN** the image is embedded as an image block at the drop position

#### Scenario: Image block displayed inline at full width
> **Tests:** none
- **GIVEN** an image block is in the document
- **THEN** the image is displayed inline at full available width
- **AND** the image block may appear after any keyword block type

### Requirement: Block indentation

The editor SHALL render `feature` flush with the left margin, `rule`,
`background`, and `scenario` indented one level, and step blocks (`given`,
`when`, `then`, `and`, `but`) indented two levels. This indentation is purely
visual and MUST NOT affect document structure or export output.

#### Scenario: Feature block flush with left margin
> **Tests:** none
- **GIVEN** the editor contains a `feature` block
- **THEN** it is rendered flush with the editor left margin

#### Scenario: Rule, background, scenario indented one level
> **Tests:** none
- **GIVEN** the editor contains a `rule`, `background`, or `scenario` block
- **THEN** it is visually indented one level from the `feature` block

#### Scenario: Step blocks indented two levels
> **Tests:** none
- **GIVEN** the editor contains a `given`, `when`, `then`, `and`, or `but` block
- **THEN** it is visually indented two levels from the `feature` block
- **AND** this indentation is purely visual and does not affect the document structure or export output

### Requirement: Data table insertion

A "Table" button SHALL be shown when the cursor is on a step block or on a data
table following a step. Clicking it MUST insert a 2×2 empty stub after the
current block with the cursor in the first cell. The slash-command picker MUST
include "Table" when on a step block. Tab and Shift+Tab MUST move focus between
cells, and "Add row"/"Add column" controls MUST be available. (Data table
export formatting is specified in `gherkin-export`.)

#### Scenario: Table button shown when cursor is on step or data table
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts) — visible on Given · absent on Feature
- **GIVEN** the cursor is on a step block (`given`, `when`, `then`, `and`, or `but`) or on a data table block that follows a step
- **THEN** the toolbar shows a "Table" button

#### Scenario: Clicking Table inserts 2×2 stub with cursor in first cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts) — node inserted · first cell interactive
- **GIVEN** the toolbar shows a "Table" button
- **WHEN** the user clicks it
- **THEN** a 2×2 data table stub with empty cells is inserted immediately after the current block
- **AND** the cursor is placed inside the first cell

#### Scenario: Slash-command picker includes Table when on step block
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts)
- **GIVEN** the user types `/` and the current/previous block is a step type
- **THEN** the block picker includes "Table" as an option

#### Scenario: Tab moves focus to next cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts)
- **GIVEN** a data table is in the document
- **WHEN** the user presses Tab inside a cell
- **THEN** focus moves to the next cell (left to right, top to bottom)

#### Scenario: Shift+Tab moves focus to previous cell
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts)
- **GIVEN** a data table is in the document
- **WHEN** the user presses Shift+Tab inside a cell
- **THEN** focus moves to the previous cell

#### Scenario: Add row and Add column controls available
> **Tests:** [`e2e/data-table.spec.ts`](../../../e2e/data-table.spec.ts)
- **GIVEN** a data table is in the document
- **THEN** "Add row" and "Add column" controls are available within the table UI
