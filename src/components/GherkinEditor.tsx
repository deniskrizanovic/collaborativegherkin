"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  GherkinBlockType,
  GHERKIN_LABELS,
  GHERKIN_BLOCK_TYPES,
  canFollow,
  NEXT_BLOCK_ON_ENTER,
  exportToText,
  exportToMarkdown,
  DocumentBlock,
  DataTableBlock,
} from "@/lib/gherkin";

const GherkinImage = Node.create({
  name: "gherkin_image",
  group: "block",
  atom: true,
  selectable: false,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-gherkin-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-gherkin-image": "" })];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "gherkin-image-block";
      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt ?? "";
      img.style.maxWidth = "100%";
      dom.appendChild(img);
      return { dom };
    };
  },
});

const STEP_TYPES: GherkinBlockType[] = ["given", "when", "then", "and", "but"];

const GherkinDataTable = Node.create({
  name: "gherkin_data_table",
  group: "block",
  atom: true,
  selectable: false,
  draggable: true,

  addAttributes() {
    return {
      // JSON string: Y.js attribute equality is reference-based, so arrays always
      // trigger setAttribute; a string only writes when the content actually changes.
      rows: { default: JSON.stringify([["", ""], ["", ""]]) },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-gherkin-table]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gherkin-table": "" })];
  },

  addNodeView() {
    return ({ node, getPos, editor: nodeEditor }) => {
      let rows: string[][] = JSON.parse(node.attrs.rows as string);

      const dom = document.createElement("div");
      dom.className = "gherkin-table-block";
      dom.setAttribute("data-gherkin-table", "");
      dom.contentEditable = "false";

      const table = document.createElement("table");
      table.style.borderCollapse = "collapse";

      const tbody = document.createElement("tbody");

      function getCells(): HTMLElement[] {
        return Array.from(dom.querySelectorAll("td[data-cell]")) as HTMLElement[];
      }

      let committedRows = node.attrs.rows as string;

      function commitRows() {
        if (typeof getPos !== "function") return;
        const serialized = JSON.stringify(rows);
        if (serialized === committedRows) return;
        committedRows = serialized;
        nodeEditor.commands.command(({ tr }) => {
          tr.setNodeMarkup(getPos(), undefined, { rows: serialized });
          return true;
        });
      }

      function buildTable() {
        tbody.innerHTML = "";
        rows.forEach((row, ri) => {
          const tr = document.createElement("tr");
          row.forEach((cell, ci) => {
            const td = document.createElement("td");
            td.setAttribute("data-cell", `${ri}-${ci}`);
            td.contentEditable = "true";
            td.textContent = cell;
            td.style.cssText =
              "border:1px solid #d1d5db;padding:4px 8px;min-width:60px;outline:none;";

            td.addEventListener("input", () => {
              rows[ri][ci] = td.textContent ?? "";
            });

            td.addEventListener("blur", () => {
              rows[ri][ci] = td.textContent ?? "";
              commitRows();
            });

            td.addEventListener("keydown", (e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                const cells = getCells();
                const idx = cells.indexOf(td);
                const next = e.shiftKey ? cells[idx - 1] : cells[idx + 1];
                if (next) (next as HTMLElement).focus();
              }
            });

            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }

      buildTable();
      table.appendChild(tbody);
      dom.appendChild(table);

      const controls = document.createElement("div");
      controls.style.cssText = "margin-top:4px;display:flex;gap:6px;";

      const addRowBtn = document.createElement("button");
      addRowBtn.textContent = "Add row";
      addRowBtn.className = "gherkin-table-add-row";
      addRowBtn.style.cssText =
        "font-size:12px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;background:#f9fafb;";
      addRowBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        rows.push(Array(rows[0].length).fill(""));
        buildTable();
        commitRows();
      });

      const addColBtn = document.createElement("button");
      addColBtn.textContent = "Add column";
      addColBtn.className = "gherkin-table-add-col";
      addColBtn.style.cssText =
        "font-size:12px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;background:#f9fafb;";
      addColBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        rows = rows.map((r) => [...r, ""]);
        buildTable();
        commitRows();
      });

      controls.appendChild(addRowBtn);
      controls.appendChild(addColBtn);
      dom.appendChild(controls);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== "gherkin_data_table") return false;
          committedRows = updatedNode.attrs.rows as string;
          rows = JSON.parse(committedRows);
          buildTable();
          return true;
        },
        stopEvent() {
          return true;
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});

// Paragraph extension extended to carry data-gherkin-type on every block
const GherkinParagraph = Node.create({
  name: "paragraph",
  priority: 1000,
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      "data-gherkin-type": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-gherkin-type"),
        renderHTML: (attrs) =>
          attrs["data-gherkin-type"]
            ? { "data-gherkin-type": attrs["data-gherkin-type"] }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "p" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes), 0];
  },
});

const CURSOR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4",
];

function randomColor() {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

function getPreviousBlockType(state: import("@tiptap/pm/state").EditorState): GherkinBlockType | null {
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

function getCurrentBlockType(state: import("@tiptap/pm/state").EditorState): GherkinBlockType | null {
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

function getAllBlocks(state: import("@tiptap/pm/state").EditorState): DocumentBlock[] {
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

type InsertableType = GherkinBlockType | "image" | "data_table";

const INSERTABLE_LABELS: Record<InsertableType, string> = {
  ...GHERKIN_LABELS,
  image: "Image",
  data_table: "Table",
};

function getValidNextTypes(previous: GherkinBlockType | null): InsertableType[] {
  const types: InsertableType[] = [...GHERKIN_BLOCK_TYPES.filter((t) => canFollow(previous, t))];
  if (previous && STEP_TYPES.includes(previous)) types.push("data_table");
  if (previous !== null) types.push("image");
  return types;
}

// Atom nodes (selectable:false) must be inserted via a single raw transaction
// so y-prosemirror never snapshots a NodeSelection it can't restore.
function insertAtomNode(
  editor: import("@tiptap/react").Editor,
  node: import("@tiptap/pm/model").Node
) {
  const { state, view } = editor;
  const insertPos = state.selection.$from.after();
  const tr = state.tr.insert(insertPos, node);
  const afterPos = Math.min(insertPos + node.nodeSize, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos)));
  view.dispatch(tr);
}

function insertImageFromFile(file: File, editor: import("@tiptap/react").Editor) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target?.result as string;
    insertAtomNode(editor, editor.state.schema.nodes.gherkin_image.create({ src, alt: file.name }));
  };
  reader.readAsDataURL(file);
}

interface BlockPickerProps {
  anchor: DOMRect;
  options: InsertableType[];
  selectedIndex: number;
  onSelect: (type: InsertableType) => void;
  onClose: () => void;
}

function BlockPicker({ anchor, options, selectedIndex, onSelect, onClose }: BlockPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: anchor.bottom + 4,
        left: anchor.left,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        zIndex: 1000,
        minWidth: 160,
      }}
    >
      {options.map((type, i) => (
        <button
          key={type}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(type);
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 14px",
            textAlign: "left",
            background: i === selectedIndex ? "#f3f4f6" : "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            color: "#111827",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = i === selectedIndex ? "#f3f4f6" : "none")}
        >
          <span style={{ fontWeight: 600 }}>{INSERTABLE_LABELS[type]}</span>
        </button>
      ))}
    </div>
  );
}

interface GherkinEditorProps {
  sessionId: string;
  wsUrl?: string;
}

export default function GherkinEditor({
  sessionId,
  wsUrl = "ws://localhost:1234",
}: GherkinEditorProps) {
  // Create ydoc and provider synchronously so they're ready before useEditor runs
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  if (!providerRef.current) {
    providerRef.current = new WebsocketProvider(
      wsUrl,
      `session-${sessionId}`,
      ydocRef.current
    );
  }

  // Clean up provider when component unmounts
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pickerState, setPickerState] = useState<{
    show: boolean;
    anchor: DOMRect | null;
    options: InsertableType[];
    selectedIndex: number;
    replace: boolean;
  }>({ show: false, anchor: null, options: [], selectedIndex: 0, replace: false });

  const pickerStateRef = useRef(pickerState);
  useEffect(() => { pickerStateRef.current = pickerState; }, [pickerState]);

  const closePicker = useCallback(() => {
    setPickerState({ show: false, anchor: null, options: [], selectedIndex: 0, replace: false });
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        history: false,
        paragraph: false, // replaced by GherkinParagraph
      }),
      GherkinParagraph,
      GherkinImage,
      GherkinDataTable,
      Collaboration.configure({ document: ydocRef.current }),
      CollaborationCursor.configure({
        provider: providerRef.current,
        user: { name: "Anonymous", color: randomColor() },
      }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "gherkin-editor" },
      handleKeyDown(_view, event) {
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
          // On a typed block: replace its type using what precedes it as context.
          // On an untyped line: insert after using the same prev context.
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
    },
  });

  const insertBlock = useCallback(
    (type: InsertableType, deleteSlash = false, replace = false) => {
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
        fileInputRef.current?.click();
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
    [editor]
  );

  useEffect(() => {
    if (!pickerState.show) return;
    const handler = (e: KeyboardEvent) => {
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
  }, [pickerState.show, closePicker, insertBlock]);

  const handlePickerSelect = useCallback(
    (type: InsertableType) => {
      insertBlock(type, true, pickerState.replace);
      closePicker();
    },
    [insertBlock, closePicker, pickerState.replace]
  );

  const handleExport = useCallback(() => {
    if (!editor) return;
    const blocks = getAllBlocks(editor.state);
    const text = exportToText(blocks);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gherkin.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  const handleExportMarkdown = useCallback(() => {
    if (!editor) return;
    const blocks = getAllBlocks(editor.state);
    const text = exportToMarkdown(blocks);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gherkin.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  const prevBlockType = editor
    ? getCurrentBlockType(editor.state) ?? getPreviousBlockType(editor.state)
    : null;
  const validNext = getValidNextTypes(prevBlockType);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && editor) insertImageFromFile(file, editor);
      e.target.value = "";
    },
    [editor]
  );

  return (
    <div
      className="gherkin-editor-wrapper"
      onDrop={(e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file?.type.startsWith("image/") && editor) {
          e.preventDefault();
          insertImageFromFile(file, editor);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="gherkin-toolbar">
        {validNext
          .filter((type) => type !== "image" && type !== "data_table")
          .map((type) => (
            <button
              key={type}
              className="gherkin-toolbar-btn"
              onMouseDown={(e) => {
                e.preventDefault();
                insertBlock(type);
              }}
            >
              {GHERKIN_LABELS[type as GherkinBlockType]}
            </button>
          ))}
        {validNext.includes("data_table") && (
          <button
            className="gherkin-toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              insertBlock("data_table");
            }}
          >
            Table
          </button>
        )}
        {validNext.includes("image") && (
          <button
            className="gherkin-toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
          >
            Image
          </button>
        )}
        <button className="gherkin-export-btn" onClick={handleExport}>
          Export TXT
        </button>
        <button className="gherkin-export-md-btn" onClick={handleExportMarkdown}>
          Export MD
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      <EditorContent editor={editor} />

      {pickerState.show && pickerState.anchor && (
        <BlockPicker
          anchor={pickerState.anchor}
          options={pickerState.options}
          selectedIndex={pickerState.selectedIndex}
          onSelect={handlePickerSelect}
          onClose={closePicker}
        />
      )}
    </div>
  );
}
