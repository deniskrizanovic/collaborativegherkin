import { Node, mergeAttributes } from "@tiptap/core";
import { GherkinBlockType } from "@/lib/gherkin";

export const STEP_TYPES: GherkinBlockType[] = ["given", "when", "then", "and", "but"];

export const GherkinDataTable = Node.create({
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
        return Array.from(dom.querySelectorAll("[data-cell]")) as HTMLElement[];
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

      let focusedRow = 0;
      let focusedCol = 0;

      function buildTable() {
        tbody.innerHTML = "";
        rows.forEach((row, ri) => {
          const tr = document.createElement("tr");
          if (ri === 0) tr.className = "gherkin-table-header-row";
          row.forEach((cell, ci) => {
            const td = document.createElement(ri === 0 ? "th" : "td");
            td.setAttribute("data-cell", `${ri}-${ci}`);
            td.contentEditable = "true";
            td.textContent = cell;
            const isHeader = ri === 0;
            td.style.cssText =
              `border:1px solid #cdd3d6;padding:4px 10px;min-width:60px;outline:none;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${isHeader ? "#002664" : "#22272b"};background:${isHeader ? "rgba(0,38,100,0.06)" : "#ffffff"};font-weight:${isHeader ? "600" : "400"};`;

            td.addEventListener("focus", () => {
              focusedRow = ri;
              focusedCol = ci;
            });

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

      function makeBtn(action: string, title: string, svgPath: string): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = "gherkin-table-toolbar-btn";
        btn.setAttribute("data-action", action);
        btn.title = title;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
        return btn;
      }

      function makeSep(): HTMLDivElement {
        const sep = document.createElement("div");
        sep.className = "gherkin-table-toolbar-sep";
        return sep;
      }

      const toolbar = document.createElement("div");
      toolbar.className = "gherkin-table-toolbar";

      const insertRowAboveBtn = makeBtn(
        "insert-row-above",
        "Insert row above",
        '<line x1="3" y1="8" x2="13" y2="8"/><polyline points="6,5 8,3 10,5"/>'
      );
      const insertRowBelowBtn = makeBtn(
        "insert-row-below",
        "Insert row below",
        '<line x1="3" y1="8" x2="13" y2="8"/><polyline points="6,11 8,13 10,11"/>'
      );
      const deleteRowBtn = makeBtn(
        "delete-row",
        "Delete row",
        '<line x1="3" y1="8" x2="13" y2="8"/><line x1="6" y1="5" x2="10" y2="5"/>'
      );

      toolbar.appendChild(insertRowAboveBtn);
      toolbar.appendChild(insertRowBelowBtn);
      toolbar.appendChild(deleteRowBtn);
      toolbar.appendChild(makeSep());

      const insertColBeforeBtn = makeBtn(
        "insert-col-before",
        "Insert column before",
        '<line x1="8" y1="3" x2="8" y2="13"/><polyline points="5,6 3,8 5,10"/>'
      );
      const insertColAfterBtn = makeBtn(
        "insert-col-after",
        "Insert column after",
        '<line x1="8" y1="3" x2="8" y2="13"/><polyline points="11,6 13,8 11,10"/>'
      );
      const deleteColBtn = makeBtn(
        "delete-col",
        "Delete column",
        '<line x1="8" y1="3" x2="8" y2="13"/><line x1="11" y1="5" x2="11" y2="11"/>'
      );

      toolbar.appendChild(insertColBeforeBtn);
      toolbar.appendChild(insertColAfterBtn);
      toolbar.appendChild(deleteColBtn);
      toolbar.appendChild(makeSep());

      const deleteTableBtn = makeBtn(
        "delete-table",
        "Delete table",
        '<polyline points="3,4 13,4"/><path d="M5,4V3h6v1"/><rect x="4" y="5" width="8" height="8" rx="1"/><line x1="7" y1="7" x2="7" y2="11"/><line x1="9" y1="7" x2="9" y2="11"/>'
      );
      toolbar.appendChild(deleteTableBtn);

      insertRowAboveBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        rows.splice(focusedRow, 0, Array(rows[0].length).fill(""));
        buildTable();
        commitRows();
      });

      insertRowBelowBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        rows.splice(focusedRow + 1, 0, Array(rows[0].length).fill(""));
        buildTable();
        commitRows();
      });

      deleteRowBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (rows.length <= 1) return;
        rows.splice(focusedRow, 1);
        focusedRow = Math.min(focusedRow, rows.length - 1);
        buildTable();
        commitRows();
      });

      insertColBeforeBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        rows = rows.map((r) => { r.splice(focusedCol, 0, ""); return r; });
        buildTable();
        commitRows();
      });

      insertColAfterBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        rows = rows.map((r) => { r.splice(focusedCol + 1, 0, ""); return r; });
        buildTable();
        commitRows();
      });

      deleteColBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const cols = rows[0].length;
        if (cols <= 1) return;
        rows = rows.map((r) => r.filter((_, i) => i !== focusedCol));
        focusedCol = Math.min(focusedCol, cols - 2);
        buildTable();
        commitRows();
      });

      deleteTableBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (typeof getPos !== "function") return;
        const pos = getPos();
        nodeEditor.commands.command(({ tr }) => {
          tr.delete(pos, pos + nodeEditor.state.doc.nodeAt(pos)!.nodeSize);
          return true;
        });
      });

      buildTable();
      table.appendChild(tbody);
      dom.appendChild(toolbar);
      dom.appendChild(table);

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
