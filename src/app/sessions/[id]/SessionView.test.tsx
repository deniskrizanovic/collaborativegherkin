// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/llm-constants";
import SessionView from "./SessionView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The embedded editor opens a sync socket; this one never connects. */
class SilentWebSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 0;
  binaryType = "blob";
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  send() {}
  close() {}
}

type Reply = { ok: boolean; body?: unknown } | Error;
type Route = (url: string, init?: RequestInit) => Reply;

/** A `fetch` that answers from `route` and records every request. */
function fakeFetch(route: Route) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const reply = route(url, init);
    if (reply instanceof Error) throw reply;
    return { ok: reply.ok, json: async () => reply.body } as Response;
  });
}

const settings = (
  body: unknown = { model: AVAILABLE_MODELS[1], prompt: "Saved prompt text" },
): Reply => ({
  ok: true,
  body,
});

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderView(route: Route) {
  const fetch = fakeFetch(route);
  vi.stubGlobal("fetch", fetch);
  await act(async () => {
    root.render(<SessionView sessionId="s1" title="Checkout" />);
  });
  await flush();
  return fetch;
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  container.querySelector<T>(selector);

async function click(selector: string) {
  const el = $(selector);
  if (!el) throw new Error(`no ${selector}`);
  await act(async () => {
    el.click();
  });
  await flush();
}

async function mouseDown(selector: string) {
  const el = $(selector);
  if (!el) throw new Error(`no ${selector}`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

async function pressEscape() {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

/** Set a React-controlled form field's value the way user input would. */
async function setValue(selector: string, value: string) {
  const el = $<HTMLTextAreaElement | HTMLSelectElement>(selector);
  if (!el) throw new Error(`no ${selector}`);
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
  await flush();
}

const isPatch = (init?: RequestInit) => init?.method === "PATCH";
const isReview = (url: string) => url === "/api/llm-review";

beforeEach(() => {
  vi.stubGlobal("WebSocket", SilentWebSocket);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("SessionView settings", () => {
  it("loads the session's model and prompt, then enables the controls", async () => {
    const fetch = await renderView(() => settings());
    expect(fetch).toHaveBeenCalledWith("/api/sessions/s1");
    expect($<HTMLSelectElement>(".session-model-select")?.value).toBe(AVAILABLE_MODELS[1]);
    expect($<HTMLButtonElement>(".session-edit-prompt-btn")?.disabled).toBe(false);
    expect($(".form-error")).toBeNull();

    await click(".session-edit-prompt-btn");
    expect($<HTMLTextAreaElement>(".session-prompt-textarea")?.value).toBe("Saved prompt text");
  });

  it("falls back to the default model when the session has none", async () => {
    await renderView(() => settings({ model: null, prompt: null }));
    expect($<HTMLSelectElement>(".session-model-select")?.value).toBe(DEFAULT_MODEL);
  });

  it.each([
    ["an error status", { ok: false }],
    ["a network failure", new Error("offline")],
  ] as [string, Reply][])("reports %s and still enables the controls", async (_, reply) => {
    await renderView(() => reply);
    expect($(".form-error")?.textContent).toBe("Couldn't load this session's AI settings.");
    expect($<HTMLButtonElement>(".session-edit-prompt-btn")?.disabled).toBe(false);
  });

  it("saves a new model, and restores the old one if the save fails", async () => {
    let saveOk = true;
    const fetch = await renderView((_, init) => (isPatch(init) ? { ok: saveOk } : settings()));

    await setValue(".session-model-select", AVAILABLE_MODELS[2]);
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/sessions/s1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ model: AVAILABLE_MODELS[2] }),
      }),
    );
    expect($<HTMLSelectElement>(".session-model-select")?.value).toBe(AVAILABLE_MODELS[2]);

    saveOk = false;
    await setValue(".session-model-select", AVAILABLE_MODELS[3]);
    expect($<HTMLSelectElement>(".session-model-select")?.value).toBe(AVAILABLE_MODELS[2]);
    expect($(".form-error")?.textContent).toBe("Couldn't save the selected model.");
  });
});

describe("SessionView prompt dialog", () => {
  it("saves an edited prompt and closes", async () => {
    const fetch = await renderView((_, init) => (isPatch(init) ? { ok: true } : settings()));
    await click(".session-edit-prompt-btn");
    await setValue(".session-prompt-textarea", "short");
    expect($<HTMLButtonElement>(".session-prompt-save")?.disabled).toBe(true);

    await setValue(".session-prompt-textarea", "A longer review prompt");
    await click(".session-prompt-save");
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/sessions/s1",
      expect.objectContaining({ body: JSON.stringify({ prompt: "A longer review prompt" }) }),
    );
    expect($(".session-prompt-modal")).toBeNull();
  });

  it("stays open and reports an error when the save fails", async () => {
    await renderView((_, init) => (isPatch(init) ? { ok: false } : settings()));
    await click(".session-edit-prompt-btn");
    await click(".session-prompt-save");
    expect($(".session-prompt-modal")).not.toBeNull();
    expect($(".form-error")?.textContent).toBe("Couldn't save the prompt.");
  });

  it("closes on Cancel, Escape, or a click on the backdrop", async () => {
    await renderView(() => settings());
    await click(".session-edit-prompt-btn");
    await mouseDown(".session-prompt-modal-inner");
    expect($(".session-prompt-modal")).not.toBeNull();
    await click(".session-prompt-cancel");
    expect($(".session-prompt-modal")).toBeNull();

    await click(".session-edit-prompt-btn");
    await pressEscape();
    expect($(".session-prompt-modal")).toBeNull();

    await click(".session-edit-prompt-btn");
    await mouseDown(".session-prompt-modal");
    expect($(".session-prompt-modal")).toBeNull();
  });
});

describe("SessionView AI review", () => {
  it("sends the editor content for review and shows the result", async () => {
    const fetch = await renderView((url) =>
      isReview(url) ? { ok: true, body: { result: "**Looks good**" } } : settings(),
    );
    await click(".session-review-btn");

    const [, init] = fetch.mock.calls.find(([url]) => isReview(url)) ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sessionId: "s1",
      content: expect.any(String),
    });
    expect($(".session-review-modal-title")?.textContent).toBe(
      `AI Review — ${AVAILABLE_MODELS[1]}`,
    );
    expect($(".session-review-modal-body strong")?.textContent).toBe("Looks good");
    expect($<HTMLButtonElement>(".session-review-btn")?.textContent).toBe("Get AI Coaching");
  });

  it.each([
    ["the service's error message", { ok: false, body: { error: "Rate limited" } }, "Rate limited"],
    ["a placeholder for an empty reply", { ok: true, body: {} }, "No response received."],
    [
      "a retry hint when the service is unreachable",
      new Error("offline"),
      "Failed to reach the review service.",
    ],
  ] as [string, Reply, string][])("shows %s", async (_, reply, text) => {
    await renderView((url) => (isReview(url) ? reply : settings()));
    await click(".session-review-btn");
    expect($(".session-review-modal-body")?.textContent).toContain(text);
  });

  it("closes the review with ✕, Escape or the backdrop, and reopens it from View last review", async () => {
    await renderView((url) =>
      isReview(url) ? { ok: true, body: { result: "Fine" } } : settings(),
    );
    expect($(".session-view-last-review-btn")).toBeNull();
    await click(".session-review-btn");

    await mouseDown(".session-review-modal-inner");
    expect($(".session-review-modal")).not.toBeNull();
    await click(".session-review-modal-close");
    expect($(".session-review-modal")).toBeNull();

    await click(".session-view-last-review-btn");
    await pressEscape();
    expect($(".session-review-modal")).toBeNull();

    await click(".session-view-last-review-btn");
    await mouseDown(".session-review-modal");
    expect($(".session-review-modal")).toBeNull();
  });
});

describe("SessionView invite link", () => {
  it("copies the page URL and confirms it", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderView(() => settings());

    await click(".copy-link-btn");
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect($(".copy-link-btn")?.textContent).toBe("Copied!");
    expect($(".copy-link-btn")?.className).toContain("copied");
    Reflect.deleteProperty(navigator, "clipboard");
  });
});
