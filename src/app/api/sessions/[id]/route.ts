import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { Session, SessionNotFoundError } from "@/lib/session";
import { auth } from "@/auth";

const session = new Session({ session: db.session });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSession = await auth();
  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const found = await session.get(id);
    return NextResponse.json(found);
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logger.error({ err, sessionId: id }, "Failed to fetch session");
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSession = await auth();
  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const row = await session.get(id);
    if (row.userId !== authSession.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await session.delete(id);
    logger.info({ sessionId: id }, "Session deleted");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logger.error({ err, sessionId: id }, "Failed to delete session");
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
