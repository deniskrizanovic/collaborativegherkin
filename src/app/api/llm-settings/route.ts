import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { AVAILABLE_MODELS, DEFAULT_PROMPT, DEFAULT_MODEL } from "@/lib/llm-constants";

export async function GET() {
  try {
    const rows = await db.appSetting.findMany({
      where: { key: { in: ["llm_review_prompt", "llm_review_model"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return NextResponse.json({
      prompt: map["llm_review_prompt"] ?? DEFAULT_PROMPT,
      model: map["llm_review_model"] ?? DEFAULT_MODEL,
      availableModels: [...AVAILABLE_MODELS],
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch LLM settings");
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

const PutSchema = z.object({
  prompt: z.string().min(10).optional(),
  model: z.enum(AVAILABLE_MODELS).optional(),
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { prompt, model } = parsed.data;
    const updates: Promise<unknown>[] = [];
    if (prompt !== undefined) {
      updates.push(
        db.appSetting.upsert({
          where: { key: "llm_review_prompt" },
          update: { value: prompt },
          create: { key: "llm_review_prompt", value: prompt },
        })
      );
    }
    if (model !== undefined) {
      updates.push(
        db.appSetting.upsert({
          where: { key: "llm_review_model" },
          update: { value: model },
          create: { key: "llm_review_model", value: model },
        })
      );
    }
    await Promise.all(updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update LLM settings");
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
