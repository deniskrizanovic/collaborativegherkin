# Plan: Markdown Export

## Context
The app currently exports Gherkin as a plain `.txt` file. Users want a second export format: a `.md` file where images render inline (using `![alt](src)` syntax) and Gherkin keywords use markdown structure (Feature/Rule/Background/Scenario as headers, step keywords as list items).

## Approach

### 1. Add `exportToMarkdown` in `src/lib/gherkin.ts` (line 82, after `exportToText`)

New pure function with this mapping:
- `feature` → `# Feature: text`
- `rule` → `## Rule: text`
- `background` → `## Background: text`
- `scenario` → `## Scenario: text`
- `given`, `when`, `then`, `and`, `but` → `- Keyword: text`
- `image` → `![alt](src)`

```ts
export function exportToMarkdown(blocks: DocumentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "image") return `![${b.alt}](${b.src})`;
      if (b.type === "feature") return `# Feature: ${b.text}`;
      if (b.type === "rule") return `## Rule: ${b.text}`;
      if (b.type === "background") return `## Background: ${b.text}`;
      if (b.type === "scenario") return `## Scenario: ${b.text}`;
      return `- ${GHERKIN_LABELS[b.type]}: ${b.text}`;
    })
    .join("\n");
}
```

### 2. Add `handleExportMarkdown` in `src/components/GherkinEditor.tsx` (after `handleExport` at line 433)

Same pattern as `handleExport`, calling `exportToMarkdown`, blob type `"text/markdown"`, filename `"gherkin.md"`. Also add `exportToMarkdown` to the import from `../lib/gherkin`.

### 3. Add "Export MD" button in the toolbar (after the existing Export button at line 485–487)

```tsx
<button className="gherkin-export-md-btn" onClick={handleExportMarkdown}>
  Export MD
</button>
```

Use a distinct class (`gherkin-export-md-btn`) to avoid collisions with existing e2e selectors on `.gherkin-export-btn`.

### 4. Update `spec/03-editor.md` — add §3.9 Markdown Exporting

Add a new section after §3.8 (around line 156):

```markdown
## 3.9 Markdown exporting

**Given** a user is in a session editor
**When** the user clicks the Export MD button
**Then** a markdown file `gherkin.md` is downloaded
**And** `feature`, `rule`, `background`, and `scenario` blocks appear as markdown headers
**And** `given`, `when`, `then`, `and`, and `but` blocks appear as markdown list items
**And** image blocks appear as inline images using `![alt](src)` syntax
**And** all blocks appear in document order
```

### 5. Add unit tests in `src/lib/gherkin.test.ts` (after the `exportToText` block, around line 200)

Tests for `exportToMarkdown`:
- Single feature → `# Feature: ...`
- Step keywords → `- Given: ...` list items
- Image block → `![alt](src)`
- Full document order (feature → scenario → steps → image)
- Empty list → empty string

### 6. Add e2e test in `e2e/export.spec.ts` (append after line 83)

New `test.describe("markdown export", ...)` block:
- Click "Export MD" button via `.gherkin-export-md-btn`
- Assert `download.suggestedFilename()` is `"gherkin.md"`
- Assert `# Feature:` header, `## Scenario:` header, `- Given:` list item in content

## Files to modify

| File | Change |
|------|--------|
| `src/lib/gherkin.ts` | Add `exportToMarkdown` function |
| `src/components/GherkinEditor.tsx` | Add `handleExportMarkdown` callback, "Export MD" button, update import |
| `spec/03-editor.md` | Add §3.9 |
| `src/lib/gherkin.test.ts` | Add `exportToMarkdown` unit tests |
| `e2e/export.spec.ts` | Add markdown export e2e tests |

## Verification

1. `npm run test` — all unit tests pass including new `exportToMarkdown` tests
2. `npm run dev` + `npm run dev:ws` — open a session, add Feature/Scenario/Given/image, click "Export MD", confirm `.md` downloads and renders correctly in a markdown viewer
3. `npm run test:e2e` (if available) — new e2e test passes, existing `.gherkin-export-btn` tests unaffected
