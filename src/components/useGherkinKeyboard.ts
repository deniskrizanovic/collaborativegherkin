import { useCallback, useEffect, useLayoutEffect, useRef, useState, MutableRefObject } from "react";
import { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import {
  GherkinBlockType,
  NEXT_BLOCK_ON_ENTER,
  canFollow,
  exportToText,
  DocumentBlock,
  DataTableBlock,
} from "@/lib/gherkin";
import { InsertableType, getValidNextTypes } from "./BlockPicker";

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

function insertAtomNode(editor: Editor, node: import("@tiptap/pm/model").Node) {
  const { state, view } = editor;
  const insertPos = state.selection.$from.after();
  const tr = state.tr.insert(insertPos, node);
  const afterPos = Math.min(insertPos + node.nodeSize, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos)));
  view.dispatch(tr);
}

function insertImageFromFile(file: File, editor: Editor) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target?.result as string;
    insertAtomNode(editor, editor.state.schema.nodes.gherkin_image.create({ src, alt: file.name }));
  };
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
} {
  const [pickerState, setPickerState] = useState<PickerState>(CLOSED_PICKER);
  const pickerStateRef = useRef(pickerState);
  useLayoutEffect(() => { pickerStateRef.current = pickerState; });

  // Keep triggerFileUpload stable in a ref so insertBlock doesn't re-create on every render
  const triggerFileUploadRef = useRef(triggerFileUpload);
  useEffect(() => { triggerFileUploadRef.current = triggerFileUpload; }, [triggerFileUpload]);

  const closePicker = useCallback(() => {
    setPickerState(CLOSED_PICKER);
  }, []);

  const insertBlock = useCallback(
    (type: InsertableType, deleteSlash = false, replace = false) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (type === "data_table") {
        if (deleteSlash) {
          const { from } = editor.state.selection;
          editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
        }
        insertAtomNode(
          editor,
          editor.state.schema.nodes.gherkin_data_table.create({
            rows: JSON.stringify([["", ""], ["", ""]]),
          })
        );
        return;
      }

      if (type === "image") {
        if (deleteSlash) {
          const { from } = editor.state.selection;
          editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
        }
        triggerFileUploadRef.current();
        return;
      }

      if (deleteSlash) {
        const { from } = editor.state.selection;
        editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
      }

      if (replace) {
        const { $from } = editor.state.selection;
        const nodeStart = $from.before();
        editor.chain().focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(nodeStart, undefined, { "data-gherkin-type": type });
            return true;
          })
          .run();
        return;
      }

      const { $from } = editor.state.selection;
      const insertPos = $from.after();
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
          const { $from } = editor.state.selection;
          const insertPos =
            $from.depth > 0
              ? $from.after()
              : $from.pos + ($from.nodeAfter?.nodeSize ?? 0);
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

      if (event.key === "/") {
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
      if (editor) insertImageFromFile(file, editor);
    },
    [editorRef]
  );

  const handleToolbarInsert = useCallback(
    (type: InsertableType) => {
      insertBlock(type, false, false);
    },
    [insertBlock]
  );

  return { handleKeyDown, pickerState, closePicker, handlePickerSelect, handleToolbarInsert, getContentText, insertImageFromFile: insertImage };
}
