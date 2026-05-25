import { describe, it, expect, vi, beforeEach } from "vitest";
import { AVAILABLE_MODELS } from "@/lib/llm-constants";

vi.mock("@/lib/db", () => ({
  db: { appSetting: {} },
}));

vi.mock("@/lib/coaching", () => ({
  Coaching: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn() },
}));

import { Coaching } from "@/lib/coaching";
import { GET, PUT } from "./route";

const MockedCoaching = vi.mocked(Coaching);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/llm-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/llm-settings", () => {
  it("returns 200 with settings shape", async () => {
    const getSettings = vi.fn().mockResolvedValue({
      prompt: "test prompt",
      model: AVAILABLE_MODELS[0],
      availableModels: [...AVAILABLE_MODELS],
    });
    MockedCoaching.mockImplementation(function () { return { getSettings } as any; });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.prompt).toBe("string");
    expect(typeof body.model).toBe("string");
    expect(Array.isArray(body.availableModels)).toBe(true);
  });
});

describe("PUT /api/llm-settings", () => {
  it("returns 200 with { ok: true } for valid body", async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    MockedCoaching.mockImplementation(function () { return { updateSettings } as any; });

    const response = await PUT(makeRequest({ prompt: "a long enough prompt here" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("returns 400 when model is not in AVAILABLE_MODELS", async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    MockedCoaching.mockImplementation(function () { return { updateSettings } as any; });

    const response = await PUT(makeRequest({ model: "not-a-real-model" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});
