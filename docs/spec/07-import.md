## 7.1 Gherkin text import

#### SC-7.1.1 Import button always visible in toolbar
> **Tests:** [`e2e/import.spec.ts`](../../e2e/import.spec.ts)

**Given** a user is in a session editor
**When** the editor renders
**Then** an "Import" button with class `gherkin-import-btn` is always visible in the toolbar

#### SC-7.1.2 Clicking Import opens modal with textarea and buttons
> **Tests:** [`e2e/import.spec.ts`](../../e2e/import.spec.ts)

**Given** the user clicks the Import button
**Then** a modal overlay with class `gherkin-import-modal` opens
**And** the modal contains a textarea with class `gherkin-import-textarea`
**And** the modal contains a confirm button `.gherkin-import-confirm` ("Insert")
**And** the modal contains a cancel button `.gherkin-import-cancel` ("Cancel")

#### SC-7.1.3 Inserting Gherkin creates blocks, skips non-matching, clears modal
> **Tests:** [`e2e/import.spec.ts`](../../e2e/import.spec.ts) — valid sequence · out-of-order inserted leniently · textarea cleared · markdown-prefixed Gherkin parsed · pipe rows become DataTable · plain text skipped · case-insensitive with colon · case-insensitive without colon

**Given** the user pastes or types Gherkin text into the textarea and clicks Insert
**Then** each recognisable keyword line is inserted as a Gherkin block at the current cursor position
**And** pipe-delimited rows (| cell | cell |) are grouped into DataTable blocks
**And** lines that do not match any keyword or table pattern are skipped
**And** blocks are inserted in the order they appear in the text, regardless of canFollow() validity
**And** the modal closes and the textarea is cleared

#### SC-7.1.4 Cancel closes modal without inserting
> **Tests:** [`e2e/import.spec.ts`](../../e2e/import.spec.ts)

**Given** the user clicks Cancel
**Then** the modal closes without inserting anything

Keyword matching is case-insensitive. Colons after keywords are optional
(e.g. "Given: text" and "Given text" are both accepted).
