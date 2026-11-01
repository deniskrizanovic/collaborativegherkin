import { Extension } from "@tiptap/core";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import { EditorState, NodeSelection, Plugin, PluginKey, TextSelection, Transaction } from "@tiptap/pm/state";

/**
 * Only an image may hold a NodeSelection. A NodeSelection on any other node
 * would let the next keystroke replace a whole Gherkin block, so it is turned
 * into a text selection inside that node, or next to it for an atom node.
 */
export function narrowNodeSelection(state: EditorState): Transaction | null {
  const { selection } = state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name === "gherkin_image") return null;
  const pos = selection.node.isTextblock ? selection.from + 1 : selection.from;
  return state.tr.setSelection(TextSelection.near(state.doc.resolve(pos)));
}

/**
 * The Y.js binding restores the local selection after every remote change.
 * When the selected image is removed remotely, it can restore that
 * NodeSelection onto the Gherkin block that took the image's place. Only
 * transactions from the binding are narrowed: a NodeSelection made locally,
 * by a command or a drop, is left alone.
 */
export function narrowNodeSelectionPlugin(isRemote: (tr: Transaction) => boolean = isChangeOrigin): Plugin {
  return new Plugin({
    key: new PluginKey("narrowNodeSelection"),
    appendTransaction: (transactions, _oldState, newState) =>
      transactions.some((tr) => isRemote(tr)) ? narrowNodeSelection(newState) : null,
  });
}

export const NarrowNodeSelection = Extension.create({
  name: "narrowNodeSelection",

  addProseMirrorPlugins() {
    return [narrowNodeSelectionPlugin()];
  },
});
