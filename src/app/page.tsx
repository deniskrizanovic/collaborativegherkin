import { auth } from "@/auth";
import { db, tables } from "@/lib/db";
import { Session } from "@/lib/session";
import HomeClient from "./HomeClient";

export default async function Home() {
  const authSession = await auth();
  const sessionLib = new Session({ db, tables });
  const sessions = await sessionLib.list(authSession!.user.id);

  return (
    <HomeClient
      sessions={sessions}
      currentUser={{ id: authSession!.user.id, email: authSession!.user.email }}
    />
  );
}
