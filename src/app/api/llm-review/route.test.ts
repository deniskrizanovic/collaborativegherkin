import { describe, it, expect, vi, beforeEach } from "vitest";
import { AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_PROMPT } from "@/lib/llm-constants";

const fakeSessionRecord = {
  id: "session-1",
  title: "Test",
  prompt: null,
  model: null,
  createdAt: new Date(),
  userId: "user-1",
};

vi.mock("@/lib/db", () => ({
  db: { session: {} },
}));

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    Session: vi.fn(),
  };
});

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

import { Session, SessionNotFoundError } from "@/lib/session";
import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";
import { POST } from "./route";

const MockedSession = vi.mocked(Session);
const MockedCoaching = vi.mocked(Coaching);

beforeEach(() => {
  vi.clearAllMocks();
  MockedSession.mockImplementation(function () {
    return { get: vi.fn().mockResolvedValue(fakeSessionRecord) } as any;
  });
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

    const response = await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ result: "some feedback" });
  });

  it("calls reviewGherkin with DEFAULT_PROMPT when session has no prompt", async () => {
    const reviewGherkin = vi.fn().mockResolvedValue("ok");
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));

    expect(reviewGherkin).toHaveBeenCalledWith("Given a step", DEFAULT_PROMPT, DEFAULT_MODEL);
  });

  it("calls reviewGherkin with session prompt and model when set", async () => {
    MockedSession.mockImplementation(function () {
      return {
        get: vi.fn().mockResolvedValue({
          ...fakeSessionRecord,
          prompt: "custom prompt text here ok",
          model: AVAILABLE_MODELS[1],
        }),
      } as any;
    });
    const reviewGherkin = vi.fn().mockResolvedValue("ok");
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));

    expect(reviewGherkin).toHaveBeenCalledWith("Given a step", "custom prompt text here ok", AVAILABLE_MODELS[1]);
  });

  it("returns 400 when content is missing", async () => {
    const response = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when sessionId is missing", async () => {
    const response = await POST(makeRequest({ content: "Given a step" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when session is not found", async () => {
    MockedSession.mockImplementation(function () {
      return {
        get: vi.fn().mockRejectedValue(new SessionNotFoundError("session-1")),
      } as any;
    });

    const response = await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Session not found");
  });

  it("returns 500 with configured message when service throws CoachingConfigError", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new CoachingConfigError("not configured"));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("LLM service not configured");
  });

  it("returns 429 with retry seconds message when RateLimitError has retryAfterSeconds", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new RateLimitError(30));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("30 seconds");
  });

  it("returns 429 with shortly message when RateLimitError has null retryAfterSeconds", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new RateLimitError(null));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("shortly");
  });

  it("returns 502 when service throws CoachingRequestError", async () => {
    const reviewGherkin = vi.fn().mockRejectedValue(new CoachingRequestError("upstream error"));
    MockedCoaching.mockImplementation(function () { return { reviewGherkin } as any; });

    const response = await POST(makeRequest({ content: "Given a step", sessionId: "session-1" }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBeDefined();
  });
});
