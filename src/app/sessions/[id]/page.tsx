import { notFound } from "next/navigation";
import { db, tables } from "@/lib/db";
import logger from "@/lib/logger";
import { Session, SessionNotFoundError } from "@/lib/session";
import SessionView from "./SessionView";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await new Session({ db, tables }).get(id).catch((err: unknown) => {
    if (err instanceof SessionNotFoundError) notFound();
    logger.error({ err, sessionId: id }, "Failed to load session page");
    throw err;
  });

  return <SessionView sessionId={session.id} title={session.title} />;
}
