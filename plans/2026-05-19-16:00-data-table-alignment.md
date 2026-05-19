# Plan: Align data table with previous step node

## Context
The `gherkin_data_table` NodeView renders as `div.gherkin-table-block` but has no CSS indentation rule. Step nodes (Given, When, And, But, Then) all have `padding-left: 3rem` applied via globals.css. As a result the table starts flush at the editor's left padding, visually misaligned with the step above it.

## Change

**File:** `src/app/globals.css`

Add a single CSS rule after the step indentation block (around line 263):

```css
.gherkin-editor .gherkin-table-block {
  padding-left: 3rem;
}
```

This indent matches exactly what step nodes use (`padding-left: 3rem`), so the table's left edge will sit at the same column as the keyword label of the step above it — which matches expected Gherkin indentation.

The `controls` div (Add row / Add column buttons) lives inside `.gherkin-table-block`, so it will also shift right, keeping everything visually grouped under the table.

## E2E impact

`e2e/data-table.spec.ts` uses these selectors:
- `[data-gherkin-table]` — attribute selector, unaffected by padding
- `.gherkin-table-add-row` / `.gherkin-table-add-col` — class selectors, unaffected
- `[data-gherkin-table] td[data-cell='0-0']` — child selector, unaffected

No test assertions check position or layout, so no test changes are needed.

## Verification
1. `npm run dev` + `npm run dev:ws`
2. Create a session, insert Feature → Scenario → Given/And step → click Table
3. Visually confirm the table left-aligns with the keyword column of the step above it
4. `npm run test` — all existing tests should still pass
