import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "../db/schema.pg";
import * as sqliteSchema from "../db/schema.sqlite";

// One query surface for both engines. A `file:` DATABASE_URL opens SQLite
// (development, CI); anything else opens PostgreSQL (production). `db` is typed
// as the PostgreSQL database so the compiler flags anything Postgres rejects;
// the SQLite instance is cast to that type.
//
// Because of that cast, application code may use only the builder operations
// both dialects implement identically when awaited:
//   - select … from … where … orderBy … limit
//   - insert … values … returning, onConflictDoNothing / onConflictDoUpdate
//   - update … set … where … returning
//   - delete … where … returning
//   - the eq / and / desc operators
// Do NOT use the SQLite-only synchronous .run() / .all() / .get(), and do not
// use transactions (better-sqlite3 transactions are synchronous and behave
// differently from Postgres ones). Every query is tested on both engines via
// src/db/testing.ts.

export type Db = NodePgDatabase<typeof pgSchema>;
export type Tables = typeof pgSchema;

interface DbHandle {
  db: Db;
  tables: Tables;
  close: () => Promise<void>;
}

function createDb(): DbHandle {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    const client = new Database(url.slice("file:".length));
    return {
      db: drizzleSqlite(client, { schema: sqliteSchema }) as unknown as Db,
      tables: sqliteSchema as unknown as Tables,
      close: async () => {
        client.close();
      },
    };
  }
  const pool = new Pool({ connectionString: url });
  return {
    db: drizzlePg(pool, { schema: pgSchema }),
    tables: pgSchema,
    close: () => pool.end(),
  };
}

const globalForDb = globalThis as unknown as { dbHandle?: DbHandle };

const handle = globalForDb.dbHandle ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.dbHandle = handle;

export const db = handle.db;
export const tables = handle.tables;

export function closeDb(): Promise<void> {
  return handle.close();
}
