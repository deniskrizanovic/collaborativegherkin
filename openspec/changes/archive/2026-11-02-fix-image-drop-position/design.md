## Context

The drop path today:

- `.gherkin-editor-wrapper` in `src/components/GherkinEditor.tsx` has an
  `onDrop` that takes `dataTransfer.files[0]`, checks `image/*`, calls
  `preventDefault()`, and calls `insertImageFromFile(file)`. The wrapper holds
  the toolbar as well as the ProseMirror editor, so drops on the toolbar reach
  it too.
- `insertImage` in `src/components/useGherkinKeyboard.ts` picks its target as
  `uploadTargetRef.current ?? trackPositionAfterSelection(editor)`, clears the
  ref, and hands the tracked position to the module-level
  `insertImageFromFile`, which reads the file with `FileReader` and calls
  `insertAtomNodeAt` when it loads.
- `uploadTargetRef` is set by the toolbar and picker Image actions just before
  they open the file picker. Nothing clears it when the picker is cancelled.
- `trackPosition` maps a position through every transaction, local or remote,
  until the file has loaded. `insertAtomNodeAt` moves a position that a remote
  change left inside a block to the end of that block.
- StarterKit's Dropcursor is on. For a file drag it draws a caret at the text
  position under the pointer, not at a block boundary.

The user chose the placement rule when this change was proposed: always after
the block under the pointer (not before/after by half), and an off-block drop
goes after the nearest block rather than falling back to the cursor or being
ignored.

## Goals / Non-Goals

**Goals:**

- A dropped image lands after the top-level block under the pointer.
- An off-block drop lands after the nearest block by vertical position.
- A drop ignores the cursor and any pending file-picker target.
- The placement rule is a pure function with unit tests.

**Non-Goals:**

- Inserting before a block, or between the halves of a block.
- Changing the Dropcursor so it draws at the block boundary. Its caret is
  slightly off from where the image lands; see Risks.
- Dropping several files at once. Only `files[0]` is used, as today.
- Changing the toolbar or slash-command Image paths, apart from no longer
  letting their stale target leak into a drop.
- Dragging an existing image block to move it (that is ProseMirror's own drag,
  with a slice, and is unaffected).

## Decisions

### D1. Pick the block from the drop's vertical coordinate, using block rects

Add a pure helper in `useGherkinKeyboard.ts`:

```ts
export function blockIndexAtY(tops: number[], y: number): number
```

It returns the index of the last block whose top is at or above `y`, or `0`
when `y` is above every block. That one rule gives all the required cases: a
drop on a block picks that block; a drop in the gap between two blocks picks
the upper one, so the image lands in that gap; a drop below the last block
picks the last block, so the image goes at the end; a drop on the toolbar,
above the first block, picks the first block.

`positionAfterBlockAtY(doc, rectOf, y)` builds `tops` from `rectOf(offset)`
for each top-level node (`doc.forEach`), and turns the index into the position
after that node (its offset plus `nodeSize`). The hook passes a `rectOf` that
reads `view.nodeDOM(offset).getBoundingClientRect()`.

Alternative considered: `view.posAtCoords({ left, top })` and `$pos.after(1)`.
It returns `null` outside the editor's DOM (the toolbar, a gutter outside the
contenteditable), so it would still need the rect fallback, which handles every
case on its own. One path is simpler to test. Only `clientY` matters, because
blocks are stacked vertically at full width.

### D2. A separate entry point for drops

The hook returns `insertDroppedImage(file, clientY)` next to the existing
`insertImageFromFile(file)`. It computes the position with D1, wraps it in
`trackPosition`, and calls the module-level `insertImageFromFile` with it. It
never reads `uploadTargetRef`, so a cancelled file picker no longer redirects
a drop, and it leaves the ref alone, so a picker that is still open keeps its
own target. The wrapper's `onDrop` calls it with `e.clientY`.

Alternative considered: an optional `clientY` on `insertImageFromFile`. A
second function keeps the file-picker path unchanged and makes the two targets
explicit.

The hook also returns `cancelImageUpload()`, which stops and clears
`uploadTargetRef`. `GherkinEditor` calls it from a native `cancel` listener on
the hidden file input (React has no `onCancel` for inputs), so a cancelled
picker stops tracking and a late `change` event falls back to the cursor
instead of the stale target. `insertImageFromFile` stops its tracker on
`FileReader` `error` and `abort` as well as `load`, so a failed read does not
leave a transaction listener behind.

### D3. Track the drop position like the file-picker target

The file is read asynchronously, so a local or remote change can shift the
document before the image is inserted. `trackPosition` already handles this,
and `insertAtomNodeAt` already moves a position left inside a block to that
block's end. The drop reuses both.

### D4. Tests drop at real coordinates and check document order

`e2e/image.spec.ts` gets a `dropImageAt(page, x, y)` helper that dispatches a
`drop` event with `clientX`/`clientY` and a `DataTransfer` holding a PNG, on
`.gherkin-editor-wrapper` (as today; ProseMirror sees the event bubble past it
either way). Coordinates come from the target block's `boundingBox()`. Each
test asserts with `documentNodes`. On the seeded scaffold (Feature, Scenario,
Given, When, Then) with the cursor in Feature:

| Test | Drop point | Expected `documentNodes` |
|---|---|---|
| SC-3.8.3 | centre of the Then block | feature, scenario, given, when, then, image |
| SC-3.8.3 — cancelled file picker | Image toolbar clicked, chooser not answered; centre of the Given block | feature, scenario, given, image, when, then |
| SC-3.8.5 — below the last block | 40px below the Then block | …, then, image |
| SC-3.8.5 — on the toolbar | centre of the toolbar | feature, image, scenario, … |

The SC-3.8.3 test drops on Then, not a middle block, because that is the
issue's repro. The cancelled-picker variant drops on Given so that the stale
target (after Feature) and the drop target differ. For "below the last block",
the editor has `min-height`; if 40px below Then falls outside the wrapper,
dispatch on the wrapper with that `clientY` anyway, since D1 only reads `y`.

Robot ports these with the same titles, using `Document Nodes In Editor`.

## Risks / Trade-offs

- [Dropcursor shows an inline caret where the image will not land] → Accepted
  for now (Non-Goals). The image lands after the block holding that caret, so
  the block is right. If users find it confusing, a later change can draw a
  block-boundary indicator.
- [Synthetic drop events skip the browser's real drag pipeline] → The human
  check in tasks.md drags a real file from the desktop.
- [ProseMirror's own drop handler runs first] → For a files-only
  `DataTransfer` it finds no slice and does nothing; today's drop already relies
  on this, and the human check confirms no duplicate insert.
- [`view.nodeDOM` returns `null` for a node that has not rendered yet, or a
  hidden node has a zero-size rect at top 0] → `positionAfterBlockAtY` takes
  the doc and a `rectOf(offset)` lookup (injected, so it is unit-tested
  without a DOM) and skips such blocks, so tops stay in order and a hidden
  block is never picked. With no rendered block it returns the end of the
  document.
- [BDD lint reads only `openspec/specs/**`] → `lint:robot-steps` checks
  Robot BDD steps against the main spec, so the delta must be synced to
  `openspec/specs/gherkin-editor/spec.md` before the BDD tests are linted
  (tasks section 5).

## Migration Plan

None. Front-end only; no data, schema, or sync change. Rollback is a revert.

## Open Questions

None. The placement rule was decided with the user.
