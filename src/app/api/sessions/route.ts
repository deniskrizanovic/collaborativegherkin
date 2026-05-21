import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { Session } from "@/lib/session";

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
  userId: z.string().cuid(),
});

const session = new Session({ session: db.session });

export async function GET() {
  try {
    const sessions = await session.list();
    return NextResponse.json(sessions);
  } catch (err) {
    logger.error({ err }, "Failed to list sessions");
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await session.create(parsed.data);

    logger.info({ sessionId: created.id }, "Session created");
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    logger.error({ err }, "Failed to create session");
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
