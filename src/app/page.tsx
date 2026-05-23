import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Session } from "@/lib/session";
import HomeClient from "./HomeClient";

export default async function Home() {
  const authSession = await auth();
  const sessionLib = new Session({ session: db.session });
  const sessions = await sessionLib.list(authSession!.user.id);

  return (
    <HomeClient
      sessions={sessions}
      currentUser={{ id: authSession!.user.id, email: authSession!.user.email }}
    />
  );
}
