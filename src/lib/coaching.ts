interface CoachingDeps {
  fetch: typeof globalThis.fetch;
  apiKey: string | undefined;
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

  async reviewGherkin(content: string, prompt: string, model: string): Promise<string> {
    if (!this.deps.apiKey) {
      throw new CoachingConfigError("OPENROUTER_API_KEY is not set");
    }

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
}
