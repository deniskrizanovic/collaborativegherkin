import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { Session } from "@/lib/session";
import { auth } from "@/auth";

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
});

const session = new Session({ session: db.session });

export async function GET() {
  const authSession = await auth();
  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await session.list(authSession.user.id);
    return NextResponse.json(sessions);
  } catch (err) {
    logger.error({ err }, "Failed to list sessions");
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authSession = await auth();
  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await session.create({ title: parsed.data.title, userId: authSession.user.id });

    logger.info({ sessionId: created.id }, "Session created");
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    logger.error({ err }, "Failed to create session");
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
