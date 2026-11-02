import { useCallback, useEffect, useLayoutEffect, useRef, useState, MutableRefObject } from "react";
import { Editor } from "@tiptap/react";
import { EditorState, NodeSelection, TextSelection, Transaction } from "@tiptap/pm/state";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Node as PMNode } from "@tiptap/pm/model";
import {
  GherkinBlockType,
  NEXT_BLOCK_ON_ENTER,
  canFollow,
  exportToText,
  DocumentBlock,
  DataTableBlock,
} from "@/lib/gherkin";
import { InsertableType, getValidNextTypes } from "./BlockPicker";
import { isImageSelected } from "./GherkinImage";
import { focusFirstTableCell } from "./GherkinDataTable";

export interface PickerState {
  show: boolean;
  anchor: DOMRect | null;
  options: InsertableType[];
  selectedIndex: number;
  replace: boolean;
}

const CLOSED_PICKER: PickerState = {
  show: false,
  anchor: null,
  options: [],
  selectedIndex: 0,
  replace: false,
};

export function getPreviousBlockType(state: import("@tiptap/pm/state").EditorState): GherkinBlockType | null {
  const { selection, doc } = state;
  let prev: GherkinBlockType | null = null;
  doc.forEach((node, offset) => {
    if (offset + node.nodeSize <= selection.from) {
      const t = node.attrs?.["data-gherkin-type"] as GherkinBlockType | undefined;
      if (t) prev = t;
    }
  });
  return prev;
}

export function getCurrentBlockType(state: import("@tiptap/pm/state").EditorState): GherkinBlockType | null {
  const { selection, doc } = state;
  let current: GherkinBlockType | null = null;
  doc.forEach((node, offset) => {
    if (offset < selection.from && offset + node.nodeSize > selection.from) {
      const t = node.attrs?.["data-gherkin-type"] as GherkinBlockType | undefined;
      if (t) current = t;
    }
  });
  return current;
}

export function getAllBlocks(state: import("@tiptap/pm/state").EditorState): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  state.doc.forEach((node) => {
    if (node.type.name === "gherkin_image") {
      blocks.push({ type: "image", src: node.attrs.src, alt: node.attrs.alt ?? "" });
    } else if (node.type.name === "gherkin_data_table") {
      blocks.push({ type: "data_table", rows: JSON.parse(node.attrs.rows as string) } as DataTableBlock);
    } else {
      const type = node.attrs?.["data-gherkin-type"] as GherkinBlockType | undefined;
      if (type) blocks.push({ type, text: node.textContent });
    }
  });
  return blocks;
}

/**
 * Where a block inserted "after the cursor" goes: after the selected image,
 * into the gap of a gap cursor, or after the block holding a text selection.
 * Null for any other selection (for example Select All), where there is no
 * single block to insert after.
 */
export function positionAfterSelection(state: EditorState): number | null {
  const { selection } = state;
  if (selection instanceof NodeSelection) return selection.to;
  if (selection instanceof GapCursor) return selection.from;
  if (selection instanceof TextSelection && selection.$from.depth > 0) return selection.$from.after();
  return null;
}

/**
 * Which top-level block a drop at viewport coordinate `y` goes after, given
 * each block's top edge in document order: the last block whose top is at or
 * above `y`, or the first block when `y` is above them all. A drop in the gap
 * between two blocks therefore picks the upper one, so the image lands in
 * that gap.
 */
export function blockIndexAtY(tops: number[], y: number): number {
  let index = 0;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= y) index = i;
    else break;
  }
  return index;
}

export interface BlockRect {
  top: number;
  width: number;
  height: number;
}

/**
 * The document position after the top-level block at viewport coordinate
 * `clientY` (see `blockIndexAtY`). `rectOf` gives the rendered rect of the
 * top-level node at an offset, or null when it has no DOM yet. Blocks with no
 * DOM or a zero-size rect (hidden or detached) are skipped, so they never
 * break the order of tops and are never picked. With no rendered block the
 * image goes at the end of the document.
 */
export function positionAfterBlockAtY(
  doc: PMNode,
  rectOf: (offset: number) => BlockRect | null,
  clientY: number
): number {
  const tops: number[] = [];
  const ends: number[] = [];
  doc.forEach((node, offset) => {
    const rect = rectOf(offset);
    if (rect === null || (rect.width === 0 && rect.height === 0)) return;
    tops.push(rect.top);
    ends.push(offset + node.nodeSize);
  });
  return ends.length === 0 ? doc.content.size : ends[blockIndexAtY(tops, clientY)];
}

function renderedRect(editor: Editor, offset: number): BlockRect | null {
  const dom = editor.view.nodeDOM(offset);
  return dom instanceof Element ? dom.getBoundingClientRect() : null;
}

/**
 * The transaction that inserts `node` at the top-level position at or after
 * `pos`, with the cursor placed after it, and the position it went in at.
 */
export function atomInsertTransaction(state: EditorState, node: PMNode, pos: number): { tr: Transaction; insertPos: number } {
  return insertAtomInto(state.tr, node, pos);
}

function insertAtomInto(tr: Transaction, node: PMNode, pos: number): { tr: Transaction; insertPos: number } {
  const $pos = tr.doc.resolve(Math.min(pos, tr.doc.content.size));
  // A remote change may leave a tracked position inside a block.
  const insertPos = $pos.depth === 0 ? $pos.pos : $pos.after(1);
  tr.insert(insertPos, node);
  const afterPos = Math.min(insertPos + node.nodeSize, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos)));
  return { tr, insertPos };
}

/**
 * The transaction that inserts `node` after the block holding the selection
 * (see `positionAfterSelection`), first removing the `/` just before the
 * cursor when `deleteSlash` is set and that character is a `/`. One
 * transaction, so collaborators never see the slash gone without the node and
 * one undo reverts both. Null when there is no block to insert after.
 */
export function slashAtomInsertTransaction(
  state: EditorState,
  node: PMNode,
  deleteSlash: boolean
): { tr: Transaction; insertPos: number } | null {
  const pos = positionAfterSelection(state);
  if (pos === null) return null;
  const tr = state.tr;
  const { from } = state.selection;
  if (deleteSlash && from > 0 && state.doc.textBetween(from - 1, from) === "/") tr.delete(from - 1, from);
  return insertAtomInto(tr, node, tr.mapping.map(pos));
}

function insertAtomNodeAt(editor: Editor, node: PMNode, pos: number) {
  editor.view.dispatch(atomInsertTransaction(editor.state, node, pos).tr);
}

interface TrackedPosition {
  current: () => number;
  stop: () => void;
}

/**
 * Follows a document position through later changes, local and remote, so an
 * image chosen in the file dialog lands where the upload was started.
 */
function trackPosition(editor: Editor, pos: number): TrackedPosition {
  let position = editor.utils.createMappablePosition(pos);
  const onTransaction = ({ transaction }: { transaction: Transaction }) => {
    position = editor.utils.getUpdatedPosition(position, transaction).position;
  };
  editor.on("transaction", onTransaction);
  return { current: () => position.position, stop: () => editor.off("transaction", onTransaction) };
}

function trackPositionAfterSelection(editor: Editor): TrackedPosition | null {
  const pos = positionAfterSelection(editor.state);
  return pos === null ? null : trackPosition(editor, pos);
}

function insertImageFromFile(file: File, editor: Editor, target: TrackedPosition | null) {
  const reader = new FileReader();
  reader.onload = (e) => {
    target?.stop();
    if (!target || editor.isDestroyed) return;
    const src = e.target?.result as string;
    insertAtomNodeAt(editor, editor.state.schema.nodes.gherkin_image.create({ src, alt: file.name }), target.current());
  };
  // A failed or aborted read inserts nothing, but must still stop tracking.
  reader.onerror = reader.onabort = () => target?.stop();
  reader.readAsDataURL(file);
}

// editorRef breaks the circular dep: hook is called before useEditor returns,
// but callbacks read editorRef.current at call time when the editor is ready.
export function useGherkinKeyboard(
  editorRef: MutableRefObject<Editor | null>,
  triggerFileUpload: () => void
): {
  handleKeyDown: (view: import("@tiptap/pm/view").EditorView, event: KeyboardEvent) => boolean;
  pickerState: PickerState;
  closePicker: () => void;
  handlePickerSelect: (type: InsertableType) => void;
  handleToolbarInsert: (type: InsertableType) => void;
  getContentText: () => string;
  insertImageFromFile: (file: File) => void;
  insertDroppedImage: (file: File, clientY: number) => void;
  cancelImageUpload: () => void;
} {
  const [pickerState, setPickerState] = useState<PickerState>(CLOSED_PICKER);
  const pickerStateRef = useRef(pickerState);
  useLayoutEffect(() => { pickerStateRef.current = pickerState; });

  // Keep triggerFileUpload stable in a ref so insertBlock doesn't re-create on every render
  const triggerFileUploadRef = useRef(triggerFileUpload);
  useEffect(() => { triggerFileUploadRef.current = triggerFileUpload; }, [triggerFileUpload]);

  // Where the image from the open file dialog goes, captured when the upload starts
  const uploadTargetRef = useRef<TrackedPosition | null>(null);

  const closePicker = useCallback(() => {
    setPickerState(CLOSED_PICKER);
  }, []);

  const insertBlock = useCallback(
    (type: InsertableType, deleteSlash = false, replace = false) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (type === "data_table") {
        // No chain().focus(): Tiptap defers it to the next frame, where it
        // would take focus back from the first cell.
        const inserted = slashAtomInsertTransaction(
          editor.state,
          editor.state.schema.nodes.gherkin_data_table.create({
            rows: JSON.stringify([["", ""], ["", ""]]),
          }),
          deleteSlash
        );
        if (inserted) editor.view.dispatch(inserted.tr);
        // Only the inserting client runs this, so collaborators keep their focus.
        // With no cell to focus, put the caret back in the editor instead.
        if (!inserted || !focusFirstTableCell(editor.view.nodeDOM(inserted.insertPos))) editor.view.focus();
        return;
      }

      if (type === "image") {
        if (deleteSlash) {
          const { from } = editor.state.selection;
          editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
        }
        uploadTargetRef.current?.stop();
        uploadTargetRef.current = trackPositionAfterSelection(editor);
        triggerFileUploadRef.current();
        return;
      }

      if (deleteSlash) {
        const { from } = editor.state.selection;
        editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
      }

      const { $from } = editor.state.selection;
      // A selected image sits at depth 0 with no block to retype; insert after it instead
      if (replace && $from.depth > 0) {
        const nodeStart = $from.before();
        editor.chain().focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(nodeStart, undefined, { "data-gherkin-type": type });
            return true;
          })
          .run();
        return;
      }

      const insertPos = positionAfterSelection(editor.state);
      if (insertPos === null) return;
      editor.chain().focus()
        .insertContentAt(insertPos, {
          type: "paragraph",
          attrs: { "data-gherkin-type": type },
        })
        .setTextSelection(insertPos + 1)
        .run();
    },
    [editorRef]
  );

  const handleKeyDown = useCallback(
    (_view: import("@tiptap/pm/view").EditorView, event: KeyboardEvent): boolean => {
      const editor = editorRef.current;
      if (!editor) return false;

      if (event.key === "Enter") {
        event.preventDefault();
        const { state } = editor;
        const currentType = getCurrentBlockType(state);
        const prevType = getPreviousBlockType(state);
        const contextType = currentType ?? prevType;
        const nextType = contextType ? NEXT_BLOCK_ON_ENTER[contextType] : null;

        if (nextType && canFollow(currentType ?? prevType, nextType)) {
          const insertPos = positionAfterSelection(editor.state);
          if (insertPos === null) return true;
          editor
            .chain()
            .focus()
            .insertContentAt(insertPos, {
              type: "paragraph",
              attrs: { "data-gherkin-type": nextType },
            })
            .setTextSelection(insertPos + 1)
            .run();
        }
        return true;
      }

      // The image's own plugin keeps the "/" from replacing it; only the picker is skipped here
      if (event.key === "/" && !isImageSelected(editor.state)) {
        const currentType = getCurrentBlockType(editor.state);
        const prevType = getPreviousBlockType(editor.state);
        const options = getValidNextTypes(prevType);
        const replacing = currentType !== null;
        if (options.length > 0) {
          const { from } = editor.state.selection;
          const coords = editor.view.coordsAtPos(from);
          const rect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
          setTimeout(() => {
            setPickerState({ show: true, anchor: rect, options, selectedIndex: 0, replace: replacing });
          }, 0);
        }
        return false;
      }

      return false;
    },
    [editorRef]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!pickerStateRef.current.show) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setPickerState((s) => ({ ...s, selectedIndex: (s.selectedIndex + 1) % s.options.length }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setPickerState((s) => ({ ...s, selectedIndex: (s.selectedIndex - 1 + s.options.length) % s.options.length }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const { options, selectedIndex, replace } = pickerStateRef.current;
        const type = options[selectedIndex];
        if (type) insertBlock(type, true, replace);
        closePicker();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePicker();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [closePicker, insertBlock]);

  const handlePickerSelect = useCallback(
    (type: InsertableType) => {
      insertBlock(type, true, pickerStateRef.current.replace);
      closePicker();
    },
    [insertBlock, closePicker]
  );

  const getContentText = useCallback((): string => {
    const editor = editorRef.current;
    if (!editor) return "";
    return exportToText(getAllBlocks(editor.state));
  }, [editorRef]);

  const insertImage = useCallback(
    (file: File) => {
      const editor = editorRef.current;
      if (!editor) return;
      const target = uploadTargetRef.current ?? trackPositionAfterSelection(editor);
      uploadTargetRef.current = null;
      insertImageFromFile(file, editor, target);
    },
    [editorRef]
  );

  // A drop goes after the block under the pointer. It ignores the cursor and
  // any open file dialog's target, which keeps its own position.
  const insertDroppedImage = useCallback(
    (file: File, clientY: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      const pos = positionAfterBlockAtY(editor.state.doc, (offset) => renderedRect(editor, offset), clientY);
      insertImageFromFile(file, editor, trackPosition(editor, pos));
    },
    [editorRef]
  );

  // The file dialog closed without a file: drop its target so it stops
  // tracking and a late change event cannot insert at the stale position.
  const cancelImageUpload = useCallback(() => {
    uploadTargetRef.current?.stop();
    uploadTargetRef.current = null;
  }, []);

  const handleToolbarInsert = useCallback(
    (type: InsertableType) => {
      insertBlock(type, false, false);
    },
    [insertBlock]
  );

  return { handleKeyDown, pickerState, closePicker, handlePickerSelect, handleToolbarInsert, getContentText, insertImageFromFile: insertImage, insertDroppedImage, cancelImageUpload };
}
