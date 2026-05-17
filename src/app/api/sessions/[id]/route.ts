import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import logger from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await db.session.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (err) {
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
    await db.session.delete({ where: { id } });
    logger.info({ sessionId: id }, "Session deleted");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    logger.error({ err, sessionId: id }, "Failed to delete session");
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
