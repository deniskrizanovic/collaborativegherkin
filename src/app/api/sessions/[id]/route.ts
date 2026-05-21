import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { Session, SessionNotFoundError } from "@/lib/session";

const session = new Session({ session: db.session });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;
  try {
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
