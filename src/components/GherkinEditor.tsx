"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
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
  GherkinBlock,
} from "@/lib/gherkin";

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

function getBlockTypeAtPos(doc: Y.Doc | null, pos: number, state: import("@tiptap/pm/state").EditorState): GherkinBlockType | null {
  const node = state.doc.nodeAt(pos);
  return (node?.attrs?.["data-gherkin-type"] as GherkinBlockType) ?? null;
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

function getAllBlocks(state: import("@tiptap/pm/state").EditorState): GherkinBlock[] {
  const blocks: GherkinBlock[] = [];
  state.doc.forEach((node) => {
    const type = node.attrs?.["data-gherkin-type"] as GherkinBlockType | undefined;
    if (type) blocks.push({ type, text: node.textContent });
  });
  return blocks;
}

function getValidNextTypes(previous: GherkinBlockType | null): GherkinBlockType[] {
  return GHERKIN_BLOCK_TYPES.filter((t) => canFollow(previous, t));
}

interface BlockPickerProps {
  anchor: DOMRect;
  options: GherkinBlockType[];
  selectedIndex: number;
  onSelect: (type: GherkinBlockType) => void;
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
          <span style={{ fontWeight: 600 }}>{GHERKIN_LABELS[type]}</span>
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

  const [pickerState, setPickerState] = useState<{
    show: boolean;
    anchor: DOMRect | null;
    options: GherkinBlockType[];
    selectedIndex: number;
  }>({ show: false, anchor: null, options: [], selectedIndex: 0 });

  const pickerStateRef = useRef(pickerState);
  useEffect(() => { pickerStateRef.current = pickerState; }, [pickerState]);

  const closePicker = useCallback(() => {
    setPickerState({ show: false, anchor: null, options: [], selectedIndex: 0 });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
        paragraph: false, // replaced by GherkinParagraph
      }),
      GherkinParagraph,
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
            editor
              .chain()
              .focus()
              .insertContent({
                type: "paragraph",
                attrs: { "data-gherkin-type": nextType },
              })
              .run();
          }
          return true;
        }

        if (event.key === "/") {
          const prevType = getCurrentBlockType(editor.state) ?? getPreviousBlockType(editor.state);
          const options = getValidNextTypes(prevType);
          if (options.length > 0) {
            const { from } = editor.state.selection;
            const coords = editor.view.coordsAtPos(from);
            const rect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
            setTimeout(() => {
              setPickerState({ show: true, anchor: rect, options, selectedIndex: 0 });
            }, 0);
          }
          return false;
        }

        return false;
      },
    },
  });

  const insertBlock = useCallback(
    (type: GherkinBlockType, deleteSlash = false) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      if (deleteSlash) {
        const { from } = editor.state.selection;
        chain.deleteRange({ from: from - 1, to: from });
      }
      chain
        .insertContent({
          type: "paragraph",
          attrs: { "data-gherkin-type": type },
        })
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
        const { options, selectedIndex } = pickerStateRef.current;
        const type = options[selectedIndex];
        if (type) insertBlock(type, true);
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
    (type: GherkinBlockType) => {
      insertBlock(type, true);
      closePicker();
    },
    [insertBlock, closePicker]
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

  const prevBlockType = editor
    ? getCurrentBlockType(editor.state) ?? getPreviousBlockType(editor.state)
    : null;
  const validNext = getValidNextTypes(prevBlockType);

  return (
    <div className="gherkin-editor-wrapper">
      <div className="gherkin-toolbar">
        {validNext.map((type) => (
          <button
            key={type}
            className="gherkin-toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              insertBlock(type);
            }}
          >
            {GHERKIN_LABELS[type]}
          </button>
        ))}
        <button className="gherkin-export-btn" onClick={handleExport}>
          Export
        </button>
      </div>

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
