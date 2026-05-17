import { db } from "@/lib/db";
import HomeClient from "./HomeClient";

export default async function Home() {
  const sessions = await db.session.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return <HomeClient sessions={sessions} />;
}
