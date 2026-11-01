import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Node as PMNode } from "@tiptap/pm/model";
import { GherkinImage, isImageSelected, protectSelectedImage } from "./GherkinImage";
import { GherkinParagraph } from "./GherkinParagraph";
import { GherkinDataTable } from "./GherkinDataTable";
import { narrowNodeSelection, narrowNodeSelectionPlugin } from "./NarrowNodeSelection";
import { positionAfterSelection } from "./useGherkinKeyboard";

const schema = getSchema([
  StarterKit.configure({ undoRedo: false, paragraph: false, trailingNode: false, link: false, underline: false }),
  GherkinParagraph,
  GherkinImage,
  GherkinDataTable,
]);

function block(type: string, text = ""): PMNode {
  return schema.nodes.paragraph.create({ "data-gherkin-type": type }, text ? [schema.text(text)] : []);
}

function image(): PMNode {
  return schema.nodes.gherkin_image.create({ src: "data:image/png;base64,", alt: "img" });
}

// Then "Before" (0–8), image (8–9), And "After" (9–16)
const middleDoc = schema.nodes.doc.create(null, [block("then", "Before"), image(), block("and", "After")]);
// Then "Before" (0–8), image (8–9)
const lastDoc = schema.nodes.doc.create(null, [block("then", "Before"), image()]);

function stateWith(doc: PMNode, select: (doc: PMNode) => import("@tiptap/pm/state").Selection): EditorState {
  const state = EditorState.create({ schema, doc });
  return state.apply(state.tr.setSelection(select(state.doc)));
}

describe("positionAfterSelection", () => {
  it("returns the position after a selected image", () => {
    const state = stateWith(middleDoc, (doc) => NodeSelection.create(doc, 8));
    expect(positionAfterSelection(state)).toBe(9);
  });

  it("returns the position after the block holding the cursor", () => {
    const state = stateWith(middleDoc, (doc) => TextSelection.create(doc, 3));
    expect(positionAfterSelection(state)).toBe(8);
  });

  it("returns the end of the document for a selected image at the end", () => {
    const state = stateWith(lastDoc, (doc) => NodeSelection.create(doc, 8));
    expect(positionAfterSelection(state)).toBe(lastDoc.content.size);
  });

  it("returns the gap itself for a gap cursor", () => {
    const state = stateWith(middleDoc, (doc) => new GapCursor(doc.resolve(8)));
    expect(positionAfterSelection(state)).toBe(8);
  });

  it("returns null for Select All, which has no single block to insert after", () => {
    const state = stateWith(middleDoc, (doc) => new AllSelection(doc));
    expect(positionAfterSelection(state)).toBeNull();
  });
});

describe("protectSelectedImage", () => {
  const imageSelected = stateWith(middleDoc, (doc) => NodeSelection.create(doc, 8));
  const cursorInBlock = stateWith(middleDoc, (doc) => TextSelection.create(doc, 3));
  const props = protectSelectedImage.props as {
    handleTextInput: (view: { state: EditorState }) => boolean;
    handlePaste: (view: { state: EditorState }) => boolean;
  };

  it("swallows text input and paste over a selected image", () => {
    expect(isImageSelected(imageSelected)).toBe(true);
    expect(props.handleTextInput({ state: imageSelected })).toBe(true);
    expect(props.handlePaste({ state: imageSelected })).toBe(true);
  });

  it("lets text input and paste through in a Gherkin block", () => {
    expect(isImageSelected(cursorInBlock)).toBe(false);
    expect(props.handleTextInput({ state: cursorInBlock })).toBe(false);
    expect(props.handlePaste({ state: cursorInBlock })).toBe(false);
  });
});

describe("narrowNodeSelection", () => {
  it("turns a NodeSelection on a Gherkin block into a cursor inside it", () => {
    const state = stateWith(middleDoc, (doc) => NodeSelection.create(doc, 9));
    const tr = narrowNodeSelection(state);
    expect(tr).not.toBeNull();
    const selection = tr!.selection;
    expect(selection).toBeInstanceOf(TextSelection);
    expect(selection.empty).toBe(true);
    expect(selection.$from.parent.attrs["data-gherkin-type"]).toBe("and");
  });

  it("keeps a NodeSelection on an image", () => {
    const state = stateWith(middleDoc, (doc) => NodeSelection.create(doc, 8));
    expect(narrowNodeSelection(state)).toBeNull();
  });

  it("leaves a text selection alone", () => {
    const state = stateWith(middleDoc, (doc) => TextSelection.create(doc, 3));
    expect(narrowNodeSelection(state)).toBeNull();
  });

  it("moves a NodeSelection on a data table to the nearest block, not past the table", () => {
    // Then "Before" (0–8), table (8–9), And "After" (9–16)
    const tableDoc = schema.nodes.doc.create(null, [
      block("then", "Before"),
      schema.nodes.gherkin_data_table.create(),
      block("and", "After"),
    ]);
    const state = stateWith(tableDoc, (doc) => NodeSelection.create(doc, 8));
    const selection = narrowNodeSelection(state)!.selection;
    expect(selection).toBeInstanceOf(TextSelection);
    expect(selection.$from.parent.attrs["data-gherkin-type"]).toBe("and");
  });

  describe("plugin", () => {
    const REMOTE = "remote";
    const plugin = narrowNodeSelectionPlugin((tr) => tr.getMeta(REMOTE) === true);
    const state = EditorState.create({ schema, doc: middleDoc, plugins: [plugin] });

    it("narrows a NodeSelection restored by a remote change", () => {
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, 0)).setMeta(REMOTE, true);
      const narrowed = state.apply(tr);
      expect(narrowed.selection).toBeInstanceOf(TextSelection);
      expect(narrowed.selection.$from.parent.attrs["data-gherkin-type"]).toBe("then");
    });

    it("leaves a NodeSelection made locally alone", () => {
      const local = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, 0)));
      expect(local.selection).toBeInstanceOf(NodeSelection);
    });
  });
});
