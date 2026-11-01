## MODIFIED Requirements

### Requirement: Enter-key auto-progression

Pressing Enter at the end of a block SHALL insert a new block of a
predetermined type: feature→scenario, rule→scenario, background→given,
scenario→given, given→when, when→then, then→scenario, and→and, but→but. The
cursor MUST be placed at the start of the new block's text. When an image
block is selected, Enter MUST insert the new block immediately after the
image, using the auto-progression type of the most recent Gherkin block
preceding the image.

#### Scenario: Enter at end of block inserts auto-progression type
> **Tests:** [`e2e/enter-progression.spec.ts`](../../../../../e2e/enter-progression.spec.ts) · [`robot/suites/enter_progression.robot`](../../../../../robot/suites/enter_progression.robot) · [`robot/suites/enter_progression_bdd.robot`](../../../../../robot/suites/enter_progression_bdd.robot) — feature→scenario · scenario→given · given→when · when→then · then→and · and→and · but→and · background→given · rule→scenario
- **GIVEN** the cursor is at the end of a block
- **WHEN** the user presses Enter
- **THEN** a new block of the auto-progression type is inserted immediately after the current block
- **AND** the cursor is placed at the start of the new block's text

#### Scenario: Enter on image block uses prevType context
> **Tests:** [`e2e/enter-progression.spec.ts`](../../../../../e2e/enter-progression.spec.ts) · [`robot/suites/enter_progression.robot`](../../../../../robot/suites/enter_progression.robot) · [`robot/suites/enter_progression_bdd.robot`](../../../../../robot/suites/enter_progression_bdd.robot) — block directly after the image is the auto-progression type of the Gherkin block before it
- **GIVEN** an image block follows a Then block and the image is selected
- **WHEN** the user presses Enter
- **THEN** a new block is inserted immediately after the image using the auto-progression type of the most recent Gherkin block that precedes the image
- **AND** the cursor is placed at the start of the new block's text

## ADDED Requirements

### Requirement: Image block selection

A user SHALL be able to select an image block by clicking it, or by moving
onto it with the arrow keys from the block next to it. A selected image MUST
be visibly highlighted. While an image is selected, typing text MUST NOT
replace or delete the image, Backspace or Delete MUST remove the image, and a
toolbar block insert MUST place the new block immediately after the image.
When a collaborator removes an image that a user has selected, that user's
editor MUST keep working.

#### Scenario: Clicking an image selects it
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot) — image highlighted after click
- **GIVEN** a document contains an image block that is not selected
- **WHEN** the user clicks the image
- **THEN** the image is shown as selected

#### Scenario: Arrow key moves the selection onto an image
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot) — ArrowRight from end of preceding block
- **GIVEN** the cursor is at the end of the block directly before an image block
- **WHEN** the user presses ArrowRight
- **THEN** the image is shown as selected

#### Scenario: Typing does not replace a selected image
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot) — letter and `/` keep the image
- **GIVEN** an image block is selected
- **WHEN** the user types a letter or `/`
- **THEN** the image stays in the document
- **AND** no text is inserted and the block picker does not open

#### Scenario: Backspace removes a selected image
> **Tests:** [`e2e/image.spec.ts`](../../../../../e2e/image.spec.ts) · [`robot/suites/image.robot`](../../../../../robot/suites/image.robot) · [`robot/suites/image_bdd.robot`](../../../../../robot/suites/image_bdd.robot) — image gone, surrounding blocks kept
- **GIVEN** an image block between two Gherkin blocks is selected
- **WHEN** the user presses Backspace
- **THEN** the image is removed from the document
- **AND** the Gherkin blocks on either side of it are unchanged

#### Scenario: Toolbar insert with an image selected places the block after the image
> **Tests:** [`e2e/toolbar.spec.ts`](../../../../../e2e/toolbar.spec.ts) · [`robot/suites/toolbar.robot`](../../../../../robot/suites/toolbar.robot) · [`robot/suites/toolbar_bdd.robot`](../../../../../robot/suites/toolbar_bdd.robot) — And inserted directly after the image
- **GIVEN** an image block follows a Then block and the image is selected
- **WHEN** the user clicks the And toolbar button
- **THEN** a new And block is inserted immediately after the image
- **AND** the cursor is placed at the start of the new block's text

#### Scenario: Collaborator removes an image another user has selected
> **Tests:** [`e2e/collaboration.spec.ts`](../../../../../e2e/collaboration.spec.ts) · [`robot/suites/collaboration.robot`](../../../../../robot/suites/collaboration.robot) · [`robot/suites/collaboration_bdd.robot`](../../../../../robot/suites/collaboration_bdd.robot) — first user's editor still accepts typing after the image is gone
- **GIVEN** two users are in the same session and the first user has an image block selected
- **WHEN** the second user removes that image
- **THEN** the image disappears from the first user's editor
- **AND** the first user can keep typing in the editor
