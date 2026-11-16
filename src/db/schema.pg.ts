import { createId } from "@paralleldrive/cuid2";
import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

// PostgreSQL schema (production). Keep at table/column/nullability parity with
// schema.sqlite.ts — `pnpm lint:schema-parity` enforces it.

const ts = (name: string) => timestamp(name, { precision: 3, mode: "date" });

export const users = pgTable("User", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  emailVerified: ts("emailVerified"),
  name: text("name"),
  image: text("image"),
  createdAt: ts("createdAt").notNull().defaultNow(),
});

export const accounts = pgTable(
  "Account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [unique().on(t.provider, t.providerAccountId)],
);

export const verificationTokens = pgTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: ts("expires").notNull(),
  },
  (t) => [unique().on(t.identifier, t.token)],
);

export const sessions = pgTable("Session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  content: text("content").notNull().default("{}"),
  prompt: text("prompt"),
  model: text("model"),
  createdAt: ts("createdAt").notNull().defaultNow(),
  updatedAt: ts("updatedAt")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
});
