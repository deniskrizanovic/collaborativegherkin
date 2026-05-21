# Plan: Image node type for the Gherkin document model

## Context
The editor currently supports nine Gherkin block types (feature, rule, background, scenario, given, when, then, and, but). Users need to embed screenshots or diagrams alongside acceptance criteria. The `image` node should be a first-class document node: visible in the editor, insertable via toolbar button, drag-and-drop, or the slash picker, and exported as a base64 data-URI in the `.txt` file.

`image` is not a Gherkin keyword node — it carries no step semantics — so it must live outside the existing `GherkinBlockType` union. It gets its own Tiptap `Node` extension, its own export serialisation path, and `canFollow` must treat it as transparent (any block type may precede it, and `image` itself is never a "previous block type" that constrains what follows).

---

## Implementation plan

### 1. `src/lib/gherkin.ts` — export helper only
Add an `ImageBlock` type and extend `exportToText` to handle it.

```ts
export type ImageBlock = { type: "image"; src: string; alt: string };
export type DocumentBlock = GherkinBlock | ImageBlock;

// In exportToText, accept DocumentBlock[] and emit:
//   data:image/png;base64,... for image nodes
export function exportToText(blocks: DocumentBlock[]): string {
  return blocks.map((b) => {
    if (b.type === "image") return b.src; // full data-URI line
    return `${GHERKIN_LABELS[b.type]}: ${b.text}`;
  }).join("\n");
}
```

`canFollow` and `ALLOWED_AFTER` are **not touched** — image has no Gherkin semantics.

---

### 2. `src/components/GherkinEditor.tsx` — Tiptap node + UI

#### 2a. `GherkinImage` Tiptap Node extension
```ts
const GherkinImage = Node.create({
  name: "gherkin_image",
  group: "block",
  atom: true,          // not editable inline
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() { return [{ tag: 'img[data-gherkin-image]' }]; },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-gherkin-image": "" })];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "gherkin-image-block";
      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt;
      img.style.maxWidth = "100%";
      dom.appendChild(img);
      return { dom };
    };
  },
});
```

Register it in `useEditor` extensions alongside `GherkinParagraph`.

#### 2b. `getAllBlocks` — extend to collect image nodes
```ts
function getAllBlocks(state): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  state.doc.forEach((node) => {
    if (node.type.name === "gherkin_image") {
      blocks.push({ type: "image", src: node.attrs.src, alt: node.attrs.alt ?? "" });
    } else {
      const type = node.attrs?.["data-gherkin-type"] as GherkinBlockType | undefined;
      if (type) blocks.push({ type, text: node.textContent });
    }
  });
  return blocks;
}
```

#### 2c. `insertImage(file: File)` helper
Reads the file with `FileReader`, converts to base64 data-URI, inserts a `gherkin_image` node at the current cursor position:
```ts
function insertImage(file: File, editor: Editor) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target?.result as string;
    const { $from } = editor.state.selection;
    editor.chain().focus()
      .insertContentAt($from.after(), { type: "gherkin_image", attrs: { src, alt: file.name } })
      .run();
  };
  reader.readAsDataURL(file);
}
```

#### 2d. Slash picker — add "Image" option
- `getValidNextTypes` currently filters `GHERKIN_BLOCK_TYPES` through `canFollow`. Image is always valid, so append `"image" as const` to the options list returned when `/` is pressed, regardless of `prevType`.
- The picker `options` type widens to `Array<GherkinBlockType | "image">`.
- Selecting "Image" opens a hidden `<input type="file" accept="image/*">` and calls `insertImage`.

#### 2e. Toolbar button — "Image"
Always visible. `onMouseDown` opens the same hidden file-input. Use class `gherkin-image-btn` (not `gherkin-toolbar-btn`) to avoid breaking e2e count assertions in `e2e/toolbar.spec.ts`.

#### 2f. Drag-and-drop
Add a `drop` handler on the `.gherkin-editor-wrapper` div:
```ts
onDrop={(e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file?.type.startsWith("image/")) {
    e.preventDefault();
    insertImage(file, editor);
  }
}}
onDragOver={(e) => e.preventDefault()}
```

---

### 3. Critical files
| File | Change |
|------|--------|
| `src/lib/gherkin.ts` | Add `ImageBlock`, `DocumentBlock`, update `exportToText` signature |
| `src/components/GherkinEditor.tsx` | Add `GherkinImage` node, `insertImage`, picker/toolbar/drag-drop wiring |

---

## Verification
1. `npm run test` — existing Vitest unit tests must stay green; add unit test for `exportToText` with an image block.
2. `npx playwright test` — all e2e specs must pass, including `e2e/toolbar.spec.ts`.
3. `npm run dev` + `npm run dev:ws` — manually verify:
   - Toolbar "Image" button opens file picker, image appears in editor.
   - Typing `/` shows "Image" in the picker; selecting it opens the file picker.
   - Dragging an image file onto the editor embeds it.
   - Clicking Export downloads a `.txt` where images appear as their data-URI.
   - Text blocks before and after an image export correctly.
4. Two browser tabs — confirm image nodes sync in real time via Yjs (the Tiptap Collaboration extension handles this automatically for custom atom nodes).
