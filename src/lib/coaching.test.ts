import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";
import { AVAILABLE_MODELS, DEFAULT_PROMPT } from "@/lib/llm-constants";

function makeResponse(
  ok: boolean,
  status: number,
  body: unknown
): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(typeof body === "string" ? JSON.parse(body) : body),
  } as unknown as Response;
}

describe("Coaching", () => {
  const fakeFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reviewGherkin", () => {
    it("returns the model response on success", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "Looks good!" } }],
        })
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      const result = await coaching.reviewGherkin("Given a step", "custom prompt", AVAILABLE_MODELS[0]);
      expect(result).toBe("Looks good!");
    });

    it("sends the provided prompt in the system message", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "ok" } }],
        })
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      await coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0]);

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body as string);
      expect(body.messages[0].content).toBe(DEFAULT_PROMPT);
    });

    it("sends allow_fallbacks: true in the provider field", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "ok" } }],
        })
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      await coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0]);

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body as string);
      expect(body.provider).toEqual({ allow_fallbacks: true });
    });

    it("throws CoachingConfigError when apiKey is undefined", async () => {
      const coaching = new Coaching({ fetch: fakeFetch, apiKey: undefined });

      await expect(
        coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0])
      ).rejects.toBeInstanceOf(CoachingConfigError);
      expect(fakeFetch).not.toHaveBeenCalled();
    });

    it("throws RateLimitError with retryAfterSeconds when 429 includes metadata", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(false, 429, {
          error: { metadata: { retry_after_seconds: 42 } },
        })
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      const err = await coaching
        .reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0])
        .catch((e) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBe(42);
    });

    it("throws RateLimitError with null retryAfterSeconds when 429 has no metadata", async () => {
      fakeFetch.mockResolvedValue(makeResponse(false, 429, "rate limited"));

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      const err = await coaching
        .reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0])
        .catch((e) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBeNull();
    });

    it("throws CoachingRequestError on non-429 failure", async () => {
      fakeFetch.mockResolvedValue(makeResponse(false, 503, "service unavailable"));

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      await expect(
        coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0])
      ).rejects.toBeInstanceOf(CoachingRequestError);
    });
  });
});
