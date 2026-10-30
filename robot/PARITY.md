# Playwright → Robot parity checklist

One row per `test(...)` / `test.skip(...)` in `e2e/*.spec.ts`. The Robot port
must have exactly one test case per row, with assertions at least as strong as
the ones listed here (see `openspec/changes/archive/2026-10-29-add-robot-framework-e2e-suite`).

Columns:

- **Playwright file**: source spec in `e2e/`.
- **Title**: the Playwright title, verbatim. The Robot test case uses the same name.
- **Key assertions**: every `expect` and robustness technique the port must keep
  (exact counts, texts, statuses, held routes, response waits, download filename
  and lines, computed styles, explicit timeouts, extra contexts, cleanup).
- **Robot suite**: target file in `robot/suites/`.
- **Chunk**: delivery chunk (design D14). Tests carry the tag `chunk<N>`.
- **Status**: `pending` until ported. A row flips to `ported` in the same chunk
  that ports the test, never later. `SC-3.5.2` ends as `skip` (ported as a
  Robot test tagged `skip`, with the same reason).

All tests start from `openSession` (create via API, open, wait for and click
the Feature block) unless noted otherwise.

## Totals

| Chunk | Tests | Files |
|---|---|---|
| 1 | 27 | initial-content (3), toolbar (5), import (11), home (8) |
| 2 | 25 | enter-progression (9), block-picker (9), visual-separation (7) |
| 3 | 19 | export (4), image (3), enter-progression SC-3.2.2 (1), data-table (10), visual-separation export (1) |
| 4 | 26 | llm-review (25), home SC-1.2.4 (1) |
| 5 | 9 | collaboration (3, one skip), session-access-control (6: 3 API + 3 UX) |
| 6 | 3 | websocket-auth (3) |
| **All** | **109** | 14 spec files |

## initial-content.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| initial-content.spec.ts | SC-3.1.2: New document seeded with 5 scaffold blocks once — order | evaluateAll `.gherkin-editor [data-gherkin-type]` types == exactly `[feature, scenario, given, when, then]` | initial_content.robot | 1 | ported |
| initial-content.spec.ts | SC-3.1.2: New document seeded with 5 scaffold blocks once — empty text | evaluateAll textContent of all blocks; every text == `""` | initial_content.robot | 1 | ported |
| initial-content.spec.ts | SC-3.1.2: New document seeded with 5 scaffold blocks once — cursor on Feature | `.gherkin-toolbar-btn` allTextContents contains `Scenario`, not contains `Feature` | initial_content.robot | 1 | ported |

## toolbar.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| toolbar.spec.ts | SC-3.4.1: Toolbar shows valid next blocks and Image — no Feature shown on Feature block | toolbar btn texts contain `Scenario`, not `Feature` | toolbar.robot | 1 | ported |
| toolbar.spec.ts | SC-3.4.1: Toolbar shows valid next blocks and Image — Rule, Background, Scenario after Feature | toolbar btn texts contain `Rule`, `Background`, `Scenario`; not `Feature` | toolbar.robot | 1 | ported |
| toolbar.spec.ts | SC-3.4.2: Clicking toolbar button inserts block and moves cursor | click toolbar `Rule`; `[data-gherkin-type="rule"]` visible | toolbar.robot | 1 | ported |
| toolbar.spec.ts | SC-3.4.2: Clicking toolbar button inserts block and moves cursor — Scenario after Feature | count scenario before; click toolbar `Scenario`; scenario count == before + 1 (auto-retry) | toolbar.robot | 1 | ported |
| toolbar.spec.ts | SC-3.4.1: Toolbar shows valid next blocks and Image — Image present on non-Feature block | click `then` block; toolbar btn texts contain `Image` | toolbar.robot | 1 | ported |

## import.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| import.spec.ts | SC-7.1.1: Import button always visible in toolbar | `.gherkin-import-btn` visible | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.2: Clicking Import opens modal with textarea and buttons | click import; `.gherkin-import-modal`, `.gherkin-import-textarea`, `.gherkin-import-confirm`, `.gherkin-import-cancel` all visible | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.4: Cancel closes modal without inserting | fill `Feature: Should not appear`; cancel; modal not visible; feature count == 1 | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — valid sequence | fill 5-line Feature/Scenario/Given/When/Then; confirm; modal not visible; feature, scenario, given, when, then counts each == 2 | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — out-of-order inserted leniently | fill `Scenario: Orphan\nGiven context`; confirm; scenario == 2; given == 2 | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — textarea cleared | fill `Feature: Test`; confirm; reopen import; textarea value == `""` | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — markdown-prefixed Gherkin parsed | fill `# Feature:`/`## Scenario:`/`- Given:`/`- When:`/`- Then:` lines; confirm; modal not visible; 5 type counts each == 2 | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — pipe rows become DataTable | fill Scenario, Given, 4 pipe rows (incl. `\| --- \| --- \|`); confirm; modal not visible; scenario == 2; given == 2; `[data-gherkin-table]` == 1 | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — plain text skipped | count blocks before; fill plain text; confirm; modal not visible; block count == before | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive with colon | count given before; fill `GIVEN: something uppercase`; confirm; given == before + 1 | import.robot | 1 | ported |
| import.spec.ts | SC-7.1.3: Inserting Gherkin creates blocks, skips non-matching, clears modal — case-insensitive without colon | count given before; fill `Given something without a colon`; confirm; given == before + 1 | import.robot | 1 | ported |

## home.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| home.spec.ts | SC-1.1.2: No sessions shows empty state | API GET `/api/sessions`, DELETE each; goto `/`; `.sessions-list` not visible; `.create-form` visible | home.robot | 1 | ported |
| home.spec.ts | SC-1.1.1: Sessions listed newest first — list visible after creating | create via API; goto `/`; first `.session-link` visible; href == `/sessions/<id>` | home.robot | 1 | ported |
| home.spec.ts | SC-1.1.1: Sessions listed newest first — order | create `Session Alpha` then `Session Beta`; goto `/`; first `.session-name` text == `Session Beta` | home.robot | 1 | ported |
| home.spec.ts | SC-1.2.2: Empty title disables Create button | goto `/`; `button[type="submit"]` disabled | home.robot | 1 | ported |
| home.spec.ts | SC-1.2.3: Title over 200 chars shows validation error | native value setter on `.nsw-form__input` with 201 × `a` + dispatch `input` and `change` (bubbles); click submit; `.form-error` visible; URL == `/` | home.robot | 1 | ported |
| home.spec.ts | SC-1.2.4: Server error shows error message | route `**/api/sessions`: POST → fulfill 500 JSON `{error:"Server error"}`, other methods → continue; goto `/`; fill `My session`; submit; `.form-error` visible | home.robot | 4 | ported |
| home.spec.ts | SC-1.2.1: Valid title creates session and redirects | goto `/`; fill `Redirect test session`; submit; URL matches `/\/sessions\//` | home.robot | 1 | ported |
| home.spec.ts | SC-1.3.1: Valid session ID loads editor with title | create `Header title session` via API; goto session; `.session-title` text == title | home.robot | 1 | ported |
| home.spec.ts | SC-1.4.1: Copy invite link copies URL and shows Copied! | grant `clipboard-read`, `clipboard-write`; openSession; `.copy-link-btn` visible, text == `Copy invite link`; click; text == `Copied!` | home.robot | 1 | ported |

## enter-progression.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — feature → scenario | click feature; plain `End`, `Enter`; types[1] == `scenario` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — scenario → given | click feature; plain `Enter`; click last scenario; `End`, `Enter`; type after last scenario == `given` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — given → when | plain Enter chain feature→scenario→given (click last each time); `End`, `Enter` on last given; type after last given == `when` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — when → then | plain Enter chain to when (click last each time); `End`, `Enter` on last when; type after last when == `then` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — then → and | pressEnterAndWait scenario, given, when, then, and; some `then` immediately followed by `and` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — and → and | pressEnterAndWait scenario, given; toolbar `And`; click last and; `End`; record last `and` index; pressEnterAndWait and; type at index + 1 == `and` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — but → and | pressEnterAndWait scenario, given; toolbar `But`; click last but; `End`; record last `but` index; pressEnterAndWait and; type at index + 1 == `and` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — background → given | click feature; toolbar `Background`; click background; `End`, `Enter`; type after background == `given` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.1: Enter at end of block inserts auto-progression type — rule → scenario | click feature; toolbar `Rule`; click rule; `End`, `Enter`; type after rule == `scenario` | enter_progression.robot | 2 | ported |
| enter-progression.spec.ts | SC-3.2.2: Enter on image block uses prevType context | pressEnterAndWait scenario, given, when, then; write 1×1 PNG to temp; click last then; toolbar `Image`; setInputFiles; wait `.gherkin-image-block`; click it; count blocks; `Enter`; wait for function count > before; last type == `and`; delete temp file | enter_progression.robot | 3 | ported |

## block-picker.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| block-picker.spec.ts | SC-3.3.1: Typing / opens picker with valid next blocks and Image | click feature; type `/`; first `text=Scenario` visible | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.1: Typing / opens picker with valid next blocks and Image — only valid types shown | click feature; `End`, `Enter`; type `/`; picker `[style*="position: fixed"]` visible; picker `text=Rule`, `text=Background`, `text=Scenario` visible; picker button texts not contain `Feature` | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.2: Down arrow moves picker focus to next item | feature `End`, `Enter`, `/`; picker visible; first button CSS `background` matches `rgba(0, 38, 100, 0.06)`; `ArrowDown`; nth(1) button background matches same | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.3: Up arrow moves picker focus to previous item | feature `End`, `Enter`, `/`; picker visible; count buttons; `ArrowUp`; last button background matches `rgba(0, 38, 100, 0.06)` | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.4: Enter on focused picker item inserts type and closes | click scenario; type `/`; picker visible; `Enter`; picker not visible; block count == 5; types[1] != `scenario` | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.5: Clicking picker item inserts type and closes | click scenario; `/`; picker visible; click first picker button; picker not visible; block count == 5; types[1] != `scenario` | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.6: Escape closes picker without inserting | count blocks before; click feature; `/`; picker visible; `Escape`; picker not visible; block count == before | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.7: Clicking outside picker closes without inserting | count blocks before; click feature; `/`; picker visible; mouse click (10, 10); picker not visible; block count == before | block_picker.robot | 2 | ported |
| block-picker.spec.ts | SC-3.3.1: Typing / opens picker with valid next blocks and Image — Image always last | context 1: feature `End`/`Enter`, click last scenario, `End`/`Enter`, `/`; picker visible; last button trimmed text == `Image`; `Escape`. Context 2: click last then, `End`/`Enter`, `/`; picker visible; last button trimmed text == `Image`; `Escape` | block_picker.robot | 2 | ported |

## visual-separation.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| visual-separation.spec.ts | SC-3.7.1: Given after then/and/but gets top border — after then | pressEnterAndWait scenario, given, when, then; toolbar `And`; click last and; toolbar `Given`; last given computed `borderTopWidth` == `1px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.1: Given after then/and/but gets top border — after and | same build; toolbar `And`; click last and; toolbar `Given`; last given `borderTopWidth` == `1px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.1: Given after then/and/but gets top border — after but | same build; toolbar `But`; click last but; toolbar `Given`; last given `borderTopWidth` == `1px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.2: Scenario after then/and/but gets top border — after then | same build; toolbar `Scenario`; wait for function scenario count >= 2; last scenario `borderTopWidth` == `1px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.2: Scenario after then/and/but gets top border — after and | same build; toolbar `And`; click last and; toolbar `Scenario`; last scenario `borderTopWidth` == `1px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.2: Scenario after then/and/but gets top border — after but | same build; toolbar `But`; click last but; toolbar `Scenario`; last scenario `borderTopWidth` == `1px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.1: Given after then/and/but gets top border — first given after scenario has no border | pressEnterAndWait scenario, given; first given `borderTopWidth` == `0px` | visual_separation.robot | 2 | ported |
| visual-separation.spec.ts | SC-3.7.1: Given after then/and/but gets top border — separator not in export | type `F`/`S`/`G1`/`W`/`T` via pressEnterAndWait chain; toolbar `And`, click last and, toolbar `Given`, click last given, type `G2`; download via `.gherkin-export-btn`; save to temp, read, delete; content not contains `---` nor `<hr`; every non-empty line matches `^\w+: ` | visual_separation.robot | 3 | ported |

## export.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| export.spec.ts | SC-3.6.1: Export downloads plain-text file in document order — correct content | click + type into each of 5 scaffold blocks; download via `.gherkin-export-btn`; suggestedFilename == `gherkin.txt`; save to temp, read, delete; lines[0..4] == `Feature: User login`, `Scenario: Successful login`, `Given: the user is on the login page`, `When: the user enters valid credentials`, `Then: the user is redirected to the dashboard` | export.robot | 3 | ported |
| export.spec.ts | SC-3.6.1: Export downloads plain-text file in document order — block order | type into feature, scenario, given; download TXT; save, read, delete; lines[0] `^Feature:`, lines[1] `^Scenario:`, lines[2] `^Given:` | export.robot | 3 | ported |
| export.spec.ts | SC-3.6.1: Export downloads plain-text file in document order — image data-URI included | write 1×1 PNG temp; click last then; toolbar `Image`; setInputFiles; wait `.gherkin-image-block`; download TXT; save, read; delete both temp files; content contains `data:image` | export.robot | 3 | ported |
| export.spec.ts | SC-3.9.1: Export MD downloads markdown file in document order | type into feature, scenario, given; download via `.gherkin-export-md-btn`; suggestedFilename == `gherkin.md`; save, read, delete; lines[0..2] == `# Feature: User login`, `## Scenario: Successful login`, `- Given: the user is on the login page` | export.robot | 3 | ported |

## image.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| image.spec.ts | SC-3.8.1: Image toolbar button opens file picker and embeds image | write 1×1 PNG temp; click last then; toolbar `Image`; setInputFiles; `.gherkin-image-block` visible; `.gherkin-image-block img` visible; boundingBox not null, width > 0, height > 0; delete temp | image.robot | 3 | ported |
| image.spec.ts | SC-3.8.2: Slash-command Image selection opens file picker and embeds image | write PNG temp; click last then; type `/`; picker visible; click last picker button; setInputFiles; `.gherkin-image-block` visible; delete temp | image.robot | 3 | ported |
| image.spec.ts | SC-3.8.3: Drag and drop image embeds at drop position | page.evaluate: build `File` from base64 PNG, `DataTransfer`, dispatch `DragEvent("drop", {bubbles, cancelable, dataTransfer})` on `.gherkin-editor-wrapper`; `.gherkin-image-block` visible; delete temp | image.robot | 3 | ported |

## data-table.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| data-table.spec.ts | SC-3.11.1: Table button shown when cursor is on step or data table — visible on Given | click first given; toolbar `Table` visible | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.1: Table button shown when cursor is on step or data table — absent on Feature | click feature; toolbar `Table` not visible | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell — node inserted | click first given; toolbar `Table`; `[data-gherkin-table]` visible | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.6: Add row and Add column controls available | given → `Table`; click first `[data-gherkin-table] td`; `.gherkin-table-toolbar` visible; `[data-action="insert-row-below"]` and `[data-action="insert-col-after"]` buttons visible | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.2: Clicking Table inserts 2×2 stub with cursor in first cell — first cell interactive | given → `Table`; click cell `0-0`; focused; fill `header`; text == `header` | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.4: Tab moves focus to next cell | given → `Table`; click cell `0-0`; `Tab`; cell `0-1` focused | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.5: Shift+Tab moves focus to previous cell | given → `Table`; click cell `0-1`; `Shift+Tab`; cell `0-0` focused | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.3: Slash-command picker includes Table when on step block | pressEnterAndWait scenario, given, when; type `/`; picker visible; picker button `Table` visible; `Escape` | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.7: TXT export uses pipe-delimited rows padded to column width | type feature `Login`, scenario `Table test`, given `a step with data`; toolbar `Table`; click+fill `0-0` `name`, `0-1` `age`; click `.gherkin-editor` (blur commit); download TXT; save, read, delete; content contains `\| name` and `\| age` | data_table.robot | 3 | ported |
| data-table.spec.ts | SC-3.11.8: MD export uses header row with separator | type feature, scenario, given; `Table`; click+fill `0-0` `col`; click `.gherkin-editor` (blur); download MD; save, read, delete; content contains `\| col`; matches `\| -+` | data_table.robot | 3 | ported |

## llm-review.spec.ts

`interceptReview` = route `/api/llm-review` fulfilled 200 JSON `{result: <body>}`, default body `MOCK_REVIEW` (`## Feedback` + 2 bullet items). "Held" = route handler awaits a test-controlled promise before fulfilling. "Held settings GET" = route `**/api/sessions/*` held for GET only (other methods fall back to the server), then fulfilled 200 JSON `{model: null, prompt: null}`.

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| llm-review.spec.ts | SC-8.3.1: Model dropdown shown pre-selected to persisted model — button and dropdown visible | `.session-review-btn` visible; `.session-model-select` visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.3.1: Model dropdown shown pre-selected to persisted model — expected models listed | wait first option attached; option texts contain `meta-llama/llama-3.2-3b-instruct:free`, `deepseek/deepseek-v4-flash:free`, `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free` | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.1: Edit prompt button opens modal with pre-filled textarea — button visible | `.session-edit-prompt-btn` visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.3.4: Model dropdown is disabled until session settings have loaded — controls disabled while settings load is pending | **held settings GET** registered before openSession; `.session-edit-prompt-btn` disabled; `.session-model-select` disabled; release; both enabled | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — modal opens | interceptReview; click review; `.session-review-modal` visible; body contains `Feedback` | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.1.2: Successful LLM response displayed as Markdown in modal — header shows model name | interceptReview; select enabled; read select value; click review; `.session-review-modal-header` contains selected model | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.1.2: Successful LLM response displayed as Markdown in modal — Markdown rendered | interceptReview; click review; body `h2` visible; body `li` count == 2 | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.1.1: Clicking Get AI Coaching sends content and disables controls — button disabled in flight | **held route**; click review; button disabled, text == `Reviewing…`; model select disabled; release; modal visible; button enabled | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.2.3: X button closes results modal | interceptReview; click review; modal visible; click `.session-review-modal-close`; modal not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.2.1: Escape closes results modal | interceptReview; click review; modal visible; `Escape`; modal not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.2.2: Clicking outside panel closes results modal | interceptReview; click review; modal visible; click `.session-review-modal` at position (5, 5); modal not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.8.3: View last review button absent before first review | `.session-view-last-review-btn` not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.8.1: View last review button visible after review is closed | interceptReview; review; modal visible; close; modal not visible; view-last btn visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.8.2: View last review reopens modal without new API call | interceptReview; review; body contains `Feedback`; close; modal not visible; click view-last; modal visible; body contains `Feedback` | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.8.4: Cached result remains available while new review in flight | interceptReview; review; modal visible; close; then **held route** (body `New result`); click review; view-last btn visible while held; release; modal visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.8.5: New review result replaces cached result | interceptReview `First result content`; review; body contains it; close; interceptReview `Second result content`; review; body contains `Second result content` | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.1.3: LLM failure shows error in modal and resets button | route fulfilled 500 JSON `{error:"LLM request failed"}`; review; modal visible; body contains `LLM request failed` | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.1: Edit prompt button opens modal with pre-filled textarea | click edit prompt; `.session-prompt-modal` visible; textarea value length > 10 | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Cancel | edit prompt; fill text; click `.session-prompt-cancel`; prompt modal not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — Escape | edit prompt; modal visible; `Escape`; modal not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.3: Cancel, Escape, or outside click closes prompt modal without saving — click outside | edit prompt; modal visible; click `.session-prompt-modal` at (5, 5); modal not visible | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.4: Save disabled when textarea has fewer than 10 chars | edit prompt; fill `short`; `.session-prompt-save` disabled | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.2: Saving new prompt persists it and closes modal | edit prompt; fill new prompt; save; modal not visible; reopen; textarea value == new prompt; cancel (cleanup) | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.6: A prompt edited after a slow settings load is the one saved | **held settings GET** registered before openSession; edit prompt disabled; release; edit prompt; fill new prompt; save; modal not visible; unroute all; reload; edit prompt; textarea value == new prompt | llm_review.robot | 4 | ported |
| llm-review.spec.ts | SC-8.4.7: Failed settings load leaves the default prompt editable | route `**/api/sessions/*` GET only fulfilled 500 JSON `{error}` before openSession; `.form-error` text == `Couldn't load this session's AI settings.`; edit prompt; modal visible; textarea value == `DEFAULT_PROMPT` (Robot: starts with its first sentence) | llm_review.robot | 4 | ported |

## collaboration.spec.ts

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| collaboration.spec.ts | SC-3.5.1: Change by one user is visible to all in real time | create via API (no openSession); page1 goto + wait feature; **second isolated context** (`user.json`) page2 goto + wait feature; page1 click feature, type `Shared feature`; page2 feature contains `Shared feature` (timeout 5 s); context2 closed in finally | collaboration.robot | 5 | ported |
| collaboration.spec.ts | SC-3.1.2: New document seeded with 5 scaffold blocks once — second joiner does not re-seed | create via API; page1 goto, wait, click feature, type `Do not wipe me`; **second context** (`user.json`) goto + wait; page2 feature contains text (5 s); page1 feature still contains text (5 s); context2 closed in finally | collaboration.robot | 5 | ported |
| collaboration.spec.ts | SC-3.5.2: Remote user cursors visible in distinct colour | **skip** (`@tiptap/extension-collaboration-cursor has no Tiptap 3 stable release yet`). Body: two contexts; page2 clicks feature; page1 `.collaboration-cursor__caret` visible (5 s) | collaboration.robot | 5 | skip |

## session-access-control.spec.ts

API block uses a separate `request` context with `user2.json` (non-owner); disposed in finally. UX block uses a second browser context with `user2.json`; closed in finally.

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| session-access-control.spec.ts | non-owner can GET a session they hold the id for (200) | owner creates session; user2 GET `/api/sessions/<id>` status == 200; body matches `{id: <id>}` | session_access_control_api.robot | 5 | ported |
| session-access-control.spec.ts | non-owner can PATCH a session's settings (200) | owner creates; user2 PATCH `{prompt: "A collaborator-supplied prompt that is long enough."}` status == 200 | session_access_control_api.robot | 5 | ported |
| session-access-control.spec.ts | non-owner cannot DELETE a session (403) — deletion stays owner-only | owner creates; user2 DELETE status == 403; owner GET status == 200 | session_access_control_api.robot | 5 | ported |
| session-access-control.spec.ts | a second user opens the shared link: no error banner, settings load | owner creates; user2 context; **waitForResponse** URL includes `/api/sessions/<id>` and method GET, paired with goto; status == 200; wait feature; `.form-error` count == 0; `.session-model-select` visible | session_access_control.robot | 5 | ported |
| session-access-control.spec.ts | a second user can change the model and it persists (PATCH 200, no banner) | owner creates; user2 context goto + wait; select enabled; read current value, option values; target != current exists (truthy); **waitForResponse** PATCH paired with selectOption; status == 200; `.form-error` count == 0; reload; wait feature; select value == target | session_access_control.robot | 5 | ported |
| session-access-control.spec.ts | a second user can save a new prompt (modal closes, no banner) | owner creates; user2 context goto + wait; edit prompt; modal visible; fill long prompt; **waitForResponse** PATCH paired with save click; status == 200; prompt modal not visible; `.form-error` count == 0 | session_access_control.robot | 5 | ported |

## websocket-auth.spec.ts

`connectResult` = raw `ws` client, exact `Cookie` header control, terminal on unexpected-response / first message / error / close, 3 s backstop.

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| websocket-auth.spec.ts | unauthenticated upgrade is refused with 401 — no room joined, no data sent | create session via API; raw WS to `ws://localhost:3000/session-<id>` with **no cookie**; opened == false; status == 401; receivedData == false | websocket_auth.robot | 6 | ported |
| websocket-auth.spec.ts | authenticated upgrade to a valid room succeeds | create session; Cookie header = context cookies joined `name=value; …`; raw WS to `session-<id>`; opened == true; receivedData == true | websocket_auth.robot | 6 | ported |
| websocket-auth.spec.ts | authenticated upgrade to a malformed room is refused | Cookie header from context; raw WS to `ws://localhost:3000/default`; opened == false; status == 401 | websocket_auth.robot | 6 | ported |

## Robot-only

Tests with no Playwright counterpart. Not counted in the totals above.

| Playwright file | Title | Key assertions | Robot suite | Chunk | Status |
|---|---|---|---|---|---|
| — | Smoke: new session shows the scaffold blocks in order | Open Session; block types == exactly `[feature, scenario, given, when, then]` | 00_smoke.robot | 0 | ported |

## Business-language pilot

`block_picker_bdd.robot` restates the 9 `block-picker.spec.ts` tests as the
GIVEN/WHEN/THEN lines of their spec scenarios (evaluation doc §6.7). It is
checked against behaviour, not line by line, and is not counted in the totals
above. Differences from the rows in `## block-picker.spec.ts`:

- **Opens picker**: waits for the picker itself, not the first `text=Scenario`
  (which the seeded Scenario block also matches).
- **Menu open** (SC-3.3.2, 3.3.3, 3.3.6, 3.3.7): always opened on a new line
  after Feature (insert mode). On the Feature block itself the picker lists only
  `Feature`, and in replace mode a wrong insertion would not change the count.
- **Closes without inserting**: block count *and* the full block-type list are
  unchanged.
- **Arrow keys**: the new item gains the focus background *and* the old item
  loses it.
- **Enter / click inserts**: the target block's new type equals the focused
  item's label, as well as being different from `scenario`.
