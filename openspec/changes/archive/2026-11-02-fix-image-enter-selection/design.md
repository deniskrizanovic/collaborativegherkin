## Context

`gherkin_image` (`src/components/GherkinEditor.tsx`) is an `atom` block node
declared `selectable: false`. With that flag ProseMirror never creates a
NodeSelection on it: a click on the image, or ArrowRight from the end of the
block before it, leaves the selection in the preceding block. The Enter
handler in `src/components/useGherkinKeyboard.ts` already has a branch for a
top-level selection (`$from.depth === 0`, insert at `$from.pos +
nodeAfter.nodeSize`), added by `docs/plans/2026-05-19-09:33-enter-after-image.md`.
Commit `6dce539` (first data-table version) then set `selectable: false` on
both atom nodes, with the comment that y-prosemirror could not restore a
NodeSelection. That made the branch unreachable.

Current state of the pieces this change touches:

- **`@tiptap/y-tiptap` 3.0.10** is the Y.js binding that
  `@tiptap/extension-collaboration` 3.32.0 uses. (y-prosemirror 1.3.7 is
  installed too, but only for the unused collaboration-cursor extension.) It
  saves the local selection with `getRelativeSelection` (`type:
  selection.jsonID`, so `"node"` for a NodeSelection) before each remote Y
  transaction, rebuilds the doc in `_typeChanged`, and calls
  `restoreRelativeSelection` *before* dispatching. The `"node"` branch goes
  through `createSafeNodeSelection`: a NodeSelection when a node follows the
  restored position, else `TextSelection.near`.
- **`insertBlock`** (toolbar and picker) and **`insertAtomNode`** (image and
  table insert) call `$from.after()`. At depth 0 that throws `There is no
  position after the top-level node`.
- **`handleKeyDown`** handles Enter and `/` only. ProseMirror's default for a
  NodeSelection plus a typed character is to replace the node.
- The toolbar computes valid types from `getCurrentBlockType ??
  getPreviousBlockType`. With the image selected, current is `null` and
  previous is the block before the image, which is the context we want.
- `getPreviousBlockType` counts nodes ending at or before `selection.from`, so
  with the image selected it skips the image and returns the block before.
- PM's default `NodeViewDesc.selectNode` adds `ProseMirror-selectednode` to the
  node view's `dom` (`.gherkin-image-block`), so the highlight needs only CSS.
- `docs/spec/03-editor.md` is marked SUPERSEDED. The OpenSpec spec is the
  source of truth and the doc is not edited.

## Goals / Non-Goals

**Goals:**

- Selecting an image is possible by click and by arrow key, and is visible.
- Enter, toolbar insert, and image/table insert on a selected image place the
  new node after the image, without throwing.
- A selected image cannot be deleted by accidental typing; Backspace/Delete
  still remove it on purpose.
- A remote change, including deletion of the selected image, never leaves the
  local editor broken or with a whole Gherkin block selected.
- Tests check document order, so they would have caught #53.

**Non-Goals:**

- Making the data table selectable. Its cells are inputs, and it keeps
  `selectable: false`.
- Paste and IME composition over a selected image. Paste replacing a selected
  node is standard editor behaviour and is left as is.
- Changing the Collaboration extension, the sync server, or upgrading the
  Y.js binding.
- Editing `src/lib/gherkin.ts` or `canFollow()`. Insertion rules are
  unchanged, only the insert position changes.

## Decisions

### D1: Make only the image selectable

Set `selectable: true` on `gherkin_image`. This reuses ProseMirror's own
NodeSelection: click, arrow-key navigation, `ProseMirror-selectednode`, and
Backspace/Delete removal come for free. The existing Enter branch then works.

*Alternative (option B):* keep `selectable: false` and track a "clicked
image" position in plugin state, mapped through transactions, with a node
decoration for the highlight. That avoids the binding's NodeSelection path
entirely, but it is a second, imitation selection: the real PM selection
stays in another block, so typed text would land there while the image looks
selected, and arrow keys, Escape, and blur all need custom handling. It is
kept as the fallback if D5's check fails.

### D2: One helper for "position after the current selection"

Add `positionAfterSelection(state)` to `useGherkinKeyboard.ts` and export it
for unit tests: when `$from.depth === 0` return `$from.pos +
($from.nodeAfter?.nodeSize ?? 0)`, otherwise `$from.after()`. Use it in the
Enter handler (replacing the inline ternary), in `insertBlock`'s insert path,
and in `insertAtomNode`. One rule in one place, so the three callers cannot
drift. The `replace` path of `insertBlock` is unchanged: it only runs from the
`/` picker, which D3 stops from opening on a selected image.

### D3: Swallow printable keys on a selected image

At the top of `handleKeyDown`, after the Enter branch and before the `/`
branch: if the selection is a `NodeSelection` whose node is `gherkin_image`,
and the key is a single printable character with no Ctrl/Meta/Alt, return
`true`. ProseMirror calls `preventDefault` when the handler returns `true`, so
no `beforeinput` follows and the image is not replaced. Backspace, Delete,
arrows, Tab, Escape, and shortcuts (undo, copy) are not single characters or
carry a modifier, so they keep their default behaviour.

*Alternative:* insert a new block after the image and type the character into
it. Rejected: it guesses at intent, and which block type to use is the
toolbar's job.

### D4: Highlight with CSS only

Add `.gherkin-image-block.ProseMirror-selectednode` to `src/app/globals.css`,
an outline in the editor's existing accent colour. Tests assert the class, not
the colour. No `selectNode`/`deselectNode` in the node view.

### D5: Keep remote changes safe with a selected image

Two cases follow from the binding code above.

1. **Image in the middle is deleted remotely.** The saved anchor resolves to
   where the image was, so `nodeAfter` is the next Gherkin paragraph and
   `createSafeNodeSelection` could restore a NodeSelection of that whole
   block. Typing would then replace the block. In the running app (task 1.4)
   the first user ended with a text cursor in And, not a block selection. A
   safeguard is kept anyway: `NarrowNodeSelection`
   (`src/components/NarrowNodeSelection.ts`), an `appendTransaction` that
   turns any NodeSelection whose node is not `gherkin_image` into
   `TextSelection.near` inside that node. It runs on every dispatched
   transaction, including the binding's and undo's.
2. **Image at the end of the document is deleted remotely.** `nodeAfter` is
   `null`, so `createSafeNodeSelection` falls back to `TextSelection.near`
   and nothing throws. Task 1.2 confirmed it: the first user ends with a
   cursor in Then and the page has no errors. The first reading of this case
   assumed y-prosemirror 1.3.7, whose `"node"` branch calls
   `NodeSelection.create` with no check and would throw inside
   `_typeChanged`; that is not the binding the editor uses.

Implementation started with that check (tasks section 1): the collaboration
tests for both cases ran against `selectable: true` before any other code,
with a stop for the user to choose between patching the binding and option B
if case 2 failed (both touch Do-Not-Touch list item 2). Both cases passed, so
there is no dependency patch and no option B.

### D6: Order-aware tests and IDs

- A Playwright helper `documentNodes(page)` in `e2e/helpers.ts` returns the
  top-level node kinds in order (`data-gherkin-type`, or `image`, or
  `table`), mirroring Robot's `Document Nodes In Editor`. The SC-3.2.2 tests
  in both technical suites assert `nodes[imageIndex + 1] === "and"`.
- The new Image block selection scenarios take IDs `SC-3.12.1`–`SC-3.12.6`
  in scenario order (section 3.11 is the last one used). `SC-3.2.2` keeps its
  ID.
- Business-language tests: `SC-3.2.2` goes into `enter_progression_bdd.robot`;
  `SC-3.12.1`–`3.12.4` into `image_bdd.robot`, `SC-3.12.5` into
  `toolbar_bdd.robot`, `SC-3.12.6` into `collaboration_bdd.robot`. New step
  keywords go in `robot/resources/steps/gherkin_editor.resource` (and
  `realtime_collaboration.resource` for 3.12.6). `pnpm lint:robot-steps`
  must pass.
- A Vitest unit test covers `positionAfterSelection` (depth-0 selection,
  in-block selection, end of document) and the D3 key filter, using a plain
  ProseMirror `EditorState` built from the editor schema. No `vi.mock`.

## Risks / Trade-offs

- [The binding throws when the selected image at the end of the doc is
  deleted remotely] → resolved: `@tiptap/y-tiptap` falls back to a text
  selection (D5 case 2), confirmed by the SC-3.12.6 tests (task 1.2).
- [A remotely restored NodeSelection lands on a Gherkin block] → D5
  `appendTransaction` narrows it to a text selection.
- [Backspace in an empty block right after an image now selects the image
  instead of deleting it, because ProseMirror's `joinBackward` treats a
  selectable node differently] → accepted. A second Backspace deletes it.
  Covered by the existing image and data-table e2e runs; noted in the PR.
- [Dragging behaviour changes once the node is selectable] → `draggable` is
  unchanged. The drag-and-drop image test (`SC-3.8.3`) and a manual drag
  check confirm it.
- [Undo restores a NodeSelection through the same binding path] → undo goes
  through `createSafeNodeSelection` and `NarrowNodeSelection` like a remote
  change. A technical test, `SC-3.12.4 — undo restores it` (task 5.8),
  deletes a selected image, undoes, and checks the image is back and typing
  still lands in a Gherkin block.

## Human check walkthrough

What to look for when trying the fix in the browser (tasks section 4). For
each step, note "felt right", "surprising", or "wrong", and why.

**Setup**

- `pnpm dev`, open http://localhost:3000, sign in, create a session.
- Have a small PNG ready (a screenshot of part of the screen is fine; keep it
  small, because export embeds it as a data URI).
- Build Feature → Scenario → Given → When → Then with Enter, type a few words
  in each, then insert the image after Then with the toolbar Image button.
- Optional "before" pass: do steps 1 and 2 on the current code before
  `/opsx:apply`. The new And lands above the image (the #53 bug).

**Steps**

1. **Selecting.** Click the image: it gets an outline. Click Then's text: the
   outline goes. Put the cursor at the end of Then and press ArrowRight: the
   image is selected. ArrowLeft goes back. Try ArrowDown/ArrowUp too (not in
   the spec; notice what happens). Is the outline clear enough?
2. **Enter (the #53 fix).** Select the image and press Enter: a new And block
   appears below the image with the cursor in it. Type into it.
3. **Toolbar while selected.** Select the image and look at the toolbar: it
   offers what is valid after Then. Click And: the block appears below the
   image.
4. **Typing on a selected image.** Select it and type letters, then `/`.
   Nothing happens (D3). Main question: does "nothing" feel safe, or does it
   feel broken? The rejected alternative was to start a new block.
5. **Removing.** Select the image and press Backspace: it is gone and the
   blocks around it are untouched. Cmd+Z brings it back. Then put an empty
   block right after an image and press Backspace in it: the first press
   selects the image, the second deletes it (accepted trade-off above). Judge
   it.
6. **Image on image.** Select the image and insert another image from the
   toolbar: it lands below the first.
7. **Drag.** Drag the image to another place: still works.
8. **Two people.** Open the same session in a second window side by side
   (same browser, so you stay signed in). Open DevTools → Console in window 1.
   In window 1 select the image; in window 2 click it and press Backspace. In
   window 1 the image disappears, typing still works, and the console shows
   no red `TypeError: Cannot read properties of null (reading 'nodeSize')`.
   Repeat with the image as the very last block of the document; that is the
   risky case from D5.
9. **Export.** Export TXT and MD: the image sits between Then and And, in the
   order shown on screen.

**Feedback**

Report per step. Any "surprising" or "wrong" becomes a spec and design
revision before the tests in tasks sections 5 and 6 are written (task 4.2).

## Migration Plan

No data or schema change. The node's stored attributes are unchanged, so
existing sessions load as before. Rollback is reverting the commit.

## Open Questions

- Does case 2 of D5 actually throw in the running app? Answered by task 1.2:
  no, the binding falls back to a text selection.
- If it does: patch the binding or switch to option B? Not needed.
