"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { GherkinBlockType, GHERKIN_LABELS, exportToMarkdown, parseGherkin, DataTableBlock } from "@/lib/gherkin";
import { GherkinDataTable } from "./GherkinDataTable";
import { BlockPicker, getValidNextTypes } from "./BlockPicker";
import { useCollabProvider } from "./useCollabProvider";
import { useGherkinKeyboard, getAllBlocks, getCurrentBlockType, getPreviousBlockType } from "./useGherkinKeyboard";

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

export interface GherkinEditorHandle {
  getContent: () => string;
}

interface GherkinEditorProps {
  sessionId: string;
  wsUrl?: string;
}

const GherkinEditor = forwardRef<GherkinEditorHandle, GherkinEditorProps>(
function GherkinEditor({ sessionId, wsUrl = "ws://localhost:1234" }, ref) {
  const { ydoc, provider } = useCollabProvider(sessionId, wsUrl);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  // editorRef breaks the circular dependency: useGherkinKeyboard reads the
  // editor via ref so it can be called before useEditor returns.
  const editorRef = useRef<import("@tiptap/react").Editor | null>(null);

  const { handleKeyDown, pickerState, closePicker, handlePickerSelect, handleToolbarInsert, getContentText, insertImageFromFile } =
    useGherkinKeyboard(editorRef, () => fileInputRef.current?.click());

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false, paragraph: false }),
      GherkinParagraph,
      GherkinImage,
      GherkinDataTable,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: "Anonymous", color: randomColor() },
      }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "gherkin-editor" },
      handleKeyDown,
    },
  });

  // Keep editorRef in sync so the keyboard hook always reads the latest editor
  useEffect(() => { editorRef.current = editor ?? null; }, [editor]);

  const seededRef = useRef(false);

  useEffect(() => {
    if (!editor) return;
    const typedProvider = provider as unknown as {
      synced?: boolean;
      on(event: string, handler: () => void): void;
      off(event: string, handler: () => void): void;
    };

    const handleSynced = () => {
      if (seededRef.current) return;
      seededRef.current = true;
      if (getAllBlocks(editor.state).length === 0) {
        editor.commands.setContent({
          type: "doc",
          content: [
            { type: "paragraph", attrs: { "data-gherkin-type": "feature" }, content: [] },
            { type: "paragraph", attrs: { "data-gherkin-type": "scenario" }, content: [] },
            { type: "paragraph", attrs: { "data-gherkin-type": "given" }, content: [] },
            { type: "paragraph", attrs: { "data-gherkin-type": "when" }, content: [] },
            { type: "paragraph", attrs: { "data-gherkin-type": "then" }, content: [] },
          ],
        });
        editor.commands.setTextSelection(1);
      }
    };

    if (typedProvider.synced) {
      handleSynced();
    } else {
      typedProvider.on("synced", handleSynced);
    }
    return () => { typedProvider.off("synced", handleSynced); };
  }, [editor, provider]);

  useImperativeHandle(ref, () => ({
    getContent: () => getContentText(),
  }), [getContentText]);

  const handleExport = useCallback(() => {
    if (!editor) return;
    const text = getContentText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gherkin.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [editor, getContentText]);

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

  function handleImportConfirm() {
    if (!editor) return;
    const blocks = parseGherkin(importText);
    if (blocks.length === 0) {
      setImportOpen(false);
      setImportText("");
      return;
    }

    const { schema, state, view } = editor;
    const tr = state.tr;
    let pos = state.selection.$from.after();

    for (const b of blocks) {
      let node: import("@tiptap/pm/model").Node;
      if (b.type === "data_table") {
        node = schema.nodes.gherkin_data_table.create({ rows: JSON.stringify((b as DataTableBlock).rows) });
      } else if (b.type === "image") {
        node = schema.nodes.gherkin_image.create({ src: (b as { type: "image"; src: string; alt: string }).src, alt: (b as { type: "image"; src: string; alt: string }).alt });
      } else {
        const textContent = b.text ? [schema.text(b.text)] : [];
        node = schema.nodes.paragraph.create({ "data-gherkin-type": b.type }, textContent);
      }
      tr.insert(pos, node);
      pos += node.nodeSize;
    }

    view.dispatch(tr);
    setImportOpen(false);
    setImportText("");
  }

  const prevBlockType = editor
    ? getCurrentBlockType(editor.state) ?? getPreviousBlockType(editor.state)
    : null;
  const validNext = getValidNextTypes(prevBlockType);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) insertImageFromFile(file);
      e.target.value = "";
    },
    [insertImageFromFile]
  );

  return (
    <div
      className="gherkin-editor-wrapper"
      onDrop={(e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file?.type.startsWith("image/") && editor) {
          e.preventDefault();
          insertImageFromFile(file);
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
                handleToolbarInsert(type);
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
              handleToolbarInsert("data_table");
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
        <button
          className="gherkin-import-btn"
          onMouseDown={(e) => { e.preventDefault(); setImportOpen(true); }}
        >
          Import
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

      {importOpen && (
        <div className="gherkin-import-modal">
          <div className="gherkin-import-modal-inner">
            <textarea
              className="gherkin-import-textarea"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Feature: My feature\nScenario: My scenario\nGiven some context\nWhen I do something\nThen I see the result"}
              rows={12}
            />
            <div className="gherkin-import-actions">
              <button className="gherkin-import-confirm" onClick={handleImportConfirm}>
                Insert
              </button>
              <button className="gherkin-import-cancel" onClick={() => { setImportOpen(false); setImportText(""); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
});

GherkinEditor.displayName = "GherkinEditor";

export default GherkinEditor;
