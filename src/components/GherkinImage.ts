import { Node, mergeAttributes } from "@tiptap/core";
import { EditorState, NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

export function isImageSelected(state: EditorState): boolean {
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type.name === "gherkin_image";
}

/**
 * ProseMirror replaces a selected node with whatever text is entered over it.
 * Text input (keys, AltGr characters, emoji, IME composition) and paste both
 * go through these props, so a selected image is never replaced by text.
 */
export const protectSelectedImage = new Plugin({
  key: new PluginKey("protectSelectedImage"),
  props: {
    handleTextInput: (view) => isImageSelected(view.state),
    handlePaste: (view) => isImageSelected(view.state),
  },
});

export const GherkinImage = Node.create({
  name: "gherkin_image",
  group: "block",
  atom: true,
  selectable: true,
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

  addProseMirrorPlugins() {
    return [protectSelectedImage];
  },
});
