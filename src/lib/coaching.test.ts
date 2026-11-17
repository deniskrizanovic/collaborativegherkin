import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";
import { AVAILABLE_MODELS, DEFAULT_PROMPT } from "@/lib/llm-constants";

function makeResponse(ok: boolean, status: number, body: unknown): Response {
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
        }),
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      const result = await coaching.reviewGherkin(
        "Given a step",
        "custom prompt",
        AVAILABLE_MODELS[0],
      );
      expect(result).toBe("Looks good!");
    });

    it("sends the provided prompt in the system message", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "ok" } }],
        }),
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
        }),
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      await coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0]);

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body as string);
      expect(body.provider).toEqual({ allow_fallbacks: true });
    });

    it("posts JSON to the OpenRouter chat completions endpoint with the API key", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "ok" } }],
        }),
      );

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      await coaching.reviewGherkin("Given a step", "custom prompt", AVAILABLE_MODELS[0]);

      const [url, init] = fakeFetch.mock.calls[0];
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer key",
      });
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe(AVAILABLE_MODELS[0]);
      expect(body.messages).toEqual([
        { role: "system", content: "custom prompt" },
        { role: "user", content: "Given a step" },
      ]);
    });

    it("throws CoachingConfigError when apiKey is undefined", async () => {
      const coaching = new Coaching({ fetch: fakeFetch, apiKey: undefined });

      await expect(
        coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0]),
      ).rejects.toBeInstanceOf(CoachingConfigError);
      expect(fakeFetch).not.toHaveBeenCalled();
    });

    it("throws RateLimitError with retryAfterSeconds when 429 includes metadata", async () => {
      fakeFetch.mockResolvedValue(
        makeResponse(false, 429, {
          error: { metadata: { retry_after_seconds: 42 } },
        }),
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

    it.each([
      ["no metadata", { error: {} }],
      ["no retry_after_seconds", { error: { metadata: {} } }],
      ["no error", {}],
    ])(
      "throws RateLimitError with null retryAfterSeconds when the 429 body has %s",
      async (_, body) => {
        fakeFetch.mockResolvedValue(makeResponse(false, 429, body));

        const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
        const err = await coaching
          .reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0])
          .catch((e) => e);
        expect(err).toBeInstanceOf(RateLimitError);
        expect((err as RateLimitError).retryAfterSeconds).toBeNull();
      },
    );

    it.each([
      ["no choices", {}],
      ["an empty choices array", { choices: [] }],
      ["a choice with no message", { choices: [{}] }],
      ["a message with no content", { choices: [{ message: {} }] }],
    ])("returns an empty string when the response has %s", async (_, body) => {
      fakeFetch.mockResolvedValue(makeResponse(true, 200, body));

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      const result = await coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0]);
      expect(result).toBe("");
    });

    it("throws CoachingRequestError on non-429 failure", async () => {
      fakeFetch.mockResolvedValue(makeResponse(false, 503, "service unavailable"));

      const coaching = new Coaching({ fetch: fakeFetch, apiKey: "key" });
      await expect(
        coaching.reviewGherkin("content", DEFAULT_PROMPT, AVAILABLE_MODELS[0]),
      ).rejects.toBeInstanceOf(CoachingRequestError);
    });
  });
});
