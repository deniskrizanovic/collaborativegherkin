import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { AVAILABLE_MODELS, DEFAULT_PROMPT } from "@/lib/llm-constants";

const PostSchema = z.object({
  content: z.string().min(1),
  model: z.enum(AVAILABLE_MODELS),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { content, model } = parsed.data;

    const promptRow = await db.appSetting.findUnique({ where: { key: "llm_review_prompt" } });
    const prompt = promptRow?.value ?? DEFAULT_PROMPT;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      logger.error("OPENROUTER_API_KEY is not set");
      return NextResponse.json({ error: "LLM service not configured" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, "OpenRouter request failed");

      if (response.status === 429) {
        let retryAfter: number | null = null;
        try {
          const parsed = JSON.parse(text) as {
            error?: { metadata?: { retry_after_seconds?: number } };
          };
          retryAfter = parsed.error?.metadata?.retry_after_seconds ?? null;
        } catch { /* ignore parse failures */ }

        const message = retryAfter
          ? `This model is rate-limited. Please try again in ${Math.ceil(retryAfter)} seconds, or select a different model.`
          : "This model is rate-limited. Please try again shortly, or select a different model.";
        return NextResponse.json({ error: message }, { status: 429 });
      }

      return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const result = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ result });
  } catch (err) {
    logger.error({ err }, "Unexpected error in llm-review");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
