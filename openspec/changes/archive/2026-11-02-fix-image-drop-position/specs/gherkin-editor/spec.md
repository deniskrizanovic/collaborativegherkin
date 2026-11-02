## MODIFIED Requirements

### Requirement: Image insertion

A user SHALL be able to insert an image block via the Image toolbar button, the
slash-command Image option, or drag-and-drop. Toolbar and slash-command
insertion open a file picker and embed the selected image immediately after the
current block. Drag-and-drop MUST embed the image immediately after the
top-level block under the drop point, regardless of where the cursor is. A drop
that is not over a block MUST embed the image after the nearest block above
the drop point: in the gap between two blocks, after the upper one; after the
first block when the drop is above it; and at the end of the document when the
drop is below the last block. An image block MUST
be displayed inline at full available width and MAY appear after any keyword
block.

#### Scenario: Image toolbar button opens file picker and embeds image
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot)
- **GIVEN** a user is in a session editor
- **WHEN** the user clicks the Image toolbar button
- **THEN** a file picker opens
- **AND** selecting an image file embeds it as an image block immediately after the current block

#### Scenario: Slash-command Image selection opens file picker and embeds image
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot)
- **GIVEN** a user is in a session editor
- **WHEN** the user types `/` and selects Image from the block picker
- **THEN** a file picker opens
- **AND** selecting an image file embeds it as an image block immediately after the current block

#### Scenario: Drag and drop image embeds at drop position
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot) — drop onto the Then block with the cursor in Feature · drop with a cancelled file picker pending
- **GIVEN** a user is in a session editor with the cursor in the Feature block
- **WHEN** the user drops an image file onto the Then block
- **THEN** the image is embedded as an image block immediately after the Then block
- **AND** the Feature block is still followed by the block that followed it before the drop

#### Scenario: Image block displayed inline at full width
> **Tests:** none
- **GIVEN** an image block is in the document
- **THEN** the image is displayed inline at full available width
- **AND** the image block may appear after any keyword block type

#### Scenario: Image dropped outside every block embeds after the nearest block
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot) — below the last block · on the toolbar above the first block
- **GIVEN** a user is in a session editor with the cursor in the Feature block
- **WHEN** the user drops an image file below the last block
- **THEN** the image is embedded as an image block at the end of the document
