import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";
import { AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_PROMPT } from "@/lib/llm-constants";

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
  const fakeAppSetting = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  };
  const fakeFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reviewGherkin", () => {
    it("returns the model response on success", async () => {
      fakeAppSetting.findUnique.mockResolvedValue({ value: "custom prompt" });
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "Looks good!" } }],
        })
      );

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      const result = await coaching.reviewGherkin("Given a step", AVAILABLE_MODELS[0]);
      expect(result).toBe("Looks good!");
    });

    it("falls back to DEFAULT_PROMPT when no prompt row exists", async () => {
      fakeAppSetting.findUnique.mockResolvedValue(null);
      fakeFetch.mockResolvedValue(
        makeResponse(true, 200, {
          choices: [{ message: { content: "ok" } }],
        })
      );

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      await coaching.reviewGherkin("content", AVAILABLE_MODELS[0]);

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body as string);
      expect(body.messages[0].content).toBe(DEFAULT_PROMPT);
    });

    it("throws CoachingConfigError when apiKey is undefined", async () => {
      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: undefined,
      });

      await expect(
        coaching.reviewGherkin("content", AVAILABLE_MODELS[0])
      ).rejects.toBeInstanceOf(CoachingConfigError);
      expect(fakeFetch).not.toHaveBeenCalled();
    });

    it("throws RateLimitError with retryAfterSeconds when 429 includes metadata", async () => {
      fakeAppSetting.findUnique.mockResolvedValue(null);
      fakeFetch.mockResolvedValue(
        makeResponse(false, 429, {
          error: { metadata: { retry_after_seconds: 42 } },
        })
      );

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      const err = await coaching
        .reviewGherkin("content", AVAILABLE_MODELS[0])
        .catch((e) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBe(42);
    });

    it("throws RateLimitError with null retryAfterSeconds when 429 has no metadata", async () => {
      fakeAppSetting.findUnique.mockResolvedValue(null);
      fakeFetch.mockResolvedValue(makeResponse(false, 429, "rate limited"));

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      const err = await coaching
        .reviewGherkin("content", AVAILABLE_MODELS[0])
        .catch((e) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBeNull();
    });

    it("throws CoachingRequestError on non-429 failure", async () => {
      fakeAppSetting.findUnique.mockResolvedValue(null);
      fakeFetch.mockResolvedValue(makeResponse(false, 503, "service unavailable"));

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      await expect(
        coaching.reviewGherkin("content", AVAILABLE_MODELS[0])
      ).rejects.toBeInstanceOf(CoachingRequestError);
    });
  });

  describe("getSettings", () => {
    it("returns DB values when both keys are present", async () => {
      fakeAppSetting.findMany.mockResolvedValue([
        { key: "llm_review_prompt", value: "my prompt" },
        { key: "llm_review_model", value: AVAILABLE_MODELS[1] },
      ]);

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      const settings = await coaching.getSettings();
      expect(settings.prompt).toBe("my prompt");
      expect(settings.model).toBe(AVAILABLE_MODELS[1]);
      expect(settings.availableModels).toBe(AVAILABLE_MODELS);
    });

    it("falls back to defaults when keys are missing", async () => {
      fakeAppSetting.findMany.mockResolvedValue([]);

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      const settings = await coaching.getSettings();
      expect(settings.prompt).toBe(DEFAULT_PROMPT);
      expect(settings.model).toBe(DEFAULT_MODEL);
    });
  });

  describe("updateSettings", () => {
    it("upserts prompt only", async () => {
      fakeAppSetting.upsert.mockResolvedValue({});

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      await coaching.updateSettings({ prompt: "new prompt" });

      expect(fakeAppSetting.upsert).toHaveBeenCalledTimes(1);
      expect(fakeAppSetting.upsert).toHaveBeenCalledWith({
        where: { key: "llm_review_prompt" },
        update: { value: "new prompt" },
        create: { key: "llm_review_prompt", value: "new prompt" },
      });
    });

    it("upserts model only", async () => {
      fakeAppSetting.upsert.mockResolvedValue({});

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      await coaching.updateSettings({ model: AVAILABLE_MODELS[2] });

      expect(fakeAppSetting.upsert).toHaveBeenCalledTimes(1);
      expect(fakeAppSetting.upsert).toHaveBeenCalledWith({
        where: { key: "llm_review_model" },
        update: { value: AVAILABLE_MODELS[2] },
        create: { key: "llm_review_model", value: AVAILABLE_MODELS[2] },
      });
    });

    it("upserts both prompt and model", async () => {
      fakeAppSetting.upsert.mockResolvedValue({});

      const coaching = new Coaching({
        appSetting: fakeAppSetting as any,
        fetch: fakeFetch,
        apiKey: "key",
      });

      await coaching.updateSettings({
        prompt: "new prompt",
        model: AVAILABLE_MODELS[1],
      });

      expect(fakeAppSetting.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
