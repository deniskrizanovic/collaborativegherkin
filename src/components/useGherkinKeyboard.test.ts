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
import {
  BlockRect,
  atomInsertTransaction,
  blockIndexAtY,
  positionAfterBlockAtY,
  positionAfterSelection,
  slashAtomInsertTransaction,
} from "./useGherkinKeyboard";

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

function table(): PMNode {
  return schema.nodes.gherkin_data_table.create({ rows: JSON.stringify([["", ""], ["", ""]]) });
}

describe("atomInsertTransaction", () => {
  it("returns the position where the table node now sits", () => {
    const state = EditorState.create({ schema, doc: middleDoc });
    const { tr, insertPos } = atomInsertTransaction(state, table(), 8);
    expect(insertPos).toBe(8);
    expect(tr.doc.nodeAt(insertPos)?.type.name).toBe("gherkin_data_table");
  });

  it("moves a position inside a block to after that block and returns that", () => {
    const state = EditorState.create({ schema, doc: middleDoc });
    // 3 is inside Then "Before" (0–8)
    const { tr, insertPos } = atomInsertTransaction(state, table(), 3);
    expect(insertPos).toBe(8);
    expect(tr.doc.nodeAt(insertPos)?.type.name).toBe("gherkin_data_table");
  });

  it("clamps a position past the end and returns the end of the document", () => {
    const state = EditorState.create({ schema, doc: lastDoc });
    const { tr, insertPos } = atomInsertTransaction(state, table(), lastDoc.content.size + 5);
    expect(insertPos).toBe(lastDoc.content.size);
    expect(tr.doc.nodeAt(insertPos)?.type.name).toBe("gherkin_data_table");
  });
});

describe("slashAtomInsertTransaction", () => {
  // When "Step/" (0–7), And "After" (7–14); cursor after the slash at 6
  const slashDoc = schema.nodes.doc.create(null, [block("when", "Step/"), block("and", "After")]);

  it("removes the slash and inserts the table in one transaction", () => {
    const state = stateWith(slashDoc, (doc) => TextSelection.create(doc, 6));
    const { tr, insertPos } = slashAtomInsertTransaction(state, table(), true)!;
    expect(tr.doc.child(0).textContent).toBe("Step");
    expect(insertPos).toBe(6);
    expect(tr.doc.nodeAt(insertPos)?.type.name).toBe("gherkin_data_table");
    expect(tr.doc.child(2).textContent).toBe("After");
  });

  it("keeps the character before the cursor when it is not a slash", () => {
    const state = stateWith(slashDoc, (doc) => TextSelection.create(doc, 5));
    const { tr, insertPos } = slashAtomInsertTransaction(state, table(), true)!;
    expect(tr.doc.child(0).textContent).toBe("Step/");
    expect(tr.doc.nodeAt(insertPos)?.type.name).toBe("gherkin_data_table");
  });

  it("keeps the slash when deleteSlash is not set", () => {
    const state = stateWith(slashDoc, (doc) => TextSelection.create(doc, 6));
    const { tr, insertPos } = slashAtomInsertTransaction(state, table(), false)!;
    expect(tr.doc.child(0).textContent).toBe("Step/");
    expect(insertPos).toBe(7);
  });

  it("returns null and changes nothing for Select All", () => {
    const state = stateWith(slashDoc, (doc) => new AllSelection(doc));
    expect(slashAtomInsertTransaction(state, table(), true)).toBeNull();
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

describe("blockIndexAtY", () => {
  // Blocks at 100–130, 140–170, 180–210 (only tops matter).
  const tops = [100, 140, 180];

  it("picks the block under the point", () => {
    expect(blockIndexAtY(tops, 155)).toBe(1);
  });

  it("picks the upper block in the gap between two blocks", () => {
    expect(blockIndexAtY(tops, 135)).toBe(0);
  });

  it("picks the upper block in the gap even when the point is nearer the lower block", () => {
    expect(blockIndexAtY(tops, 139)).toBe(0);
  });

  it("picks the last block below every block", () => {
    expect(blockIndexAtY(tops, 500)).toBe(2);
  });

  it("picks the first block above every block", () => {
    expect(blockIndexAtY(tops, 20)).toBe(0);
  });

  it("picks the block whose top is exactly at the point", () => {
    expect(blockIndexAtY(tops, 140)).toBe(1);
  });

  it("returns 0 when there are no blocks", () => {
    expect(blockIndexAtY([], 100)).toBe(0);
  });
});

describe("positionAfterBlockAtY", () => {
  // Then "Before" (0–8), image (8–9), And "After" (9–16)
  const rects: Record<number, BlockRect | null> = {
    0: { top: 100, width: 600, height: 30 },
    8: { top: 140, width: 600, height: 200 },
    9: { top: 350, width: 600, height: 30 },
  };
  const rectOf = (overrides: Record<number, BlockRect | null> = {}) =>
    (offset: number) => (offset in overrides ? overrides[offset] : rects[offset]);

  it("returns the position after the block under the point", () => {
    expect(positionAfterBlockAtY(middleDoc, rectOf(), 200)).toBe(9);
  });

  it("returns the end of the document below the last block", () => {
    expect(positionAfterBlockAtY(middleDoc, rectOf(), 900)).toBe(16);
  });

  it("returns the position after the first block above every block", () => {
    expect(positionAfterBlockAtY(middleDoc, rectOf(), 0)).toBe(8);
  });

  it("skips a block with no DOM", () => {
    expect(positionAfterBlockAtY(middleDoc, rectOf({ 8: null }), 120)).toBe(8);
  });

  it("skips a zero-size block, whose top of 0 would otherwise sit above Then", () => {
    expect(positionAfterBlockAtY(middleDoc, rectOf({ 8: { top: 0, width: 0, height: 0 } }), 120)).toBe(8);
  });

  it("returns the end of the document when no block is rendered", () => {
    expect(positionAfterBlockAtY(lastDoc, () => null, 50)).toBe(9);
  });

  it("returns 0 for an empty document", () => {
    expect(positionAfterBlockAtY(schema.nodes.doc.create(null, []), rectOf(), 100)).toBe(0);
  });
});
