import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
  userId: z.string().cuid(),
});

export async function GET() {
  try {
    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, userId: true },
    });
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

    const session = await db.session.create({
      data: { title: parsed.data.title, userId: parsed.data.userId },
    });

    logger.info({ sessionId: session.id }, "Session created");
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    logger.error({ err }, "Failed to create session");
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
