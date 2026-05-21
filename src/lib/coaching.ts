import type { PrismaClient } from "@prisma/client";
import { AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_PROMPT } from "@/lib/llm-constants";

interface CoachingDeps {
  appSetting: PrismaClient["appSetting"];
  fetch: typeof globalThis.fetch;
  apiKey: string | undefined;
}

export interface CoachingSettings {
  prompt: string;
  model: string;
  availableModels: readonly string[];
}

export class RateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number | null) {
    super("rate_limited");
  }
}

export class CoachingConfigError extends Error {}
export class CoachingRequestError extends Error {}

export class Coaching {
  constructor(private deps: CoachingDeps) {}

  async reviewGherkin(content: string, model: string): Promise<string> {
    if (!this.deps.apiKey) {
      throw new CoachingConfigError("OPENROUTER_API_KEY is not set");
    }

    const promptRow = await this.deps.appSetting.findUnique({
      where: { key: "llm_review_prompt" },
    });
    const prompt = promptRow?.value ?? DEFAULT_PROMPT;

    const response = await this.deps.fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.deps.apiKey}`,
        },
        body: JSON.stringify({
          model,
          provider: { allow_fallbacks: true },
          messages: [
            { role: "system", content: prompt },
            { role: "user", content },
          ],
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();

      if (response.status === 429) {
        let retryAfter: number | null = null;
        try {
          const parsed = JSON.parse(text) as {
            error?: { metadata?: { retry_after_seconds?: number } };
          };
          retryAfter = parsed.error?.metadata?.retry_after_seconds ?? null;
        } catch {
          // ignore parse failures
        }
        throw new RateLimitError(retryAfter);
      }

      throw new CoachingRequestError(
        `OpenRouter request failed: ${response.status} ${text}`
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  async getSettings(): Promise<CoachingSettings> {
    const rows = await this.deps.appSetting.findMany({
      where: { key: { in: ["llm_review_prompt", "llm_review_model"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      prompt: map["llm_review_prompt"] ?? DEFAULT_PROMPT,
      model: map["llm_review_model"] ?? DEFAULT_MODEL,
      availableModels: AVAILABLE_MODELS,
    };
  }

  async updateSettings(patch: {
    prompt?: string;
    model?: string;
  }): Promise<void> {
    const updates: Promise<unknown>[] = [];

    if (patch.prompt !== undefined) {
      updates.push(
        this.deps.appSetting.upsert({
          where: { key: "llm_review_prompt" },
          update: { value: patch.prompt },
          create: { key: "llm_review_prompt", value: patch.prompt },
        })
      );
    }

    if (patch.model !== undefined) {
      updates.push(
        this.deps.appSetting.upsert({
          where: { key: "llm_review_model" },
          update: { value: patch.model },
          create: { key: "llm_review_model", value: patch.model },
        })
      );
    }

    await Promise.all(updates);
  }
}
