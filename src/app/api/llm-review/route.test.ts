import { describe, it, expect, vi, beforeEach } from "vitest";
import { AVAILABLE_MODELS } from "@/lib/llm-constants";

vi.mock("@/lib/db", () => ({
  db: { appSetting: {} },
}));

vi.mock("@/lib/coaching", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/coaching")>();
  return {
    ...actual,
    Coaching: vi.fn(),
  };
});

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn() },
}));

import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";
import { POST } from "./route";

const MockedCoaching = vi.mocked(Coaching);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/llm-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/llm-review", () => {
  it("returns 200 with result for valid body", async () => {
    const reviewGherkin = vi.fn().mockResolvedValue("some feedback");
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", model: AVAILABLE_MODELS[0] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ result: "some feedback" });
  });

  it("returns 400 when content is missing", async () => {
    const reviewGherkin = vi.fn();
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ model: AVAILABLE_MODELS[0] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 500 with configured message when service throws CoachingConfigError", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new CoachingConfigError("not configured"));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", model: AVAILABLE_MODELS[0] }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("LLM service not configured");
  });

  it("returns 429 with retry seconds message when RateLimitError has retryAfterSeconds", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new RateLimitError(30));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", model: AVAILABLE_MODELS[0] }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("30 seconds");
  });

  it("returns 429 with shortly message when RateLimitError has null retryAfterSeconds", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new RateLimitError(null));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", model: AVAILABLE_MODELS[0] }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("shortly");
  });

  it("returns 502 when service throws CoachingRequestError", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new CoachingRequestError("upstream error"));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", model: AVAILABLE_MODELS[0] }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBeDefined();
  });
});
