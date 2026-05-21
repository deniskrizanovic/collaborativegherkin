import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { AVAILABLE_MODELS } from "@/lib/llm-constants";
import { Coaching } from "@/lib/coaching";

function makeCoaching() {
  return new Coaching({
    appSetting: db.appSetting,
    fetch: globalThis.fetch,
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

export async function GET() {
  try {
    const settings = await makeCoaching().getSettings();
    return NextResponse.json(settings);
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
    await makeCoaching().updateSettings({ prompt, model });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update LLM settings");
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
