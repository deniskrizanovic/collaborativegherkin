// @vitest-environment jsdom

import type { Editor } from "@tiptap/react";
import * as encoding from "lib0/encoding";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import GherkinEditor from "./GherkinEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does no layout and has no Range rects; ProseMirror asks for caret
// coordinates when "/" opens the picker.
Range.prototype.getClientRects ??= () =>
  Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

/**
 * Stand-in for the browser WebSocket that y-websocket opens. The test plays the
 * sync server: `open()` connects, `syncEmptyDoc()` answers with an empty
 * document (so the editor seeds its starter blocks), `close()` drops the line.
 */
class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readonly OPEN = 1;
  readyState = 0;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: ArrayBuffer }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send() {}

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  syncEmptyDoc() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // y-websocket messageSync
    syncProtocol.writeSyncStep2(encoder, new Y.Doc());
    const bytes = encoding.toUint8Array(encoder);
    this.onmessage?.({
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
  }

  static latest(): FakeWebSocket {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderEditor({ wsUrl }: { wsUrl?: string } = { wsUrl: "ws://sync.test" }) {
  await act(async () => {
    root.render(<GherkinEditor sessionId="s1" wsUrl={wsUrl} />);
  });
  await flush();
}

/** Connect, sync an empty doc so the editor seeds its five starter blocks, and return the editor. */
async function renderSeededEditor(): Promise<Editor> {
  await renderEditor();
  await act(async () => {
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().syncEmptyDoc();
  });
  await flush();
  return editorInstance();
}

function editorInstance(): Editor {
  const dom = container.querySelector(".ProseMirror") as (HTMLElement & { editor?: Editor }) | null;
  if (!dom?.editor) throw new Error("editor not mounted");
  return dom.editor;
}

/** Each top-level block as its Gherkin type, or its node name for tables and images. */
function blockTypes(editor: Editor): string[] {
  const types: string[] = [];
  editor.state.doc.forEach((node) => {
    types.push(node.type.name === "paragraph" ? node.attrs["data-gherkin-type"] : node.type.name);
  });
  return types;
}

/** Put the caret inside the `index`-th top-level block. */
async function placeCaretIn(editor: Editor, index: number) {
  let pos = 0;
  editor.state.doc.forEach((_node, offset, i) => {
    if (i === index) pos = offset + 1;
  });
  await act(async () => {
    editor.commands.setTextSelection(pos);
  });
  await flush();
}

async function pressInEditor(editor: Editor, key: string) {
  await act(async () => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });
}

async function pressOnDocument(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

async function mouseDown(selector: string, label?: string) {
  const el = [...container.querySelectorAll<HTMLElement>(selector)].find(
    (b) => label === undefined || b.textContent === label,
  );
  if (!el) throw new Error(`no ${selector} ${label ?? ""}`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  });
}

async function click(selector: string) {
  const el = container.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no ${selector}`);
  await act(async () => {
    el.click();
  });
}

/** Set a React-controlled textarea's value the way typing would. */
async function typeInto(selector: string, value: string) {
  const el = container.querySelector<HTMLTextAreaElement>(selector);
  if (!el) throw new Error(`no ${selector}`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Open the block picker as typing "/" does: the keydown, then the inserted character. */
async function openPicker(editor: Editor) {
  await pressInEditor(editor, "/");
  await act(async () => {
    editor.commands.insertContent("/");
  });
  await flush();
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GherkinEditor connection banner", () => {
  it("shows connecting until the sync socket opens, then hides", async () => {
    await renderEditor();
    expect(container.querySelector(".gherkin-conn-banner--connecting")?.textContent).toBe(
      "Connecting to sync server…",
    );
    await act(async () => {
      FakeWebSocket.latest().open();
    });
    expect(container.querySelector(".gherkin-conn-banner")).toBeNull();
  });

  it("warns that changes are local only once the socket drops", async () => {
    await renderEditor();
    await act(async () => {
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().close();
    });
    expect(container.querySelector(".gherkin-conn-banner--disconnected")?.textContent).toContain(
      "changes are local only",
    );
  });

  it("connects to the page's own origin when no sync URL is given", async () => {
    await renderEditor({});
    expect(FakeWebSocket.latest().url).toMatch(/^ws:\/\/localhost:3000\/session-s1/);
  });
});

describe("GherkinEditor seeding and toolbar", () => {
  it("seeds an empty synced document with the starter blocks", async () => {
    const editor = await renderSeededEditor();
    expect(blockTypes(editor)).toEqual(["feature", "scenario", "given", "when", "then"]);
  });

  it("offers Table and Image only after a step, and inserts a table from the toolbar", async () => {
    const editor = await renderSeededEditor();
    const labels = () =>
      [...container.querySelectorAll(".gherkin-toolbar-btn")].map((b) => b.textContent);
    expect(labels()).not.toContain("Table");

    await placeCaretIn(editor, 2); // given
    expect(labels()).toEqual(expect.arrayContaining(["Table", "Image"]));

    await mouseDown(".gherkin-toolbar-btn", "Table");
    expect(blockTypes(editor)).toEqual([
      "feature",
      "scenario",
      "given",
      "gherkin_data_table",
      "when",
      "then",
    ]);
  });

  it("inserts a block of the clicked toolbar type after the caret's block", async () => {
    const editor = await renderSeededEditor();
    await placeCaretIn(editor, 4); // then
    await mouseDown(".gherkin-toolbar-btn", "And");
    expect(blockTypes(editor)).toEqual(["feature", "scenario", "given", "when", "then", "and"]);
  });
});

describe("GherkinEditor import", () => {
  it("inserts parsed keyword lines and tables after the caret's block", async () => {
    const editor = await renderSeededEditor();
    await placeCaretIn(editor, 4); // then
    await mouseDown(".gherkin-import-btn");
    await typeInto(".gherkin-import-textarea", "And another check\n| a | b |\n| 1 | 2 |");
    await click(".gherkin-import-confirm");

    expect(container.querySelector(".gherkin-import-modal")).toBeNull();
    expect(blockTypes(editor)).toEqual([
      "feature",
      "scenario",
      "given",
      "when",
      "then",
      "and",
      "gherkin_data_table",
    ]);
    expect(editor.state.doc.child(5).textContent).toBe("another check");
  });

  it("closes without changes when the text has no Gherkin in it", async () => {
    const editor = await renderSeededEditor();
    await mouseDown(".gherkin-import-btn");
    await typeInto(".gherkin-import-textarea", "just notes");
    await click(".gherkin-import-confirm");

    expect(container.querySelector(".gherkin-import-modal")).toBeNull();
    expect(blockTypes(editor)).toHaveLength(5);
  });

  it("cancel closes the dialog", async () => {
    await renderSeededEditor();
    await mouseDown(".gherkin-import-btn");
    await click(".gherkin-import-cancel");
    expect(container.querySelector(".gherkin-import-modal")).toBeNull();
  });
});

describe("GherkinEditor keyboard", () => {
  it("Enter adds the block that follows the current one", async () => {
    const editor = await renderSeededEditor();
    await placeCaretIn(editor, 0); // feature
    await pressInEditor(editor, "Enter");
    expect(blockTypes(editor)).toEqual([
      "feature",
      "scenario",
      "scenario",
      "given",
      "when",
      "then",
    ]);

    await placeCaretIn(editor, 5); // then
    await pressInEditor(editor, "Enter");
    expect(blockTypes(editor).slice(-2)).toEqual(["then", "and"]);
  });

  it("other keys are left to the editor", async () => {
    const editor = await renderSeededEditor();
    await pressInEditor(editor, "a");
    expect(blockTypes(editor)).toHaveLength(5);
    expect(container.querySelector(".block-picker")).toBeNull();
  });

  it('"/" opens the picker; arrows move the highlight and Enter retypes the block', async () => {
    const editor = await renderSeededEditor();
    await placeCaretIn(editor, 3); // when, after given
    await openPicker(editor);

    const active = () => container.querySelector(".block-picker-item--active")?.textContent;
    const first = active();
    await pressOnDocument("ArrowDown");
    expect(active()).not.toBe(first);
    await pressOnDocument("ArrowUp");
    expect(active()).toBe(first);

    await pressOnDocument("Enter");
    expect(container.querySelector(".block-picker")).toBeNull();
    expect(blockTypes(editor)[3]).toBe(first?.toLowerCase());
    expect(editor.state.doc.child(3).textContent).toBe("");
  });

  it("picking Image from the picker opens the file dialog", async () => {
    const editor = await renderSeededEditor();
    const fileDialog = vi.fn();
    container.querySelector('input[type="file"]')?.addEventListener("click", fileDialog);
    await placeCaretIn(editor, 3); // when
    await openPicker(editor);

    await pressOnDocument("ArrowUp"); // wraps to the last option, Image
    expect(container.querySelector(".block-picker-item--active")?.textContent).toBe("Image");
    await pressOnDocument("Enter");
    expect(fileDialog).toHaveBeenCalledOnce();
  });

  it("Escape closes the picker without changing the document", async () => {
    const editor = await renderSeededEditor();
    await placeCaretIn(editor, 2);
    await openPicker(editor);
    expect(container.querySelector(".block-picker")).not.toBeNull();

    await pressOnDocument("Escape");
    expect(container.querySelector(".block-picker")).toBeNull();
    expect(blockTypes(editor)).toHaveLength(5);
  });
});
