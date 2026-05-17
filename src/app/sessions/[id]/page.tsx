import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import SessionView from "./SessionView";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await db.session.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!session) notFound();

  return <SessionView sessionId={session.id} title={session.title} />;
}
