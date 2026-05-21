// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { GherkinDataTable } from "./GherkinDataTable";

function makeNodeView(initialRows: string[][] = [["a", "b"], ["c", "d"]]) {
  const committedRows: { value: string } = { value: JSON.stringify(initialRows) };
  const trMock = { setNodeMarkup: vi.fn(), delete: vi.fn() };
  const editorMock = {
    commands: {
      command: vi.fn((fn: (arg: { tr: typeof trMock }) => boolean) => fn({ tr: trMock })),
    },
    state: {
      doc: {
        nodeAt: vi.fn(() => ({ nodeSize: 4 })),
      },
    },
  };
  const getPos = vi.fn(() => 5);

  const node = {
    attrs: { rows: committedRows.value },
    type: { name: "gherkin_data_table" },
  };

  // Access the addNodeView factory from the extension spec
  const ext = GherkinDataTable as unknown as {
    config: { addNodeView: () => (args: unknown) => unknown };
  };
  const factory = ext.config.addNodeView();
  const view = factory({ node, getPos, editor: editorMock }) as {
    dom: HTMLElement;
    update: (n: typeof node) => boolean;
    stopEvent: () => boolean;
    ignoreMutation: () => boolean;
  };

  function getBtn(action: string): HTMLElement {
    return view.dom.querySelector(`[data-action="${action}"]`) as HTMLElement;
  }

  function fireMousedown(btn: HTMLElement) {
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);
  }

  function getCommittedRows(): string[][] {
    const call = trMock.setNodeMarkup.mock.calls.at(-1);
    return call ? JSON.parse(call[2].rows) : initialRows;
  }

  return { view, getBtn, fireMousedown, getCommittedRows, trMock, editorMock, getPos };
}

describe("GherkinDataTable node view", () => {
  describe("insert row above", () => {
    it("inserts a blank row before the focused row", () => {
      const { getBtn, fireMousedown, getCommittedRows } = makeNodeView([["h1", "h2"], ["r1", "r2"]]);
      fireMousedown(getBtn("insert-row-above"));
      const rows = getCommittedRows();
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(["", ""]);
      expect(rows[1]).toEqual(["h1", "h2"]);
    });
  });

  describe("insert row below", () => {
    it("inserts a blank row after the focused row", () => {
      const { getBtn, fireMousedown, getCommittedRows } = makeNodeView([["h1", "h2"], ["r1", "r2"]]);
      fireMousedown(getBtn("insert-row-below"));
      const rows = getCommittedRows();
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(["h1", "h2"]);
      expect(rows[1]).toEqual(["", ""]);
      expect(rows[2]).toEqual(["r1", "r2"]);
    });
  });

  describe("delete row", () => {
    it("removes the focused row", () => {
      const { view, getBtn, fireMousedown, getCommittedRows } = makeNodeView([["h1", "h2"], ["r1", "r2"], ["r3", "r4"]]);
      // focus row 1 by simulating a focus event on the cell
      const cell = view.dom.querySelector("[data-cell='1-0']") as HTMLElement;
      cell.dispatchEvent(new FocusEvent("focus"));
      fireMousedown(getBtn("delete-row"));
      const rows = getCommittedRows();
      expect(rows).toHaveLength(2);
      expect(rows[1]).toEqual(["r3", "r4"]);
    });

    it("does nothing when only one row remains", () => {
      const { getBtn, fireMousedown, trMock } = makeNodeView([["h1", "h2"]]);
      fireMousedown(getBtn("delete-row"));
      expect(trMock.setNodeMarkup).not.toHaveBeenCalled();
    });
  });

  describe("insert col before", () => {
    it("inserts a blank column before the focused column", () => {
      const { getBtn, fireMousedown, getCommittedRows } = makeNodeView([["h1", "h2"], ["r1", "r2"]]);
      fireMousedown(getBtn("insert-col-before"));
      const rows = getCommittedRows();
      expect(rows[0]).toEqual(["", "h1", "h2"]);
      expect(rows[1]).toEqual(["", "r1", "r2"]);
    });
  });

  describe("insert col after", () => {
    it("inserts a blank column after the focused column", () => {
      const { getBtn, fireMousedown, getCommittedRows } = makeNodeView([["h1", "h2"], ["r1", "r2"]]);
      fireMousedown(getBtn("insert-col-after"));
      const rows = getCommittedRows();
      expect(rows[0]).toEqual(["h1", "", "h2"]);
      expect(rows[1]).toEqual(["r1", "", "r2"]);
    });
  });

  describe("delete col", () => {
    it("removes the focused column", () => {
      const { view, getBtn, fireMousedown, getCommittedRows } = makeNodeView([["h1", "h2", "h3"], ["r1", "r2", "r3"]]);
      const cell = view.dom.querySelector("[data-cell='0-1']") as HTMLElement;
      cell.dispatchEvent(new FocusEvent("focus"));
      fireMousedown(getBtn("delete-col"));
      const rows = getCommittedRows();
      expect(rows[0]).toEqual(["h1", "h3"]);
      expect(rows[1]).toEqual(["r1", "r3"]);
    });

    it("does nothing when only one column remains", () => {
      const { getBtn, fireMousedown, trMock } = makeNodeView([["h1"], ["r1"]]);
      fireMousedown(getBtn("delete-col"));
      expect(trMock.setNodeMarkup).not.toHaveBeenCalled();
    });
  });

  describe("delete table", () => {
    it("calls tr.delete with the node's position and size", () => {
      const { getBtn, fireMousedown, trMock } = makeNodeView();
      fireMousedown(getBtn("delete-table"));
      expect(trMock.delete).toHaveBeenCalledWith(5, 9); // pos=5, nodeSize=4
    });
  });

  describe("update()", () => {
    it("rebuilds the table when rows attribute changes", () => {
      const { view } = makeNodeView([["a", "b"]]);
      const newRows = [["x", "y"], ["p", "q"]];
      const result = view.update({
        attrs: { rows: JSON.stringify(newRows) },
        type: { name: "gherkin_data_table" },
      });
      expect(result).toBe(true);
      const cells = view.dom.querySelectorAll("[data-cell]");
      expect(cells).toHaveLength(4);
      expect(cells[0].textContent).toBe("x");
    });

    it("returns false for a different node type", () => {
      const { view } = makeNodeView();
      const result = view.update({
        attrs: { rows: JSON.stringify([["a"]]) },
        type: { name: "paragraph" },
      });
      expect(result).toBe(false);
    });
  });

  describe("stopEvent / ignoreMutation", () => {
    it("always returns true", () => {
      const { view } = makeNodeView();
      expect(view.stopEvent()).toBe(true);
      expect(view.ignoreMutation()).toBe(true);
    });
  });
});
