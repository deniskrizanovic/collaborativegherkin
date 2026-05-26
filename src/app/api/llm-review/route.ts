import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_PROMPT } from "@/lib/llm-constants";
import { Session, SessionNotFoundError } from "@/lib/session";
import {
  Coaching,
  CoachingConfigError,
  CoachingRequestError,
  RateLimitError,
} from "@/lib/coaching";

const PostSchema = z.object({
  content: z.string().min(1),
  sessionId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { content, sessionId } = parsed.data;

    const sessionService = new Session({ session: db.session });
    let sessionRecord;
    try {
      sessionRecord = await sessionService.get(sessionId);
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      throw err;
    }

    const prompt = sessionRecord.prompt ?? DEFAULT_PROMPT;
    const model = sessionRecord.model ?? DEFAULT_MODEL;

    if (!AVAILABLE_MODELS.includes(model as (typeof AVAILABLE_MODELS)[number])) {
      return NextResponse.json({ error: "Stored model is no longer available" }, { status: 400 });
    }

    const coaching = new Coaching({
      fetch: globalThis.fetch,
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const result = await coaching.reviewGherkin(content, prompt, model);
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
