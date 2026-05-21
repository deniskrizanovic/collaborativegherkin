import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { AVAILABLE_MODELS } from "@/lib/llm-constants";
import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";

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

    const coaching = new Coaching({
      appSetting: db.appSetting,
      fetch: globalThis.fetch,
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const result = await coaching.reviewGherkin(content, model);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof RateLimitError) {
      const message = err.retryAfterSeconds
        ? `This model is rate-limited. Please try again in ${Math.ceil(err.retryAfterSeconds)} seconds, or select a different model.`
        : "This model is rate-limited. Please try again shortly, or select a different model.";
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (err instanceof CoachingConfigError) {
      logger.error("OPENROUTER_API_KEY is not set");
      return NextResponse.json({ error: "LLM service not configured" }, { status: 500 });
    }
    if (err instanceof CoachingRequestError) {
      logger.error({ err }, "OpenRouter request failed");
      return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
    }
    logger.error({ err }, "Unexpected error in llm-review");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
