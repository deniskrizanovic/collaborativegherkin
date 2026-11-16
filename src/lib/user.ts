import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";
import type { Db, Tables } from "./db";

export interface UserIdentity {
  id: string;
  email: string;
  name: string | null;
}

// Returns the user with this email, creating it if absent. One statement: the
// no-op conflict update makes `returning` yield the existing row too.
export async function ensureUserByEmail(
  db: Db,
  tables: Tables,
  email: string,
): Promise<UserIdentity> {
  const { users } = tables;
  const [user] = await db
    .insert(users)
    .values({ email })
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning({ id: users.id, email: users.email, name: users.name });
  return user;
}

// The NextAuth adapter over the app's user tables. It picks its dialect from the
// db instance at runtime; `tables` is the matching schema. No sessionsTable: the
// JWT strategy never calls the adapter's session methods, and the app's Session
// table is unrelated.
export function authAdapter(db: Db, tables: Tables): Adapter {
  return DrizzleAdapter(db, {
    usersTable: tables.users,
    accountsTable: tables.accounts,
    verificationTokensTable: tables.verificationTokens,
  });
}
